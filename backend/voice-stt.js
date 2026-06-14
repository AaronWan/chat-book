// 语音转文字 - 使用本机 Whisper
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.js';

/**
 * 转换音频为 Whisper 友好的 WAV 格式
 * @param {string} inputPath - 原始音频文件
 * @returns {string} WAV 文件路径
 */
function convertToWav(inputPath) {
  const ext = path.extname(inputPath).toLowerCase();
  const wavPath = inputPath.replace(ext, '.wav');

  return new Promise((resolve, reject) => {
    const proc = spawn('afconvert', [
      inputPath,
      '-f', 'WAVE',
      '-d', 'LEI16@16000',
      '-c', '1',
      wavPath
    ]);
    proc.on('close', (code) => {
      if (code !== 0) {
        // 转换失败，尝试用原文件
        resolve(inputPath);
      } else {
        resolve(wavPath);
      }
    });
  });
}

export async function transcribeAudio(audioBuffer, filename = 'input.webm') {
  const tmpDir = path.join(config.dataDir, 'temp');
  fs.mkdirSync(tmpDir, { recursive: true });
  const inputPath = path.join(tmpDir, filename);
  fs.writeFileSync(inputPath, audioBuffer);

  // 转换为 WAV (16kHz, mono, 16bit) 以提高 Whisper 识别率
  let wavPath;
  try {
    wavPath = await convertToWav(inputPath);
  } catch (e) {
    wavPath = inputPath;
  }

  const jsonPath = wavPath.replace('.wav', '.json');

  return new Promise((resolve, reject) => {
    const whisper = spawn('whisper', [
      wavPath,
      '--model', 'base',
      '--language', 'zh',
      '--output_format', 'json',
      '--fp16', 'False'
    ], { cwd: tmpDir });

    let stderr = '';
    whisper.stderr.on('data', (d) => { stderr += d; });
    whisper.on('close', (code) => {
      // 清理临时文件
      try { fs.unlinkSync(inputPath); } catch (_) {}
      try { if (wavPath !== inputPath) fs.unlinkSync(wavPath); } catch (_) {}
      try { if (fs.existsSync(jsonPath)) fs.unlinkSync(jsonPath); } catch (_) {}

      if (code !== 0) {
        // whisper 失败，尝试返回错误信息
        const errMsg = stderr.includes('Warning') ? '' : stderr.split('\n')[0];
        return reject(new Error(errMsg || `whisper exit ${code}`));
      }

      try {
        if (fs.existsSync(jsonPath)) {
          const result = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
          fs.unlink(jsonPath);
          resolve(result.text || '');
        } else {
          resolve('');
        }
      } catch (e) {
        resolve('');
      }
    });
  });
}