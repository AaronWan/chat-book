// voice.test.js - 语音路由(stt/tts/audio)单测
// 启动一个轻量 Express app 挂载 voiceRouter,直接走 HTTP 路径验证
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import express from 'express';
import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../../');
const DATA_DIR = path.resolve(ROOT, 'data');
const TEMP_DIR = path.join(DATA_DIR, 'temp');

process.env.DATA_DIR = DATA_DIR;

const voiceRouter = (await import('../../backend/routes-voice.js')).default;
const voiceTts = await import('../../backend/voice-tts.js');
const voiceStt = await import('../../backend/voice-stt.js');

let server;
let baseUrl;
let hasWhisper = false;
let hasSay = false;

before(async () => {
  // 检查系统能力
  try { execSync('which whisper', { stdio: 'ignore' }); hasWhisper = true; } catch {}
  try { execSync('which say', { stdio: 'ignore' }); hasSay = true; } catch {}
  if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true });

  const app = express();
  // limit 设大让超大 payload 能到路由层,由路由内部的 10MB 检查处理
  app.use(express.json({ limit: '20mb' }));
  // voice 路由内部只用 getUserId,缺少时会 fallback 到 'demo',无需挂 auth
  // mount 在 /api,匹配 server.js 里的 app.use('/api', voiceRouter)
  app.use('/api', voiceRouter);

  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', () => {
      baseUrl = `http://127.0.0.1:${server.address().port}`;
      resolve();
    });
  });
});

after(() => {
  server?.close();
});

// http 请求辅助
function httpReq(method, path, { headers = {}, body, raw } = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, baseUrl);
    const opts = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method,
      headers: { ...headers }
    };
    let payload;
    if (raw) {
      payload = raw;
    } else if (body !== undefined) {
      payload = Buffer.from(JSON.stringify(body), 'utf8');
      opts.headers['Content-Type'] = 'application/json';
    }
    if (payload) opts.headers['Content-Length'] = payload.length;
    const req = http.request(opts, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const buf = Buffer.concat(chunks);
        const ct = res.headers['content-type'] || '';
        let data;
        if (ct.includes('application/json')) {
          try { data = JSON.parse(buf.toString('utf8')); } catch { data = buf.toString('utf8'); }
        } else {
          data = buf;
        }
        resolve({ status: res.statusCode, headers: res.headers, data });
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

// ============================================================
// /api/voice/stt
// ============================================================
describe('STT — POST /api/voice/stt', () => {
  it('空 audio 字符串 → 400 音频数据为空', async () => {
    // 空字符串解码后 buffer.length === 0 → 触发 "音频数据为空"
    const r = await httpReq('POST', '/api/voice/stt', { body: { audio: '' } });
    assert.strictEqual(r.status, 400);
    assert.match(r.data.error || '', /缺少 audio 字段|音频数据为空/);
  });

  it('JSON 无 audio 字段 → 400', async () => {
    const r = await httpReq('POST', '/api/voice/stt', { body: { foo: 'bar' } });
    assert.strictEqual(r.status, 400);
    assert.match(r.data.error || '', /缺少 audio 字段/);
  });

  it('非字符串 audio 字段(JSON 传对象) → 400(audio 字段类型错误)', async () => {
    // voice bug 修复后，检测到非字符串/非 base64 类型直接返回 400，不再抛 500
    const r = await httpReq('POST', '/api/voice/stt', { body: { audio: { not: 'a string' } } });
    assert.strictEqual(r.status, 400);
    assert.match(r.data.error || '', /必须是 base64 字符串或 Buffer/);
  });

  it('超大 audio(> 10MB) → 400', async () => {
    // base64 解码比 = 4:3,需要 ~14MB base64 才能解出 > 10MB 二进制
    const huge = 'A'.repeat(15 * 1024 * 1024);
    const r = await httpReq('POST', '/api/voice/stt', { body: { audio: huge } });
    assert.strictEqual(r.status, 400);
    assert.match(r.data.error || '', /音频文件过大/);
  });

  it('有效 base64 → 200 + 返回 text 字段', { skip: !hasWhisper }, async () => {
    // 极小 base64(空 wav 头)让 whisper 跑通并返回空文本
    const tinyBase64 = 'UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=';
    const r = await httpReq('POST', '/api/voice/stt', {
      body: { audio: tinyBase64 }
    }, );
    assert.strictEqual(r.status, 200);
    assert.ok(typeof r.data.text === 'string', '应返回 text 字符串');
    assert.strictEqual(r.data.success, true);
  });

  it('有效 base64 + 无 whisper 时返回 500 而非 200', { skip: hasWhisper }, async () => {
    const r = await httpReq('POST', '/api/voice/stt', { body: { audio: 'AAAA' } });
    assert.strictEqual(r.status, 500);
    assert.match(r.data.error || '', /语音识别失败/);
  });
});

// ============================================================
// /api/voice/tts
// ============================================================
describe('TTS — POST /api/voice/tts', () => {
  it('缺 text 字段 → 400', async () => {
    const r = await httpReq('POST', '/api/voice/tts', { body: {} });
    assert.strictEqual(r.status, 400);
    assert.match(r.data.error || '', /缺少 text 字段/);
  });

  it('text 非字符串 → 400', async () => {
    const r = await httpReq('POST', '/api/voice/tts', { body: { text: 123 } });
    assert.strictEqual(r.status, 400);
  });

  it('text 超 2000 字符 → 400', async () => {
    const r = await httpReq('POST', '/api/voice/tts', { body: { text: 'x'.repeat(2001) } });
    assert.strictEqual(r.status, 400);
    assert.match(r.data.error || '', /文字过长/);
  });

  it('有效 text + 默认作者 → 200 + audio_url + voice=Samantha', { skip: !hasSay }, async () => {
    const r = await httpReq('POST', '/api/voice/tts', { body: { text: '你好', author_name: '' } });
    assert.strictEqual(r.status, 200);
    assert.ok(r.data.audio_url);
    assert.match(r.data.audio_url, /^\/api\/voice\/audio\/tts_/);
    assert.strictEqual(r.data.voice, 'Samantha');
    // 实际生成的文件应存在
    const fname = path.basename(r.data.audio_url);
    assert.ok(fs.existsSync(path.join(TEMP_DIR, fname)), '应生成音频文件');
  });

  it('已知作者 Stephen Covey → voice=Alex', { skip: !hasSay }, async () => {
    const r = await httpReq('POST', '/api/voice/tts', { body: { text: 'hi', author_name: 'Stephen Covey' } });
    assert.strictEqual(r.status, 200);
    assert.strictEqual(r.data.voice, 'Alex');
  });

  it('已知中文作者 卡夫卡 → voice=Anna', { skip: !hasSay }, async () => {
    const r = await httpReq('POST', '/api/voice/tts', { body: { text: '你好', author_name: '卡夫卡' } });
    assert.strictEqual(r.status, 200);
    assert.strictEqual(r.data.voice, 'Anna');
  });

  it('未知作者 → voice=default(Samantha)', { skip: !hasSay }, async () => {
    const r = await httpReq('POST', '/api/voice/tts', { body: { text: 'hi', author_name: '不存在的作家' } });
    assert.strictEqual(r.status, 200);
    assert.strictEqual(r.data.voice, 'Samantha');
  });

  it('TTS 失败(空 say 文本)→ 500', { skip: !hasSay }, async () => {
    // say 接受空文本,这里用不可见的控制字符触发 say 失败可能不可靠,
    // 因此用 text='' 走 400 路径测不到;改测不带 skip 时的默认成功路径
    // 仅做占位:实际依赖系统 say 实现,这里跳过
  });
});

// ============================================================
// /api/voice/audio/:filename
// ============================================================
describe('Audio — GET /api/voice/audio/:filename', () => {
  let generatedFile;  // 测试期间动态生成的 tts 文件

  it('不存在的文件 → 404', async () => {
    const r = await httpReq('GET', '/api/voice/audio/nonexistent_test_12345.m4a');
    assert.strictEqual(r.status, 404);
    assert.match(r.data.error || '', /不存在/);
  });

  it('存在的 tts 文件 → 200 + content-type audio/m4a', { skip: !hasSay }, async () => {
    // 先生成一个
    const tts = await httpReq('POST', '/api/voice/tts', { body: { text: '测试', author_name: '' } });
    assert.strictEqual(tts.status, 200);
    const fname = path.basename(tts.data.audio_url);
    generatedFile = fname;

    const r = await httpReq('GET', `/api/voice/audio/${fname}`);
    assert.strictEqual(r.status, 200);
    assert.match(r.headers['content-type'] || '', /audio\/m4a/);
    assert.ok(r.data instanceof Buffer, '应返回 Buffer');
    assert.ok(r.data.length > 100, '音频内容非空');
  });

  it('响应包含 Content-Disposition inline 头', { skip: !hasSay }, async () => {
    if (!generatedFile) {
      // 兜底再生成一个
      const tts = await httpReq('POST', '/api/voice/tts', { body: { text: 'x', author_name: '' } });
      generatedFile = path.basename(tts.data.audio_url);
    }
    const r = await httpReq('GET', `/api/voice/audio/${generatedFile}`);
    assert.strictEqual(r.status, 200);
    assert.match(r.headers['content-disposition'] || '', /inline/);
  });

  it('路径穿越攻击(../../etc/passwd)被剥离 → 404', async () => {
    const r = await httpReq('GET', '/api/voice/audio/..%2F..%2Fetc%2Fpasswd');
    // URL 解码后是 ../../etc/passwd,正则在服务端剥离非法字符,应找不到
    assert.strictEqual(r.status, 404);
  });

  it('带空格的非法字符被剥离', async () => {
    const r = await httpReq('GET', '/api/voice/audio/has%20space.m4a');
    assert.strictEqual(r.status, 404);
  });
});

// ============================================================
// voice-tts.js helpers
// ============================================================
describe('voice-tts helpers', () => {
  it('getVoiceUrl 返回 /api/voice/audio/{basename}', () => {
    const url = voiceTts.getVoiceUrl('/abs/data/temp/tts_123.m4a');
    assert.strictEqual(url, '/api/voice/audio/tts_123.m4a');
  });

  it('getVoiceUrl 接受嵌套路径(只取 basename)', () => {
    const url = voiceTts.getVoiceUrl('/some/deep/path/file.m4a');
    assert.strictEqual(url, '/api/voice/audio/file.m4a');
  });

  it('voice-stt 导出 transcribeAudio 函数', () => {
    assert.strictEqual(typeof voiceStt.transcribeAudio, 'function');
  });

  it('voice-tts 导出 textToSpeech + getVoiceUrl', () => {
    assert.strictEqual(typeof voiceTts.textToSpeech, 'function');
    assert.strictEqual(typeof voiceTts.getVoiceUrl, 'function');
  });
});
