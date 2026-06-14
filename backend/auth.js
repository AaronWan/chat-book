// 认证：注册 / 登录 / 会话验证
import { Router } from 'express';
import crypto from 'node:crypto';
import * as storage from './storage.js';

const router = Router();

// 简单 session token（HMAC-based，避免存储 JWT 依赖）
const SESSION_SECRET = process.env.SESSION_SECRET || 'liaoshu-dev-secret-change-in-prod';

function makeToken(userId) {
  const now = Date.now();
  const hmac = crypto.createHmac('sha256', SESSION_SECRET);
  hmac.update(userId);
  hmac.update(String(now)); // 用 now 签名
  const sig = hmac.digest('hex').slice(0, 16);
  const exp = now + 7 * 24 * 60 * 60 * 1000; // 7 days
  return Buffer.from(`${userId}:${now}:${exp}:${sig}`).toString('base64url'); // 存 now 用于验证
}

function parseToken(token) {
  try {
    const decoded = Buffer.from(token, 'base64url').toString('utf8');
    const parts = decoded.split(':');
    if (parts.length !== 4) return null;
    const [userId, createdStr, expStr, sig] = parts;
    const exp = parseInt(expStr, 10);
    const created = parseInt(createdStr, 10);
    if (Date.now() > exp) return null;

    // 用 created（不是 exp）验证签名
    const hmac = crypto.createHmac('sha256', SESSION_SECRET);
    hmac.update(userId);
    hmac.update(createdStr);
    const expectedSig = hmac.digest('hex').slice(0, 16);
    if (sig !== expectedSig) return null;

    return userId;
  } catch {
    return null;
  }
}

export function authMiddleware(req, res, next) {
  const authHeader = req.header('Authorization');
  const token = authHeader?.startsWith('Bearer ')
    ? authHeader.slice(7)
    : req.header('X-Session-Token');
  if (token) {
    const userId = parseToken(token);
    if (userId) {
      req.userId = userId;
      req.sessionToken = token;
    }
  }
  // 即使没有 token 也允许匿名访问（向后兼容 X-User-Id 方式）
  next();
}

// 获取真实用户 ID（优先 session，其次 X-User-Id）
export function getUserId(req) {
  return req.userId || req.header('X-User-Id') || req.query.user_id || 'demo';
}

// 注册
router.post('/auth/register', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: '用户名和密码必填' });
  }
  if (username.length < 2 || username.length > 32) {
    return res.status(400).json({ error: '用户名需 2-32 个字符' });
  }
  if (password.length < 4) {
    return res.status(400).json({ error: '密码至少 4 个字符' });
  }
  if (!/^[a-zA-Z0-9_\u4e00-\u9fa5]+$/.test(username)) {
    return res.status(400).json({ error: '用户名只能包含字母、数字、下划线和中文' });
  }

  // 检查是否已存在
  const existing = storage.getUserByUsername(username);
  if (existing) {
    return res.status(409).json({ error: '用户名已存在' });
  }

  // 创建用户
  const userId = 'user_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
  const passwordHash = crypto.createHash('sha256').update(password).digest('hex');
  const user = storage.createUser({ id: userId, username, passwordHash });

  const token = makeToken(userId);
  res.json({
    token,
    user: { id: user.id, username: user.username, nickname: user.nickname }
  });
});

// 登录
router.post('/auth/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: '用户名和密码必填' });
  }

  const user = storage.getUserByUsername(username);
  if (!user) {
    return res.status(401).json({ error: '用户名或密码错误' });
  }

  const passwordHash = crypto.createHash('sha256').update(password).digest('hex');
  if (user.passwordHash !== passwordHash) {
    return res.status(401).json({ error: '用户名或密码错误' });
  }

  const token = makeToken(user.id);
  res.json({
    token,
    user: { id: user.id, username: user.username, nickname: user.nickname }
  });
});

// 当前用户信息（需登录）
router.get('/auth/me', (req, res) => {
  const userId = getUserId(req);
  const user = storage.getUser(userId);
  if (!user) return res.status(401).json({ error: '未登录' });
  res.json({ user: { id: user.id, username: user.username, nickname: user.nickname } });
});

// 更新个人资料
router.patch('/auth/me', (req, res) => {
  const userId = getUserId(req);
  const user = storage.getUser(userId);
  if (!user) return res.status(401).json({ error: '未登录' });
  const updated = storage.updateUser(userId, req.body);
  res.json({ user: { id: updated.id, username: updated.username, nickname: updated.nickname } });
});

export default router;