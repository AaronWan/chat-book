// 集成测试:启动真实服务器，测试所有核心 API
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import http from 'node:http';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../../');
const TEST_USER = 'it_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);

let serverProcess;
let port;
let baseUrl;

before(async () => {
  port = 3000 + Math.floor(Math.random() * 8000);
  baseUrl = `http://localhost:${port}`;
  serverProcess = spawn('node', ['backend/server.js'], {
    cwd: ROOT,
    env: { ...process.env, PORT: String(port) },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  // 等待服务器启动
  await new Promise(r => setTimeout(r, 2500));
  // 健康检查轮询
  for (let i = 0; i < 15; i++) {
    try {
      const res = await fetch(`${baseUrl}/healthz`);
      if (res.ok) return;
    } catch {}
    await new Promise(r => setTimeout(r, 500));
  }
  throw new Error('服务器启动超时');
});

after(() => {
  if (serverProcess) {
    serverProcess.kill('SIGTERM');
    serverProcess = null;
  }
});

async function apiReq(pathname, options = {}) {
  const url = new URL(pathname, baseUrl);
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-User-Id': TEST_USER,
        ...(options.headers || {})
      }
    };
    const body = options.body ? JSON.stringify(options.body) : undefined;
    if (body) opts.headers['Content-Length'] = Buffer.byteLength(body);
    const req = http.request(opts, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, data }); }
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

describe('集成 — 健康检查', () => {
  it('GET /healthz 200', async () => {
    const res = await apiReq('/healthz');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.ok, true);
  });
});

describe('集成 — 书库', () => {
  it('GET /api/books 200 + >= 20 本', async () => {
    const res = await apiReq('/api/books');
    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(res.data.books));
    assert.ok(res.data.books.length >= 20);
  });

  it('GET /api/books/:id 找到书', async () => {
    const res = await apiReq('/api/books/7habits');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.book.id, '7habits');
  });

  it('GET /api/books/:id 不存在 404', async () => {
    const res = await apiReq('/api/books/nobody_' + Date.now());
    assert.strictEqual(res.status, 404);
  });

  it('GET /api/books/:id/agent 返回智能体', async () => {
    const res = await apiReq('/api/books/7habits/agent');
    assert.strictEqual(res.status, 200);
    assert.ok(res.data.agent);
    assert.strictEqual(res.data.agent.author.name, '史蒂芬·柯维');
    assert.ok(Array.isArray(res.data.agent.chapters));
  });
});

describe('集成 — 书架 CRUD', () => {
  const book = '7habits'; // 使用真实存在的书

  it('POST /api/user/shelf/add 添加书籍', async () => {
    const res = await apiReq('/api/user/shelf/add', {
      method: 'POST',
      body: { book_id: book, status: '想聊' }
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.entry.book_id, book);
    assert.strictEqual(res.data.entry.status, '想聊');
  });

  it('POST /api/user/shelf/start 状态变为进行中', async () => {
    const res = await apiReq('/api/user/shelf/start', {
      method: 'POST',
      body: { book_id: book }
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.entry.status, '进行中');
    assert.ok(res.data.entry.started_at);
  });

  it('GET /api/user/shelf 包含添加的书', async () => {
    const res = await apiReq('/api/user/shelf');
    assert.strictEqual(res.status, 200);
    assert.ok(res.data.shelf.some(e => e.book_id === book));
  });

  it('POST /api/user/shelf/finish 状态变为已完成', async () => {
    const res = await apiReq('/api/user/shelf/finish', {
      method: 'POST',
      body: { book_id: book }
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.entry.status, '已聊完');
  });

  it('DELETE /api/user/shelf/:id 移除书籍', async () => {
    const res = await apiReq(`/api/user/shelf/${book}`, { method: 'DELETE' });
    assert.strictEqual(res.status, 200);
    const shelf = await apiReq('/api/user/shelf');
    assert.ok(!shelf.data.shelf.some(e => e.book_id === book));
  });
});

describe('集成 — 章节对话流程', () => {
  const bookId = '7habits';
  const ch = 2;

  it('POST /api/user/chapter/start 开启章节', async () => {
    const res = await apiReq('/api/user/chapter/start', {
      method: 'POST',
      body: { book_id: bookId, chapter_index: ch }
    });
    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(res.data.dialogue));
    assert.ok(res.data.dialogue.length > 0);
    assert.strictEqual(res.data.dialogue[0].role, 'author');
  });

  it('POST /api/user/chapter/message 发送消息', async () => {
    const res = await apiReq('/api/user/chapter/message', {
      method: 'POST',
      body: { book_id: bookId, chapter_index: ch, content: '请介绍一下这个章节的核心观点。' }
    });
    assert.strictEqual(res.status, 200);
    assert.ok(res.data.author_message);
    assert.ok(res.data.author_message.content.length > 0);
  });

  it('多轮对话', async () => {
    const msgs = ['什么是积极主动？', '如何在生活中实践?', '和环境决定论的区别是什么?'];
    for (const msg of msgs) {
      const res = await apiReq('/api/user/chapter/message', {
        method: 'POST',
        body: { book_id: bookId, chapter_index: ch, content: msg }
      });
      assert.strictEqual(res.status, 200);
      assert.ok(res.data.author_message);
    }
  });

  it('POST /api/user/chapter/close 生成笔记', async () => {
    const res = await apiReq('/api/user/chapter/close', {
      method: 'POST',
      body: { book_id: bookId, chapter_index: ch }
    });
    assert.strictEqual(res.status, 200);
    assert.ok(res.data.note);
    assert.ok(res.data.note.content);
    const c = res.data.note.content;
    assert.ok('core_insights' in c || 'collisions' in c || 'questions' in c);
  });

  it('GET /api/user/chapter/:book/:ch/review 章节回顾', async () => {
    const res = await apiReq(`/api/user/chapter/${bookId}/${ch}/review`);
    assert.strictEqual(res.status, 200);
    assert.ok(res.data.chapter);
    assert.ok(res.data.note);
  });
});

describe('集成 — 单书空间', () => {
  it('GET /api/user/book/:id/overview 200', async () => {
    const res = await apiReq('/api/user/book/7habits/overview');
    assert.strictEqual(res.status, 200);
    assert.ok(res.data.book);
    assert.ok(Array.isArray(res.data.chapters));
    assert.ok('progress_percent' in res.data);
  });
});

describe('集成 — 搜索', () => {
  it('GET /api/user/search 200', async () => {
    const res = await apiReq('/api/user/search?q=积极');
    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(res.data.results));
  });

  it('无结果返回空数组', async () => {
    const res = await apiReq(`/api/user/search?q=notexist${Date.now()}`);
    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(res.data.results));
  });
});

describe('集成 — 用户设置', () => {
  it('GET /api/user/me 200', async () => {
    const res = await apiReq('/api/user/me');
    assert.strictEqual(res.status, 200);
    assert.ok(res.data.user);
    assert.strictEqual(res.data.user.id, TEST_USER);
  });

  it('PATCH /api/user/me 更新 nickname', async () => {
    const res = await apiReq('/api/user/me', {
      method: 'PATCH',
      body: { nickname: '集成测试' }
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.user.nickname, '集成测试');
  });

  it('GET /api/user/me/settings 200', async () => {
    const res = await apiReq('/api/user/me/settings');
    assert.strictEqual(res.status, 200);
    assert.ok('theme' in res.data.settings);
  });

  it('PATCH /api/user/me/settings 更新设置', async () => {
    const res = await apiReq('/api/user/me/settings', {
      method: 'PATCH',
      body: { theme: 'dark', weekly_target_books: 3 }
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.settings.theme, 'dark');
    assert.strictEqual(res.data.settings.weekly_target_books, 3);
  });
});
