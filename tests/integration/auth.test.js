// 集成测试:认证 — 注册/登录/会话/中间件
import { strict as assert } from 'node:assert';
import http from 'node:http';

const BASE = 'http://localhost:3000';

// 简易 fetch wrapper
function api(path, { method = 'GET', body, headers = {} } = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE);
    const opts = {
      hostname: url.hostname, port: url.port,
      path: url.pathname, method,
      headers: { 'Content-Type': 'application/json', ...headers }
    };
    const jbody = body ? JSON.stringify(body) : undefined;
    if (jbody) opts.headers['Content-Length'] = Buffer.byteLength(jbody);
    const req = http.request(opts, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(d) }); }
        catch { resolve({ status: res.statusCode, data: d }); }
      });
    });
    req.on('error', reject);
    if (jbody) req.write(jbody);
    req.end();
  });
}

function wait(ms) { return new Promise(r => setTimeout(r, ms)); }

// 提取 token
function getToken(r) { return r.data?.token || null; }

export default async function run() {
  let passed = 0, failed = 0;

  async function test(name, fn) {
    try {
      await fn();
      console.log(`  ✓ ${name}`);
      passed++;
    } catch (e) {
      console.log(`  ✗ ${name}: ${e.message}`);
      failed++;
    }
  }

  console.log('\n【集成测试】认证系统');

  // ── 注册 ──
  await test('POST /api/auth/register 拒绝空用户名', async () => {
    const r = await api('/api/auth/register', { method: 'POST', body: { username: '', password: '1234' } });
    assert.equal(r.status, 400);
    assert.ok(r.data.error.includes('必填'));
  });

  await test('POST /api/auth/register 拒绝短密码', async () => {
    const r = await api('/api/auth/register', { method: 'POST', body: { username: 'user_x', password: '123' } });
    assert.equal(r.status, 400);
    assert.ok(r.data.error.includes('4'));
  });

  await test('POST /api/auth/register 拒绝非法用户名', async () => {
    const r = await api('/api/auth/register', { method: 'POST', body: { username: 'user-name!', password: '1234' } });
    assert.equal(r.status, 400);
    assert.ok(r.data.error.includes('字母、数字'));
  });

  await test('POST /api/auth/register 成功返回 token', async () => {
    const username = 'testuser_' + Date.now();
    const r = await api('/api/auth/register', { method: 'POST', body: { username, password: 'test1234' } });
    assert.equal(r.status, 200);
    assert.ok(r.data.token, '应有 token');
    assert.ok(r.data.user?.id, '应有 user.id');
    assert.equal(r.data.user.username, username);
  });

  await test('POST /api/auth/register 拒绝重复用户名', async () => {
    const u = 'dup_' + Date.now(), p = 'test1234';
    await api('/api/auth/register', { method: 'POST', body: { username: u, password: p } });
    const r = await api('/api/auth/register', { method: 'POST', body: { username: u, password: p } });
    assert.equal(r.status, 409);
    assert.ok(r.data.error.includes('已存在'));
  });

  // ── 登录 ──
  let registeredToken = null;
  const regUsername = 'logtest_' + Date.now();
  const regResp = await api('/api/auth/register', { method: 'POST', body: { username: regUsername, password: 'pass1234' } });
  registeredToken = getToken(regResp);

  await test('POST /api/auth/login 正确密码成功', async () => {
    const r = await api('/api/auth/login', { method: 'POST', body: { username: regUsername, password: 'pass1234' } });
    assert.equal(r.status, 200);
    assert.ok(getToken(r), '应有 token');
  });

  await test('POST /api/auth/login 错误密码被拒绝', async () => {
    const r = await api('/api/auth/login', { method: 'POST', body: { username: regUsername, password: 'wrong' } });
    assert.equal(r.status, 401);
  });

  await test('POST /api/auth/login 不存在用户被拒绝', async () => {
    const r = await api('/api/auth/login', { method: 'POST', body: { username: 'nosuch_' + Date.now(), password: 'pass1234' } });
    assert.equal(r.status, 401);
  });

  // ── 会话验证 ──
  await test('GET /api/auth/me 带有效 token 返回用户信息', async () => {
    const r = await api('/api/auth/me', { headers: { 'Authorization': 'Bearer ' + registeredToken } });
    assert.equal(r.status, 200);
    assert.equal(r.data.user.username, regUsername);
  });

  await test('GET /api/auth/me 无 token 返回 demo 用户（兼容）', async () => {
    const r = await api('/api/auth/me');
    assert.equal(r.status, 200);
    assert.equal(r.data.user.id, 'demo');
  });

  await test('GET /api/auth/me 带无效 token 返回 demo（兼容）', async () => {
    const r = await api('/api/auth/me', { headers: { 'Authorization': 'Bearer invalid_token_xxx' } });
    assert.equal(r.status, 200);
    assert.equal(r.data.user.id, 'demo'); // 降级为匿名
  });

  // ── 书架 + token ──
  await test('GET /api/user/shelf 带 token 识别为注册用户', async () => {
    const r = await api('/api/user/shelf', { headers: { 'Authorization': 'Bearer ' + registeredToken } });
    assert.equal(r.status, 200);
    // 注册用户应有独立的书架数据（而非 demo 的）
    assert.ok(Array.isArray(r.data.shelf));
  });

  // ── PATCH /api/auth/me ──
  await test('PATCH /api/auth/me 更新昵称', async () => {
    const r = await api('/api/auth/me', {
      method: 'PATCH',
      headers: { 'Authorization': 'Bearer ' + registeredToken },
      body: { nickname: '测试昵称' }
    });
    assert.equal(r.status, 200);
    assert.equal(r.data.user.nickname, '测试昵称');
  });

  console.log(`\n  结果: ${passed} 通过, ${failed} 失败`);
  return { passed, failed };
}