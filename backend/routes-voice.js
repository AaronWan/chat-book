// 语音路由 - STT + TTS
import Router from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.js';
import { transcribeAudio } from './voice-stt.js';
import { textToSpeech, getVoiceUrl } from './voice-tts.js';
import { getUserId } from './auth.js';

const router = Router();

// ============= STT =============
// POST /api/voice/stt - 接收音频，返回文字
router.post('/voice/stt', async (req, res) => {
  const userId = getUserId(req);

  try {
    // 接收 audio 数据（base64 或 raw buffer）
    let audioData;
    const contentType = req.headers['content-type'] || '';

    if (contentType.includes('application/json')) {
      // { audio: "base64..." } 或 { audio: <buffer> }
      const body = req.body;
      if (body.audio) {
        if (typeof body.audio === 'string') {
          audioData = Buffer.from(body.audio, 'base64');
        } else if (Buffer.isBuffer(body.audio)) {
          audioData = body.audio;
        } else {
          return res.status(400).json({ error: 'audio 字段必须是 base64 字符串或 Buffer' });
        }
      } else {
        return res.status(400).json({ error: '缺少 audio 字段' });
      }
    } else {
      // raw buffer
      audioData = req.body;
    }

    if (!audioData || audioData.length === 0) {
      return res.status(400).json({ error: '音频数据为空' });
    }

    if (audioData.length > 10 * 1024 * 1024) {
      return res.status(400).json({ error: '音频文件过大（最大10MB）' });
    }

    const text = await transcribeAudio(audioData, `stt_${userId}_${Date.now()}.m4a`);
    res.json({ text: text || '(未识别到语音)', success: true });

  } catch (e) {
    console.error('[voice/stt]', e.message);
    res.status(500).json({ error: '语音识别失败: ' + e.message });
  }
});

// ============= TTS =============
// POST /api/voice/tts - 接收文字，返回音频
router.post('/voice/tts', async (req, res) => {
  const userId = getUserId(req);
  const { text, author_name } = req.body;

  if (!text || typeof text !== 'string') {
    return res.status(400).json({ error: '缺少 text 字段' });
  }

  if (text.length > 2000) {
    return res.status(400).json({ error: '文字过长（最大2000字）' });
  }

  try {
    const result = await textToSpeech(text, author_name || '');
    res.json({
      audio_url: getVoiceUrl(result.path),
      voice: result.voice,
      success: true
    });
  } catch (e) {
    console.error('[voice/tts]', e.message);
    res.status(500).json({ error: '语音合成失败: ' + e.message });
  }
});

// ============= 音频文件服务 =============
// GET /api/voice/audio/:filename - 提供音频文件
router.get('/voice/audio/:filename', (req, res) => {
  const filename = req.params.filename.replace(/[^a-zA-Z0-9_\-\.]/, '');
  const filePath = path.join(config.dataDir, 'temp', filename);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: '音频文件不存在' });
  }

  res.setHeader('Content-Type', 'audio/m4a');
  res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
  fs.createReadStream(filePath).pipe(res);
});

export default router;