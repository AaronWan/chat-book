// 文字转语音 - 使用 macOS say 命令
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.js';

// 作者名字 → say voice 映射
const VOICE_MAP = {
  '史蒂芬·柯维': 'Eddy',
  'Stephen Covey': 'Alex',
  '卡夫卡': 'Anna',
  default: 'Samantha' // macOS 默认英文女声
};

export function textToSpeech(text, authorName = '') {
  const tmpDir = path.join(config.dataDir, 'temp');
  fs.mkdirSync(tmpDir, { recursive: true });

  const voice = VOICE_MAP[authorName] || VOICE_MAP.default;
  const outputPath = path.join(tmpDir, `tts_${Date.now()}.m4a`);

  return new Promise((resolve, reject) => {
    const proc = spawn('say', [
      '-v', voice,
      '-o', outputPath,
      '--data-format', 'aac',
      text
    ]);

    let stderr = '';
    proc.stderr.on('data', (d) => { stderr += d; });
    proc.on('close', (code) => {
      if (code !== 0) return reject(new Error(stderr || `say exit ${code}`));
      resolve({ path: outputPath, voice });
    });
  });
}

export function getVoiceUrl(filename) {
  return `/api/voice/audio/${path.basename(filename)}`;
}