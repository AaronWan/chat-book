// Express 服务器入口
import express from 'express';
import cors from 'cors';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { config } from './config.js';
import routes from './routes.js';
import routesV1 from './routes-v1.js';
import authRouter, { authMiddleware, getUserId } from './auth.js';
import voiceRouter from './routes-voice.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));

// 全局认证中间件（设置 req.userId）
app.use('/api', authMiddleware);

// 认证路由
app.use('/api', authRouter);

// API 路由（使用 authMiddleware 的 getUserId）
app.use('/api', routes);
app.use('/api', routesV1);
app.use('/api', voiceRouter);

// 健康检查
app.get('/healthz', (req, res) => res.json({ ok: true, ts: new Date().toISOString() }));

// 静态前端
const frontendDir = path.join(root, 'frontend');
if (fs.existsSync(frontendDir)) {
  app.use(express.static(frontendDir));
  app.get('/', (req, res) => res.sendFile(path.join(frontendDir, 'index.html')));
}

app.use((err, req, res, _next) => {
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: '文件太大,最大支持 50MB' });
  }
  console.error('[server] 未捕获错误:', err);
  res.status(err.status || 500).json({ error: err.message });
});

app.listen(config.port, () => {
  console.log(`\n┌─ 聊书 MVP 服务 ─────────────────`);
  console.log(`│ 端口: ${config.port}`);
  console.log(`│ 健康检查: http://localhost:${config.port}/healthz`);
  console.log(`│ 前端:    http://localhost:${config.port}/`);
  console.log(`│ LLM:     ${config.llm.url}`);
  console.log(`│ 模型:    ${config.llm.model}`);
  console.log(`└──────────────────────────────`);
});
