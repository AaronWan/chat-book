#!/usr/bin/env node
// 聊书 CLI - 外部系统访问接口
import http from 'http';
import https from 'https';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_HOST = 'http://localhost:3000';
const DEFAULT_USER = 'demo';
const TOKEN_FILE = path.join(os.homedir(), '.chat_book_token');

// ── Token 持久化 ──────────────────────────────────────────────────────────

function loadToken() {
  try {
    if (fs.existsSync(TOKEN_FILE)) {
      const t = fs.readFileSync(TOKEN_FILE, 'utf8').trim();
      if (t) return t;
    }
  } catch {}
  return null;
}

function saveToken(token) {
  fs.writeFileSync(TOKEN_FILE, token, { mode: 0o600 });
}

function clearToken() {
  try { fs.unlinkSync(TOKEN_FILE); } catch {}
}

// ── 全局选项解析 ──────────────────────────────────────────────────────────

const rawArgs = process.argv.slice(2);
const opts = { host: DEFAULT_HOST, user: DEFAULT_USER, json: false, curl: false, token: loadToken() };
const positional = [];
for (let i = 0; i < rawArgs.length; i++) {
  if (rawArgs[i] === '--host' && rawArgs[i + 1]) { opts.host = rawArgs[++i]; }
  else if (rawArgs[i] === '--user' && rawArgs[i + 1]) { opts.user = rawArgs[++i]; }
  else if (rawArgs[i] === '--token' && rawArgs[i + 1]) { opts.token = rawArgs[++i]; }
  else if (rawArgs[i] === '--json') { opts.json = true; }
  else if (rawArgs[i] === '--curl') { opts.curl = true; }
  else { positional.push(rawArgs[i]); }
}

const [cmd, ...cmdArgs] = positional;

// ── HTTP 客户端 ────────────────────────────────────────────────────────────

function api(method, pathname, body, extraHeaders = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(pathname, opts.host);
    const httpMod = url.protocol === 'https:' ? https : http;
    const headers = { 'Content-Type': 'application/json', 'X-User-Id': opts.user, ...extraHeaders };
    if (opts.token) headers['Authorization'] = 'Bearer ' + opts.token;
    const reqOpts = {
      method,
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname + url.search,
      headers,
    };
    if (opts.curl) {
      const authLine = opts.token ? `-H 'Authorization: Bearer ${opts.token}' ` : '';
      const bodyStr = body ? `-d '${JSON.stringify(body).replace(/'/g, "\\'")}'` : '';
      console.log(`curl -X ${method} '${url}' ${authLine}-H 'X-User-Id: ${opts.user}' -H 'Content-Type: application/json' ${bodyStr}`);
      return resolve({ skipped: true });
    }
    const req = httpMod.request(reqOpts, res => {
      const ct = res.headers['content-type'] ?? '';
      const isBinary = ct.includes('application/pdf') || ct.includes('audio') || ct.includes('octet-stream');
      if (isBinary) {
        const chunks = [];
        res.on('data', c => chunks.push(c));
        res.on('end', () => resolve({ status: res.statusCode, data: Buffer.concat(chunks), headers: res.headers }));
      } else {
        let data = '';
        res.on('data', c => (data += c));
        res.on('end', () => {
          try { resolve({ status: res.statusCode, data: JSON.parse(data), headers: res.headers }); }
          catch { resolve({ status: res.statusCode, data, headers: res.headers }); }
        });
      }
    });
    req.on('error', reject);
    if (body) {
      const bodyStr = JSON.stringify(body);
      req.write(bodyStr);
    }
    req.end();
  });
}

// multipart/form-data upload (for book file upload)
function upload(pathname, filePath, fieldName = 'file') {
  return new Promise((resolve, reject) => {
    if (opts.curl) {
      console.log(`curl -X POST '${new URL(pathname, opts.host)}' -H 'X-User-Id: ${opts.user}' -F '${fieldName}=@${filePath}'`);
      return resolve({ skipped: true });
    }
    const filename = path.basename(filePath);
    const boundary = '----FormBoundary' + Math.random().toString(36).slice(2);
    const fileData = fs.readFileSync(filePath);
    const header = Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="${fieldName}"; filename="${filename}"\r\nContent-Type: application/octet-stream\r\n\r\n`,
      'utf8'
    );
    const footer = Buffer.from(`\r\n--${boundary}--\r\n`, 'utf8');
    const body = Buffer.concat([header, fileData, footer]);
    const url = new URL(pathname, opts.host);
    const httpMod = url.protocol === 'https:' ? https : http;
    const req = httpMod.request({
      method: 'POST',
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname,
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': body.length,
        'X-User-Id': opts.user,
      },
    }, res => {
      let data = '';
      res.on('data', c => (data += c));
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, data }); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

const get  = p => api('GET',    p);
const post = (p, b) => api('POST',   p, b);
const patch = (p, b) => api('PATCH', p, b);
const put   = (p, b) => api('PUT',    p, b);
const del  = p => api('DELETE', p);

// ── 辅助 ───────────────────────────────────────────────────────────────────

const out  = data => console.log(opts.json ? JSON.stringify(data, null, 2) : data);
const err  = (msg, code = 1) => { console.error(msg); process.exit(code); };

const download = (urlStr, outPath) => new Promise((resolve, reject) => {
  const url = new URL(urlStr, opts.host);
  const httpMod = url.protocol === 'https:' ? https : http;
  httpMod.get({
    hostname: url.hostname, port: url.port || (url.protocol === 'https:' ? 443 : 80),
    path: url.pathname, headers: { 'X-User-Id': opts.user },
  }, res => {
    if (res.statusCode !== 200) { reject(new Error(`下载失败: ${res.statusCode}`)); return; }
    const ws = fs.createWriteStream(outPath);
    res.pipe(ws);
    ws.on('finish', () => resolve(outPath));
  }).on('error', reject);
});

// ── 命令实现 ───────────────────────────────────────────────────────────────

async function cmdHealth() {
  const r = await get('/healthz');
  if (r.skipped) return;
  out(r.data);
}

async function cmdLogin(args) {
  const [username, password] = args;
  if (!username || !password) err('用法: chat-book login <用户名> <密码>');
  const r = await api('POST', '/api/auth/login', { username, password });
  if (r.skipped) return;
  if (r.status !== 200) { console.error('登录失败:', r.data.error); process.exit(1); }
  const { token, user } = r.data;
  saveToken(token);
  console.log(`✅ 登录成功: ${user.username} (${user.id})`);
  console.log(`   Token 已保存至 ~/.chat-book_token`);
  console.log(`   后续命令会自动使用此 Token`);
}

async function cmdRegister(args) {
  const [username, password] = args;
  if (!username || !password) err('用法: chat-book register <用户名> <密码>');
  const r = await api('POST', '/api/auth/register', { username, password });
  if (r.skipped) return;
  if (r.status !== 200) { console.error('注册失败:', r.data.error); process.exit(1); }
  const { token, user } = r.data;
  saveToken(token);
  console.log(`✅ 注册成功: ${user.username} (${user.id})`);
  console.log(`   Token 已保存至 ~/.chat-book_token`);
  console.log(`   后续命令会自动使用此 Token`);
}

async function cmdWhoami() {
  if (!opts.token) { console.log('未登录（无 Token）'); return; }
  const r = await api('GET', '/api/auth/me');
  if (r.skipped) return;
  if (r.status !== 200) { console.error('未登录或 Token 无效:', r.data.error); clearToken(); return; }
  const u = r.data.user ?? r.data;
  console.log(`用户名: ${u.username}`);
  console.log(`用户ID: ${u.id}`);
  if (u.nickname) console.log(`昵称:   ${u.nickname}`);
}

async function cmdBooks() {
  const r = await get('/api/books');
  if (r.skipped) return;
  const books = r.data.books ?? r.data;
  if (opts.json) { out(r.data); return; }
  books.forEach(b => console.log(`  ${(b.id).padEnd(22)} ${b.title} (${b.chapter_count ?? 0}章)`));
}

async function cmdBook(args) {
  const [id] = args;
  if (!id) err('用法: chat-book book <book_id>');
  const r = await get(`/api/books/${id}`);
  if (r.skipped) return;
  if (r.status === 404) err(`书不存在: ${id}`);
  const b = r.data.book ?? r.data;
  if (opts.json) { out(r.data); return; }
  console.log(`书名: ${b.title}`);
  console.log(`作者: ${b.author}`);
  console.log(`简介: ${b.summary?.slice(0, 80)}`);
  console.log(`章节数: ${b.chapter_count ?? 0}`);
  if (b.chapters) b.chapters.forEach((c, i) => console.log(`  [${i + 1}] ${c.title}`));
  else console.log(`  (章节列表需从书籍内容获取)`);
}

async function cmdSearch(args) {
  const [q] = args;
  if (!q) err('用法: chat-book search <query>');
  const r = await get(`/api/user/search?q=${encodeURIComponent(q)}`);
  if (r.skipped) return;
  const results = r.data.results ?? r.data ?? [];
  if (opts.json) { out(r.data); return; }
  if (!results.length) { console.log('  (无结果)'); return; }
  results.forEach(s => console.log(`  [${s.type}] ${s.title ?? (s.content ?? '').slice(0, 80)}`));
}

// ── 书架 ──────────────────────────────────────────────────────────────────

async function cmdShelf() {
  const r = await get('/api/user/shelf');
  if (r.skipped) return;
  const books = r.data.shelf ?? r.data.books ?? r.data ?? [];
  if (opts.json) { out(r.data); return; }
  if (!books.length) { console.log('  (空)'); return; }
  books.forEach(b => {
    const title = b.book?.title ?? b.title ?? b.book_id;
    console.log(`  ${(b.book_id ?? b.id ?? '').padEnd(22)} ${title} [${b.status || 'unread'}]`);
  });
}

async function cmdShelfAdd(args) {
  const [id] = args;
  if (!id) err('用法: chat-book shelf add <book_id>');
  const r = await post('/api/user/shelf/add', { book_id: id });
  if (r.skipped) return;
  out(r.data);
}

async function cmdShelfStart(args) {
  const [id] = args;
  if (!id) err('用法: chat-book shelf start <book_id>');
  const r = await post('/api/user/shelf/start', { book_id: id });
  if (r.skipped) return;
  out(r.data);
}

async function cmdShelfFinish(args) {
  const [id] = args;
  if (!id) err('用法: chat-book shelf finish <book_id>');
  const r = await post('/api/user/shelf/finish', { book_id: id });
  if (r.skipped) return;
  out(r.data);
}

async function cmdShelfRemove(args) {
  const [id] = args;
  if (!id) err('用法: chat-book shelf remove <book_id>');
  const r = await del(`/api/user/shelf/${id}`);
  if (r.skipped) return;
  out(r.data);
}

// ── 章节 ──────────────────────────────────────────────────────────────────

async function cmdChapterStart(args) {
  const [bookId, ch] = args;
  if (!bookId || ch === undefined) err('用法: chat-book chapter start <book_id> <chapter_index>');
  const r = await post('/api/user/chapter/start', { book_id: bookId, chapter_index: parseInt(ch) });
  if (r.skipped) return;
  out(r.data);
}

async function cmdChapterMessage(args) {
  const [bookId, ch, ...rest] = args;
  if (!bookId || ch === undefined || !rest.length) err('用法: chat-book chapter message <book_id> <chapter_index> <message...>');
  const r = await post('/api/user/chapter/message', { book_id: bookId, chapter_index: parseInt(ch), message: rest.join(' ') });
  if (r.skipped) return;
  out(r.data);
}

async function cmdChapterNote(args) {
  const [bookId, ch] = args;
  if (!bookId || ch === undefined) err('用法: chat-book chapter note <book_id> <chapter_index>');
  const r = await get(`/api/user/chapter/${bookId}/${ch}/note`);
  if (r.skipped) return;
  const note = r.data.note ?? r.data;
  if (opts.json) { out(r.data); return; }
  if (!note) { console.log('(暂无笔记)'); return; }
  console.log(`章节 ${note.chapter_index}: ${note.status}`);
  const c = note.content ?? {};
  if (c.core_insights?.length) { console.log('\n核心洞察:'); c.core_insights.forEach((ins, i) => console.log(`  ${i + 1}. ${ins}`)); }
  if (c.collisions?.length) { console.log('\n碰撞时刻:'); c.collisions.forEach(col => console.log(`  用户: ${col.user?.slice(0, 80)}...`)); }
  if (c.questions?.length) { console.log('\n好问题:'); c.questions.forEach((q, i) => console.log(`  ${i + 1}. ${q}`)); }
}

async function cmdChapterReview(args) {
  const [bookId, ch] = args;
  if (!bookId || ch === undefined) err('用法: chat-book chapter review <book_id> <chapter_index>');
  const r = await get(`/api/user/chapter/${bookId}/${ch}/review`);
  if (r.skipped) return;
  if (opts.json) { out(r.data); return; }
  const { chapter, note, dialogue_summary } = r.data;
  if (chapter) console.log(`章节: ${chapter.title}`);
  if (note) {
    console.log(`状态: ${note.status}`);
    const c = note.content ?? {};
    (c.core_insights ?? []).forEach((ins, i) => console.log(`  洞察${i+1}: ${ins.slice(0, 80)}`));
  }
  if (dialogue_summary) console.log(`对话: ${dialogue_summary.total_turns}轮 (用户${dialogue_summary.user_turns}次 / 作者${dialogue_summary.author_turns}次)`);
}

async function cmdChapterResume(args) {
  const [bookId, ch] = args;
  if (!bookId || ch === undefined) err('用法: chat-book chapter resume <book_id> <chapter_index>');
  const r = await get(`/api/user/chapter/${bookId}/${ch}/resume`);
  if (r.skipped) return;
  out(r.data);
}

async function cmdChapterDialogue(args) {
  const [bookId, ch] = args;
  if (!bookId || ch === undefined) err('用法: chat-book chapter dialogue <book_id> <chapter_index>');
  const r = await get(`/api/user/chapter/${bookId}/${ch}/dialogue`);
  if (r.skipped) return;
  if (opts.json) { out(r.data); return; }
  const messages = r.data.dialogue ?? r.data.messages ?? r.data ?? [];
  messages.forEach(m => {
    const role = m.role === 'user' ? '👤 用户' : m.role === 'author' ? '📖 作者' : m.role;
    console.log(`${role}: ${m.content?.slice(0, 100)}`);
  });
}

async function cmdChapterClose(args) {
  const [bookId, ch] = args;
  if (!bookId || ch === undefined) err('用法: chat-book chapter close <book_id> <chapter_index>');
  const r = await post('/api/user/chapter/close', { book_id: bookId, chapter_index: parseInt(ch) });
  if (r.skipped) return;
  out(r.data);
}

// ── 整书 ──────────────────────────────────────────────────────────────────

async function cmdBookNote(args) {
  const [id] = args;
  if (!id) err('用法: chat-book book-note <book_id>');
  const r = await get(`/api/user/book/${id}/note`);
  if (r.skipped) return;
  out(r.data);
}

async function cmdOverview(args) {
  const [id] = args;
  if (!id) err('用法: chat-book overview <book_id>');
  const r = await get(`/api/user/book/${id}/overview`);
  if (r.skipped) return;
  if (opts.json) { out(r.data); return; }
  const { book, shelf, chapters = [], progress_percent } = r.data;
  console.log(`书名: ${book?.title ?? id}`);
  console.log(`作者: ${book?.author ?? ''}`);
  console.log(`状态: ${shelf?.status ?? '未加入书架'}`);
  console.log(`进度: ${progress_percent ?? 0}%`);
  console.log(`\n章节进度:`);
  chapters.forEach(c => {
    const icon = c.status === '已聊完' ? '✅' : c.status === '进行中' ? '🔄' : '⬜';
    console.log(`  ${icon} [${c.index}] ${c.title} (${c.status})`);
  });
}

async function cmdExport(args) {
  const [id, fmt = 'md'] = args;
  if (!id) err('用法: chat-book export <book_id> [md|pdf]');
  if (!['md', 'pdf'].includes(fmt)) err('格式仅支持 md 或 pdf');
  const r = await get(`/api/user/book/${id}/export?format=${fmt}`);
  if (r.skipped) return;
  if (r.status !== 200) {
    const errMsg = Buffer.isBuffer(r.data) ? r.data.toString() : JSON.stringify(r.data);
    err(`导出失败 (${r.status}): ${errMsg}`);
  }
  if (fmt === 'md') {
    const text = Buffer.isBuffer(r.data) ? r.data.toString('utf8') : (typeof r.data === 'string' ? r.data : JSON.stringify(r.data, null, 2));
    process.stdout.write(text);
    return;
  }
  const buf = Buffer.isBuffer(r.data) ? r.data : Buffer.from(JSON.stringify(r.data));
  const outPath = `/tmp/${id}_聊书笔记.pdf`;
  fs.writeFileSync(outPath, buf);
  console.log(`已保存: ${outPath} (${buf.length} bytes)`);
}

// ── 语音 ──────────────────────────────────────────────────────────────────

async function cmdVoiceTts(args) {
  const authorIdx = args.indexOf('--author');
  const text = authorIdx !== -1 ? args.slice(0, authorIdx).join(' ') : args.join(' ');
  const author = (authorIdx !== -1 && args[authorIdx + 1]) ? args[authorIdx + 1] : undefined;
  if (!text) err('用法: chat-book voice tts <text> [--author <name>]');
  const body = { text };
  if (author) body.author = author;
  const r = await post('/api/voice/tts', body);
  if (r.skipped) return;
  if (r.status !== 200) err(`TTS 失败: ${JSON.stringify(r.data)}`);
  console.log(`音频URL: ${r.data.audio_url}`);
  const filename = path.basename(r.data.audio_url) + '.m4a';
  const outPath = `/tmp/${filename}`;
  await download(r.data.audio_url, outPath);
  console.log(`已保存: ${outPath}`);
}

async function cmdVoiceStt(args) {
  const [filepath] = args;
  if (!filepath) err('用法: chat-book voice stt <audio_file>');
  if (!fs.existsSync(filepath)) err(`文件不存在: ${filepath}`);
  const buf = fs.readFileSync(filepath);
  const r = await post('/api/voice/stt', { audio: buf.toString('base64'), filename: path.basename(filepath) });
  if (r.skipped) return;
  if (r.status !== 200) err(`STT 失败: ${JSON.stringify(r.data)}`);
  out({ text: r.data.text });
}

// ── 用户 ──────────────────────────────────────────────────────────────────

async function cmdMe(args) {
  if (args[0] === 'patch') {
    const rest = args.slice(1).join(' ');
    let body;
    try { body = JSON.parse(rest); } catch { err('patch 需要 JSON: chat-book me patch \'{"nickname":"..."}\''); }
    const r = await patch('/api/user/me', body);
    if (r.skipped) return;
    const u = r.data.user ?? r.data;
    out(r.data);
  } else {
    const r = await get('/api/user/me');
      if (r.skipped) return;
      const u = r.data.user ?? r.data;
      if (opts.json) { out(r.data); return; }
      console.log(`用户ID: ${u.id}`);
      console.log(`昵称: ${u.nickname ?? '(未设置)'}`);
      if (u.created_at) console.log(`创建时间: ${u.created_at}`);
  }
}

async function cmdSettings(args) {
  if (args[0] === 'set' && args[1] && args[2]) {
    const key = args[1], val = args[2];
    const r = await patch('/api/user/me/settings', { [key]: val });
    if (r.skipped) return;
    out(r.data);
  } else {
    const r = await get('/api/user/me/settings');
    if (r.skipped) return;
    out(r.data);
  }
}

// ── 书籍上传 ──────────────────────────────────────────────────────────────

async function cmdUpload(args) {
  const [filePath] = args;
  if (!filePath) err('用法: chat-book upload <file_path> (支持 epub/pdf/txt/mobi/docx)');
  if (!fs.existsSync(filePath)) err(`文件不存在: ${filePath}`);
  console.log(`上传中: ${filePath}`);
  const r = await upload('/api/books/upload', filePath);
  if (r.skipped) return;
  if (r.status !== 200) err(`上传失败 (${r.status}): ${JSON.stringify(r.data)}`);
  out(r.data);
}

async function cmdDrafts() {
  const r = await get('/api/books/drafts');
  if (r.skipped) return;
  const drafts = r.data.drafts ?? r.data ?? [];
  if (opts.json) { out(r.data); return; }
  if (!drafts.length) { console.log('  (无草稿)'); return; }
  drafts.forEach(d => console.log(`  ${(d.id ?? d.draft_id ?? '').padEnd(10)} ${d.title ?? d.filename ?? ''} [${d.status ?? 'draft'}]`));
}

async function cmdDraft(args) {
  const [draftId] = args;
  if (!draftId) err('用法: chat-book draft <draft_id>');
  const r = await get(`/api/books/draft/${draftId}`);
  if (r.skipped) return;
  out(r.data);
}

async function cmdDraftGenerate(args) {
  const [draftId, sync] = args;
  if (!draftId) err('用法: chat-book draft generate <draft_id> [sync]');
  const endpoint = sync ? '/api/books/draft' : `/api/books/draft/${draftId}/generate`;
  const r = sync
    ? await post(`/api/books/draft/${draftId}/generate-sync`, {})
    : await post(`/api/books/draft/${draftId}/generate`, {});
  if (r.skipped) return;
  out(r.data);
}

async function cmdDraftConfirm(args) {
  const [draftId] = args;
  if (!draftId) err('用法: chat-book draft confirm <draft_id>');
  const r = await post(`/api/books/draft/${draftId}/confirm`, {});
  if (r.skipped) return;
  out(r.data);
}

async function cmdDraftRm(args) {
  const [draftId] = args;
  if (!draftId) err('用法: chat-book draft rm <draft_id>');
  const r = await del(`/api/books/draft/${draftId}`);
  if (r.skipped) return;
  out(r.data);
}

async function cmdDraftUpdateConfig(args) {
  // chat-book draft config <draft_id> <json_config>
  const [draftId, ...rest] = args;
  if (!draftId) err('用法: chat-book draft config <draft_id> <json_config>');
  const confStr = rest.join(' ');
  let conf;
  try { conf = JSON.parse(confStr); } catch { err('config 需要 JSON: chat-book draft config <id> \'{"name":"...","author":"..."}\''); }
  const r = await put(`/api/books/draft/${draftId}/config`, conf);
  if (r.skipped) return;
  out(r.data);
}

async function cmdUploadedBooks() {
  const r = await get('/api/user/uploaded-books');
  if (r.skipped) return;
  const books = r.data.books ?? r.data ?? [];
  if (opts.json) { out(r.data); return; }
  if (!books.length) { console.log('  (无上传书籍)'); return; }
  books.forEach(b => console.log(`  ${(b.id ?? '').padEnd(22)} ${b.title ?? b.filename ?? ''} [${b.status ?? 'uploaded'}]`));
}

// ── 帮助 ───────────────────────────────────────────────────────────────────

const HELP = `聊书 CLI v0.1.0

用法: chat-book <command> [args] [options]

认证:
  login <用户名> <密码>        登录（Token 保存至 ~/.chat-book_token）
  register <用户名> <密码>     注册并登录
  logout                        清除本地 Token
  whoami                        显示当前登录用户

书籍浏览:
  books                          列出内置书籍
  book <book_id>                 书籍详情
  search <query>                 全局搜索

书架管理:
  shelf                          查看书架
  shelf add <book_id>            添加书籍到书架
  shelf start <book_id>          开始阅读
  shelf finish <book_id>         标记已完成
  shelf remove <book_id>         从书架移除

章节对话:
  chapter start <id> <ch>        开始章节对话
  chapter message <id> <ch> <msg>  发送消息
  chapter note <id> <ch>          获取章节笔记
  chapter review <id> <ch>       章节回顾
  chapter resume <id> <ch>        恢复章节对话
  chapter dialogue <id> <ch>      获取对话历史
  chapter close <id> <ch>         关闭章节

整书:
  overview <book_id>             阅读概览（含章节进度）
  book-note <book_id>             整书笔记
  export <book_id> [md|pdf]       导出笔记(默认md)

语音:
  voice tts <text> [--author <n>] 文字转语音
  voice stt <audio_file>          语音转文字

用户:
  me                             查看用户信息
  me patch '<json>'               更新用户信息
  settings                       查看设置
  settings set <key> <val>        更新单项设置

上传书籍:
  upload <file_path>              上传书籍文件
  drafts                          列出草稿
  draft <draft_id>                草稿详情
  draft generate <draft_id> [sync]  生成智能体（加 sync 同步等待）
  draft confirm <draft_id>        确认并入库
  draft config <draft_id> '<json>'  更新草稿配置
  draft rm <draft_id>             删除草稿
  uploaded-books                  列出已上传书籍

其他:
  health                          健康检查
  help                            显示本帮助

全局选项:
  --host <url>   API 主机 (默认 http://localhost:3000)
  --user <id>    用户 ID (默认 demo)
  --token <tok> Bearer Token（默认从 ~/.chat-book_token 读取）
  --json         JSON 格式化输出
  --curl         仅打印 curl 命令，不发请求

示例:
  chat-book books
  chat-book shelf add 7habits
  chat-book chapter start 7habits 1
  chat-book chapter message 7habits 1 "请介绍一下这一章的核心观点"
  chat-book chapter note 7habits 1
  chat-book overview 7habits
  chat-book export 7habits pdf
  chat-book voice tts "你好，世界" --author Stephen Covey
  chat-book upload ./my-book.epub
  chat-book draft generate abc123 sync
  chat-book me
  chat-book settings set theme dark
  chat-book --host http://prod:3000 --user alice books
  chat-book health --curl
`;

// ── 命令路由 ───────────────────────────────────────────────────────────────

async function run() {
  switch (cmd) {
    case undefined:
    case 'help':
    case '--help':
    case '-h':
      console.log(HELP);
      break;

    // 健康 / 书籍
    case 'health':       await cmdHealth(); break;
    case 'login':       await cmdLogin(cmdArgs); break;
    case 'register':    await cmdRegister(cmdArgs); break;
    case 'logout':      clearToken(); console.log('已退出登录，token 已清除'); break;
    case 'whoami':      await cmdWhoami(cmdArgs); break;
    case 'books':        await cmdBooks(); break;
    case 'book':         await cmdBook(cmdArgs); break;
    case 'search':       await cmdSearch(cmdArgs); break;

    // 书架
    case 'shelf': {
      const [sub, ...rest] = cmdArgs;
      if (!sub || sub === 'list') await cmdShelf();
      else if (sub === 'add')    await cmdShelfAdd(rest);
      else if (sub === 'start')  await cmdShelfStart(rest);
      else if (sub === 'finish') await cmdShelfFinish(rest);
      else if (sub === 'remove') await cmdShelfRemove(rest);
      else err('shelf 子命令: list | add | start | finish | remove');
      break;
    }

    // 章节
    case 'chapter': {
      const [sub, ...rest] = cmdArgs;
      if (!sub) err('chapter: start | message | note | review | resume | dialogue | close');
      else if (sub === 'start')   await cmdChapterStart(rest);
      else if (sub === 'message') await cmdChapterMessage(rest);
      else if (sub === 'note')    await cmdChapterNote(rest);
      else if (sub === 'review') await cmdChapterReview(rest);
      else if (sub === 'resume')  await cmdChapterResume(rest);
      else if (sub === 'dialogue') await cmdChapterDialogue(rest);
      else if (sub === 'close')  await cmdChapterClose(rest);
      else err('chapter: start | message | note | review | resume | dialogue | close');
      break;
    }

    // 整书
    case 'book-note':    await cmdBookNote(cmdArgs); break;
    case 'overview':    await cmdOverview(cmdArgs); break;
    case 'export':      await cmdExport(cmdArgs); break;

    // 语音
    case 'voice': {
      const [sub, ...rest] = cmdArgs;
      if (sub === 'tts') await cmdVoiceTts(rest);
      else if (sub === 'stt') await cmdVoiceStt(rest);
      else err('voice: tts | stt');
      break;
    }

    // 用户
    case 'me':          await cmdMe(cmdArgs); break;
    case 'settings':    await cmdSettings(cmdArgs); break;

    // 上传
    case 'upload':      await cmdUpload(cmdArgs); break;
    case 'drafts':      await cmdDrafts(); break;
    case 'draft': {
      const [sub, ...rest] = cmdArgs;
      if (!sub) err('draft: <draft_id> | generate | confirm | config | rm');
      if (sub === 'generate') await cmdDraftGenerate(rest);
      else if (sub === 'confirm') await cmdDraftConfirm(rest);
      else if (sub === 'config') await cmdDraftUpdateConfig(rest);
      else if (sub === 'rm') await cmdDraftRm(rest);
      else await cmdDraft(cmdArgs); // sub is actually draft_id
      break;
    }
    case 'uploaded-books': await cmdUploadedBooks(); break;

    default:
      err(`未知命令: ${cmd}\n运行 'chat-book help' 查看帮助`);
  }
}

run().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });