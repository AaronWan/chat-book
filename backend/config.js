// 加载 .env 环境变量(轻量,无 dotenv 依赖)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');

// 优先读取已存在的环境变量（测试时可在 import 前设置）
const _DATA_DIR = process.env.DATA_DIR;

function loadEnv() {
  const envPath = path.join(root, '.env');
  if (!fs.existsSync(envPath)) {
    console.warn(`[config] .env 不存在,将使用 .env.example 的默认值`);
    const examplePath = path.join(root, '.env.example');
    if (fs.existsSync(examplePath)) {
      const text = fs.readFileSync(examplePath, 'utf-8');
      text.split('\n').forEach((line) => {
        const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
        if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
      });
    }
    return;
  }
  const text = fs.readFileSync(envPath, 'utf-8');
  text.split('\n').forEach((line) => {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    // 环境变量已设置的值不覆盖（保持测试时注入的 PORT 等）
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  });
}

loadEnv();

// 环境变量优先于 .env 文件（支持测试时注入）
function resolveDataDir() {
  if (_DATA_DIR) {
    return path.isAbsolute(_DATA_DIR) ? _DATA_DIR : path.resolve(root, _DATA_DIR);
  }
  const envVal = process.env.DATA_DIR;
  if (envVal) {
    return path.isAbsolute(envVal) ? envVal : path.resolve(root, envVal);
  }
  return path.resolve(root, 'data');
}

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  llm: {
    url: process.env.LLM_URL || 'https://aihub.firstshare.cn',
    key: process.env.LLM_KEY || '',
    model: process.env.LLM_MODEL || 'claude-sonnet-4-6'
  },
  dataDir: resolveDataDir()
};