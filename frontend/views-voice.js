// 语音对话模式 UI
// 入口: mountVoiceInput(opts) → { element, deactivate }
// 状态机: idle → recording → transcribing → sending → playing → idle

import { api } from './api.js';
import { el, toast, icon, authorAvatar, pad2 } from './ui.js';

const MAX_RECORD_MS = 60000;
const BAR_COUNT = 28;
const BAR_GAP = 3;

export function mountVoiceInput(opts) {
  const {
    book_id, chapter_index, authorName,
    messagesInner, scrollToBottom, onDialogueUpdate
  } = opts;

  // ========== State ==========
  let state = 'idle';
  let tornDown = false;
  let mediaRecorder = null;
  let audioContext = null;
  let analyser = null;
  let sourceNode = null;
  let stream = null;
  let chunks = [];
  let recordStart = 0;
  let timerId = null;
  let rafId = null;
  let maxTimerId = null;
  let timeBuf = null;          // 预分配 getByteTimeDomainData 缓冲区
  let cachedLineColor = '';
  let cachedAccentColor = '';
  let playback = null;         // { audio, btn, url } 当前正在播放的 TTS

  // DOM refs
  let root, statusEl, micBtn, stopBtn, canvas, canvasCtx, hintEl;

  function setState(next) {
    state = next;
    renderState();
  }

  function fmtTime(ms) {
    return `0:${pad2(Math.floor(ms / 1000))}`;
  }

  // ========== Waveform ==========
  function drawWaveform() {
    if (!analyser || !canvasCtx) return;
    analyser.getByteTimeDomainData(timeBuf);

    const w = canvas.width, h = canvas.height;
    const barW = (w - BAR_GAP * (BAR_COUNT - 1)) / BAR_COUNT;
    const center = h / 2;

    canvasCtx.clearRect(0, 0, w, h);
    canvasCtx.fillStyle = cachedLineColor;
    canvasCtx.fillRect(0, center - 0.5, w, 1);

    const step = Math.floor(timeBuf.length / BAR_COUNT);
    canvasCtx.fillStyle = cachedAccentColor;
    for (let i = 0; i < BAR_COUNT; i++) {
      let max = 0;
      const base = i * step;
      for (let j = 0; j < step; j++) {
        const v = Math.abs(timeBuf[base + j] - 128);
        if (v > max) max = v;
      }
      const barH = Math.max(2, (max / 128) * (h - 4));
      canvasCtx.fillRect(i * (barW + BAR_GAP), center - barH / 2, barW, barH);
    }
    rafId = requestAnimationFrame(drawWaveform);
  }

  // ========== Recording lifecycle ==========
  async function startRecording() {
    if (state !== 'idle' || tornDown) return;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (e) {
      toast('请允许麦克风权限: ' + e.message, 'error');
      return;
    }

    const mime = pickMime();
    try {
      mediaRecorder = new MediaRecorder(
        stream,
        mime ? { mimeType: mime, audioBitsPerSecond: 64000 } : { audioBitsPerSecond: 64000 }
      );
    } catch (e) {
      toast('录音初始化失败: ' + e.message, 'error');
      cleanupStream();
      return;
    }
    chunks = [];
    mediaRecorder.ondataavailable = (e) => { if (e.data && e.data.size > 0) chunks.push(e.data); };
    mediaRecorder.onstop = handleRecordingStop;
    mediaRecorder.onerror = (e) => {
      console.error('[voice] MediaRecorder error', e);
      if (tornDown) return;
      toast('录音出错', 'error');
      setState('idle');
      cleanupStream();
    };

    try {
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
      sourceNode = audioContext.createMediaStreamSource(stream);
      analyser = audioContext.createAnalyser();
      analyser.fftSize = 1024;
      sourceNode.connect(analyser);
      // 缓存 CSS 颜色 & 复用 buffer,避免每帧 30+ 次 getComputedStyle
      const cs = getComputedStyle(document.documentElement);
      cachedLineColor = cs.getPropertyValue('--line').trim();
      cachedAccentColor = cs.getPropertyValue('--accent').trim();
      timeBuf = new Uint8Array(analyser.fftSize);
    } catch (e) {
      console.warn('[voice] AudioContext failed, waveform disabled', e);
    }

    mediaRecorder.start(250);
    recordStart = Date.now();
    setState('recording');
    drawWaveform();

    // 显示精度 1s 即可,1s 间隔足够
    timerId = setInterval(() => {
      if (state !== 'recording') return;
      statusEl.textContent = `正在说话 ${fmtTime(Date.now() - recordStart)}`;
    }, 1000);

    maxTimerId = setTimeout(() => {
      if (state === 'recording') {
        toast('已达到最长录音时长', 'info');
        stopRecording();
      }
    }, MAX_RECORD_MS);
  }

  function stopRecording() {
    if (state !== 'recording') return;
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      try {
        // 确保 stop 之前最后一帧 dataavailable 已发出
        mediaRecorder.requestData();
        mediaRecorder.stop();
      } catch (_) {}
    } else {
      setState('idle');
      cleanupStream();
    }
  }

  async function handleRecordingStop() {
    clearInterval(timerId); timerId = null;
    clearTimeout(maxTimerId); maxTimerId = null;
    if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
    cleanupStream();
    cleanupAudioGraph();

    if (tornDown) return;
    if (!chunks.length) {
      toast('没有捕获到音频', 'error');
      setState('idle');
      return;
    }

    const mime = mediaRecorder?.mimeType || 'audio/webm';
    const blob = new Blob(chunks, { type: mime });
    chunks = [];

    setState('transcribing');

    let text;
    try {
      text = await api.stt(blob);
    } catch (e) {
      if (tornDown) return;
      toast('语音识别失败: ' + e.message, 'error');
      setState('idle');
      return;
    }

    if (tornDown) return;
    if (!text || !text.trim() || text === '(未识别到语音)') {
      toast('未识别到语音,请重试', 'info');
      setState('idle');
      return;
    }

    await sendVoiceMessage(text, blob);
  }

  async function sendVoiceMessage(text, userBlob) {
    if (tornDown) return;
    const userAudioUrl = URL.createObjectURL(userBlob);
    const userMsg = renderUserVoiceMessage(text, userAudioUrl);
    messagesInner.appendChild(userMsg);
    scrollToBottom();

    setState('sending');
    const loading = renderLoadingVoice(authorName);
    messagesInner.appendChild(loading);
    scrollToBottom();

    let authorMsg;
    try {
      const r = await api.sendMessage(book_id, chapter_index, text);
      authorMsg = r.author_message;
    } catch (e) {
      loading.remove();
      if (tornDown) return;
      toast('发送失败: ' + e.message, 'error');
      setState('idle');
      return;
    }
    if (tornDown) { loading.remove(); return; }
    loading.remove();

    const ttsHolder = renderAuthorVoiceMessage(authorMsg.content, authorName);
    messagesInner.appendChild(ttsHolder);
    scrollToBottom();
    onDialogueUpdate && onDialogueUpdate();
    setState('idle');

    try {
      setState('playing');
      const ttsBlob = await api.tts(authorMsg.content, authorName);
      if (tornDown) return;
      const ttsUrl = URL.createObjectURL(ttsBlob);
      attachTTSButton(ttsHolder, ttsUrl);
      playTts(ttsUrl, null);
    } catch (e) {
      console.warn('[voice] TTS failed', e);
      if (tornDown) return;
      toast('语音合成失败: ' + e.message, 'error');
      setState('idle');
    }
  }

  // ========== TTS playback ==========
  function playTts(url, btn) {
    stopPlayback();
    const audio = new Audio(url);
    const session = { audio, btn, url };
    playback = session;

    const onSettle = () => {
      // 仅当仍是当前会话时清理(避免 race)
      if (playback !== session) return;
      playback = null;
      if (btn) btn.classList.remove('is-playing');
      if (state === 'playing' || state === 'idle') setState('idle');
      // 释放 audio 内部 buffer
      try { audio.removeAttribute('src'); audio.load(); } catch (_) {}
      URL.revokeObjectURL(url);
    };

    audio.onended = onSettle;
    audio.onerror = onSettle;
    audio.play().catch((e) => {
      console.warn('[voice] play blocked', e);
      onSettle();
    });

    if (btn) btn.classList.add('is-playing');
  }

  function stopPlayback() {
    if (!playback) return;
    try { playback.audio.pause(); } catch (_) {}
    try { playback.audio.removeAttribute('src'); playback.audio.load(); } catch (_) {}
    if (playback.btn) playback.btn.classList.remove('is-playing');
    URL.revokeObjectURL(playback.url);
    playback = null;
  }

  function attachTTSButton(holder, url) {
    const btn = holder.querySelector('.lc-voice-replay');
    if (!btn) return;
    btn.dataset.audioUrl = url;
    btn.disabled = false;
    btn.title = '重新播放';
    btn.onclick = (e) => {
      e.stopPropagation();
      // 同一按钮再点 = 停止
      if (playback && playback.btn === btn) {
        stopPlayback();
        return;
      }
      playTts(url, btn);
    };
  }

  // ========== Cleanup ==========
  function cleanupStream() {
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      stream = null;
    }
  }

  function cleanupAudioGraph() {
    if (sourceNode) { try { sourceNode.disconnect(); } catch (_) {} sourceNode = null; }
    if (analyser) { try { analyser.disconnect(); } catch (_) {} analyser = null; }
    if (audioContext && audioContext.state !== 'closed') {
      audioContext.close().catch(() => {});
    }
    audioContext = null;
    if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
  }

  function deactivate() {
    tornDown = true;
    if (state === 'recording' && mediaRecorder && mediaRecorder.state !== 'inactive') {
      try { mediaRecorder.requestData(); mediaRecorder.stop(); } catch (_) {}
    }
    if (timerId) clearInterval(timerId);
    if (maxTimerId) clearTimeout(maxTimerId);
    if (rafId) cancelAnimationFrame(rafId);
    stopPlayback();
    cleanupStream();
    cleanupAudioGraph();
    // 重置实例变量(便于该实例被复用——目前不会,但更稳)
    state = 'idle';
    chunks = [];
    mediaRecorder = null;
    timeBuf = null;
  }

  // ========== UI state render ==========
  function renderState() {
    if (!statusEl || !micBtn || !stopBtn) return;
    const isIdle = state === 'idle';
    const isRecording = state === 'recording';
    if (isIdle) {
      statusEl.textContent = `按住说话,向 ${authorName} 提问`;
    } else if (isRecording) {
      // 计时器每秒会覆盖,此处只设初始值
      statusEl.textContent = `正在说话 0:00`;
    } else if (state === 'transcribing') {
      statusEl.textContent = '正在识别…';
    } else if (state === 'sending') {
      statusEl.textContent = '正在发送…';
    } else {
      statusEl.textContent = `${authorName} 正在说话…`;
    }
    micBtn.disabled = !isIdle;
    micBtn.classList.toggle('is-recording', isRecording);
    stopBtn.classList.toggle('hidden', !isRecording);
    hintEl.classList.toggle('hidden', !isIdle);
    if (!isRecording && canvasCtx) canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
  }

  // ========== Build UI ==========
  function buildUI() {
    canvas = el('canvas', {
      width: 240, height: 40,
      class: 'lc-voice-canvas',
      style: { display: 'block', margin: '0 auto' }
    });
    canvasCtx = canvas.getContext('2d');

    statusEl = el('div', { class: 'lc-voice-status' }, `按住说话,向 ${authorName} 提问`);

    micBtn = el('button', {
      class: 'lc-voice-mic',
      'aria-label': '按住说话',
      type: 'button',
      onpointerdown: (e) => {
        if (state !== 'idle') return;
        e.preventDefault();
        // 把后续 pointer 事件全部路由到本按钮,避免拖出丢失
        try { micBtn.setPointerCapture(e.pointerId); } catch (_) {}
        startRecording();
      },
      onpointerup: (e) => {
        if (state !== 'recording') return;
        e.preventDefault();
        try { micBtn.releasePointerCapture(e.pointerId); } catch (_) {}
        stopRecording();
      },
      onpointercancel: (e) => {
        if (state !== 'recording') return;
        try { micBtn.releasePointerCapture(e.pointerId); } catch (_) {}
        stopRecording();
      }
    }, [icon('mic', 1.8)]);

    stopBtn = el('button', {
      class: 'lc-btn lc-btn-ghost text-sm px-3 py-1.5 rounded-md hidden',
      onclick: () => stopRecording()
    }, [icon('stop', 0.9), el('span', {}, '停止')]);

    hintEl = el('div', { class: 'lc-voice-hint' }, '麦克风权限仅用于本次对话');

    root = el('div', { class: 'lc-voice-input' }, [
      statusEl,
      canvas,
      el('div', { class: 'lc-voice-mic-wrap' }, [micBtn]),
      el('div', { class: 'lc-voice-action-row' }, [stopBtn]),
      hintEl
    ]);
  }

  buildUI();
  renderState();

  return { element: root, deactivate };
}

// ========== Module-level helpers ==========
function pickMime() {
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4'];
  for (const c of candidates) {
    if (window.MediaRecorder && MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(c)) return c;
  }
  return '';
}

// ========== Message renderers ==========
function renderUserVoiceMessage(text, audioUrl) {
  const btn = el('button', {
    class: 'lc-voice-mini-btn',
    title: '播放我的录音',
    'data-audio-url': audioUrl,
    onclick: (e) => {
      e.stopPropagation();
      const url = e.currentTarget.dataset.audioUrl;
      if (!url) return;
      const a = new Audio(url);
      a.onended = () => { a.removeAttribute('src'); a.load(); URL.revokeObjectURL(url); };
      a.onerror = () => { URL.revokeObjectURL(url); };
      a.play().catch(() => URL.revokeObjectURL(url));
    }
  }, [icon('playSmall', 0.85)]);
  return el('div', { class: 'flex gap-3 fade-in items-start justify-end' }, [
    el('div', { class: 'flex-1 max-w-[82%] flex flex-col items-end min-w-0' }, [
      el('div', { class: 'lc-caption mb-1 flex items-center gap-1.5' }, [
        el('span', {}, '我'),
        icon('waveform', 1.05)
      ]),
      el('div', {
        class: 'user-bubble px-4 py-3.5 flex items-start gap-2',
        style: { fontFamily: 'var(--f-serif-zh)', fontSize: '15.5px', lineHeight: 1.78, color: 'var(--ink-1)', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }
      }, [btn, el('div', { class: 'flex-1' }, text)])
    ])
  ]);
}

function renderAuthorVoiceMessage(content, authorName) {
  const replayBtn = el('button', {
    class: 'lc-voice-mini-btn lc-voice-replay',
    title: '正在合成语音…',
    disabled: true,
    style: { color: 'var(--accent)' }
  }, [icon('speaker', 0.95)]);
  return el('div', { class: 'flex gap-3 fade-in items-start' }, [
    authorAvatar(authorName, ''),
    el('div', { class: 'flex-1 min-w-0' }, [
      el('div', { class: 'lc-caption mb-1' }, authorName),
      el('div', {
        class: 'author-bubble px-4 py-3.5 flex items-start gap-2',
        style: { fontFamily: 'var(--f-serif-zh)', fontSize: '15.5px', lineHeight: 1.78, color: 'var(--ink-1)', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }
      }, [el('div', { class: 'flex-1' }, content), replayBtn])
    ])
  ]);
}

function renderLoadingVoice(authorName) {
  return el('div', { class: 'flex gap-3 fade-in items-start' }, [
    authorAvatar(authorName, ''),
    el('div', { class: 'flex-1' }, [
      el('div', { class: 'lc-caption mb-1' }, `${authorName} 正在思考…`),
      el('div', { class: 'author-bubble px-4 py-4 inline-flex gap-1.5' }, [
        el('div', { class: 'typing-dot' }),
        el('div', { class: 'typing-dot' }),
        el('div', { class: 'typing-dot' })
      ])
    ])
  ]);
}
