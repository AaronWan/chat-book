// V1.0 新增路由:文件上传、自建作者智能体、设置、扩展搜索
import { Router } from 'express';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { config } from './config.js';
import * as storage from './storage.js';
import { parseFile } from './file-parser.js';
import { generateAgentFromText, generateChaptersFromText } from './agent-generator.js';
import { clearAgentCache, getBook, getAgent } from './catalog.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import { getUserId } from './auth.js';

const router = Router();

// ===================== 上传配置 =====================
const UPLOAD_DIR = path.join(config.dataDir, 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage_multer = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const safeName = Buffer.from(file.originalname, 'latin1').toString('utf8').replace(/[^\w\u4e00-\u9fa5.-]/g, '_');
    const ext = path.extname(safeName);
    const base = path.basename(safeName, ext);
    cb(null, `${Date.now()}_${base}${ext}`);
  }
});

const upload = multer({
  storage: storage_multer,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (['.pdf', '.epub', '.txt'].includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`不支持的文件类型: ${ext}。仅支持 PDF/EPUB/TXT`));
    }
  }
});

// ===================== 上传文件 =====================
router.post('/books/upload', upload.single('file'), async (req, res) => {
  const userId = getUserId(req);
  if (!req.file) return res.status(400).json({ error: '请上传文件' });

  // 用户提交的元数据
  const { book_title, book_author, user_notes = '' } = req.body;

  // 解析文件
  let parsed;
  try {
    parsed = await parseFile(req.file.path, req.file.mimetype);
  } catch (e) {
    fs.unlinkSync(req.file.path);
    return res.status(500).json({ error: '文件解析失败: ' + e.message });
  }

  if (parsed.text.length < 500) {
    fs.unlinkSync(req.file.path);
    return res.status(400).json({ error: '文件内容过短,无法生成作者智能体' });
  }

  // 创建草稿 ID
  const draftId = `draft_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const bookId = `user_${userId}_${Date.now()}`;

  // 立即保存草稿(stage: uploaded)
  const draft = {
    id: draftId,
    user_id: userId,
    book_id: bookId,
    stage: 'uploaded', // uploaded → parsed → config_generated → chapters_generated → confirmed
    progress: 10,
    book_title: book_title || path.basename(req.file.originalname, path.extname(req.file.originalname)),
    book_author: book_author || '未知作者',
    file_path: req.file.path,
    file_format: parsed.format,
    file_size: req.file.size,
    text_length: parsed.text.length,
    user_notes,
    book_text: parsed.text, // 保存完整文本(后续生成用)
    book_metadata: parsed.metadata,
    agent_config: null,
    chapters: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  storage.saveAgentDraft(userId, draft);

  res.json({
    draft_id: draftId,
    book_id: bookId,
    stage: draft.stage,
    progress: draft.progress,
    book_title: draft.book_title,
    book_author: draft.book_author,
    file_format: parsed.format,
    text_length: parsed.text.length
  });
});

// ===================== 异步生成(通过 SSE 流式进度) =====================
router.get('/books/draft/:draft_id/generate', async (req, res) => {
  const userId = getUserId(req);
  const draft = storage.getAgentDraft(userId, req.params.draft_id);
  if (!draft) return res.status(404).json({ error: '草稿不存在' });
  if (draft.stage === 'confirmed') return res.status(400).json({ error: '草稿已确认' });

  // SSE 设置
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  function send(event, data) {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  }

  try {
    // 阶段 1: 解析(已完成)
    send('progress', { stage: 'parsed', progress: 20, message: '文件已解析' });

    // 阶段 2: 生成作者智能体配置
    draft.stage = 'config_generating';
    draft.progress = 30;
    storage.saveAgentDraft(userId, draft);
    send('progress', { stage: 'config_generating', progress: 30, message: '正在分析作者思想体系...' });

    const agentConfig = await generateAgentFromText({
      bookTitle: draft.book_title,
      bookAuthor: draft.book_author,
      bookText: draft.book_text,
      userNotes: draft.user_notes
    });

    draft.agent_config = agentConfig;
    draft.progress = 70;
    draft.stage = 'config_generated';
    storage.saveAgentDraft(userId, draft);
    send('progress', { stage: 'config_generated', progress: 70, message: '作者智能体配置已生成' });
    send('config', { agent_config: agentConfig });

    // 阶段 3: 生成章节
    draft.stage = 'chapters_generating';
    draft.progress = 80;
    storage.saveAgentDraft(userId, draft);
    send('progress', { stage: 'chapters_generating', progress: 80, message: '正在分析章节命题...' });

    const chapters = await generateChaptersFromText({
      bookText: draft.book_text,
      bookTitle: draft.book_title
    });

    draft.chapters = chapters;
    draft.progress = 100;
    draft.stage = 'awaiting_confirmation';
    storage.saveAgentDraft(userId, draft);
    send('progress', { stage: 'awaiting_confirmation', progress: 100, message: '生成完成,请确认' });
    send('chapters', { chapters });

    send('done', { draft_id: draft.id });
    res.end();
  } catch (e) {
    console.error('[generate] 错误:', e);
    send('error', { message: e.message });
    res.end();
  }
});

// ===================== 同步生成(简化版本,不用 SSE) =====================
router.post('/books/draft/:draft_id/generate-sync', async (req, res) => {
  const userId = getUserId(req);
  const draft = storage.getAgentDraft(userId, req.params.draft_id);
  if (!draft) return res.status(404).json({ error: '草稿不存在' });
  if (draft.stage === 'confirmed') return res.status(400).json({ error: '草稿已确认' });

  try {
    // 阶段 1: 生成配置
    draft.stage = 'config_generating';
    draft.progress = 30;
    storage.saveAgentDraft(userId, draft);

    const agentConfig = await generateAgentFromText({
      bookTitle: draft.book_title,
      bookAuthor: draft.book_author,
      bookText: draft.book_text,
      userNotes: draft.user_notes
    });

    draft.agent_config = agentConfig;
    draft.progress = 70;
    draft.stage = 'chapters_generating';
    storage.saveAgentDraft(userId, draft);

    // 阶段 2: 生成章节
    const chapters = await generateChaptersFromText({
      bookText: draft.book_text,
      bookTitle: draft.book_title
    });

    draft.chapters = chapters;
    draft.progress = 100;
    draft.stage = 'awaiting_confirmation';
    storage.saveAgentDraft(userId, draft);

    res.json({
      draft_id: draft.id,
      stage: draft.stage,
      progress: 100,
      agent_config: agentConfig,
      chapters
    });
  } catch (e) {
    console.error('[generate-sync] 错误:', e);
    res.status(500).json({ error: '生成失败: ' + e.message });
  }
});

// ===================== 草稿管理 =====================
router.get('/books/draft/:draft_id', (req, res) => {
  const userId = getUserId(req);
  const draft = storage.getAgentDraft(userId, req.params.draft_id);
  if (!draft) return res.status(404).json({ error: '草稿不存在' });

  // 不返回完整文本(太大)
  const { book_text, ...rest } = draft;
  res.json({ draft: rest });
});

router.get('/books/drafts', (req, res) => {
  const userId = getUserId(req);
  const drafts = storage.listAgentDrafts(userId);
  const cleaned = drafts.map(({ book_text, ...rest }) => rest);
  res.json({ drafts: cleaned });
});

router.put('/books/draft/:draft_id/config', (req, res) => {
  const userId = getUserId(req);
  const draft = storage.getAgentDraft(userId, req.params.draft_id);
  if (!draft) return res.status(404).json({ error: '草稿不存在' });
  const { agent_config, chapters } = req.body;
  if (agent_config) draft.agent_config = agent_config;
  if (chapters) draft.chapters = chapters;
  draft.updated_at = new Date().toISOString();
  storage.saveAgentDraft(userId, draft);
  res.json({ draft: { id: draft.id, stage: draft.stage, agent_config: draft.agent_config, chapters: draft.chapters } });
});

router.delete('/books/draft/:draft_id', (req, res) => {
  const userId = getUserId(req);
  const draft = storage.getAgentDraft(userId, req.params.draft_id);
  if (draft?.file_path && fs.existsSync(draft.file_path)) {
    try { fs.unlinkSync(draft.file_path); } catch {}
  }
  storage.deleteAgentDraft(userId, req.params.draft_id);
  res.json({ ok: true });
});

// ===================== 确认草稿 → 创建作者智能体 + 加入书架 =====================
router.post('/books/draft/:draft_id/confirm', (req, res) => {
  const userId = getUserId(req);
  const draft = storage.getAgentDraft(userId, req.params.draft_id);
  if (!draft) return res.status(404).json({ error: '草稿不存在' });
  if (!draft.agent_config || !draft.chapters) {
    return res.status(400).json({ error: '草稿尚未完成生成' });
  }

  // 1. 保存作者智能体配置
  const agentFile = `agent-${draft.book_id}.json`;
  const agentPath = path.join(config.dataDir, 'agents', agentFile);
  const authorName = draft.agent_config.author_name || draft.book_author;

  const agentRecord = {
    book_id: draft.book_id,
    author: {
      name: authorName,
      name_en: '',
      born_died: '',
      bio: draft.user_notes || `${authorName}的作品《${draft.book_title}》`,
      other_books: [],
      writing_background: `由用户上传《${draft.book_title}》后,系统自动生成。`
    },
    thought_system: draft.agent_config.thought_system,
    style: draft.agent_config.style,
    guide: draft.agent_config.guide,
    challenge: draft.agent_config.challenge,
    boundary: draft.agent_config.boundary,
    chapters: draft.chapters,
    _user_uploaded: true,
    _user_id: userId
  };

  fs.writeFileSync(agentPath, JSON.stringify(authorRecord, null, 2));

  // 2. 保存用户上传书信息
  const bookRecord = {
    id: draft.book_id,
    title: draft.book_title,
    author: authorName,
    publisher: '用户上传',
    isbn: null,
    cover_color: pickRandomColor(draft.book_id),
    category: '用户上传',
    chapter_count: draft.chapters.length,
    total_words: draft.text_length,
    status: '用户上传',
    summary: `用户上传的书。由 AI 提取的作者智能体配置。`,
    agent_file: agentFile,
    is_user_uploaded: true,
    uploaded_by: userId,
    uploaded_at: new Date().toISOString(),
    file_format: draft.file_format
  };

  storage.saveUserBook(bookRecord);

  // 3. 清空缓存
  clearAgentCache();

  // 4. 加入用户书架
  storage.addToShelf(userId, draft.book_id, '想聊', {
    is_user_uploaded: true,
    custom_agent: true
  });

  // 5. 标记草稿为已确认
  draft.stage = 'confirmed';
  draft.confirmed_at = new Date().toISOString();
  storage.saveAgentDraft(userId, draft);

  // 6. 清理文件(可选,也可以保留以便重新生成)
  // if (draft.file_path && fs.existsSync(draft.file_path)) {
  //   try { fs.unlinkSync(draft.file_path); } catch {}
  // }

  res.json({
    book_id: draft.book_id,
    book: bookRecord,
    confirmed: true
  });
});

function pickRandomColor(seed) {
  const colors = ['#3B5998', '#8B4513', '#2F4F4F', '#B22222', '#228B22', '#4682B4', '#A0522D', '#DC143C', '#708090', '#FF8C00', '#483D8B', '#556B2F'];
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) & 0xffffffff;
  return colors[Math.abs(hash) % colors.length];
}

// ===================== 用户上传的书列表 =====================
router.get('/user/uploaded-books', (req, res) => {
  const userId = getUserId(req);
  const books = storage.listUserBooks(userId);
  res.json({ books });
});

// ===================== 用户信息 =====================
router.get('/user/me', (req, res) => {
  const userId = getUserId(req);
  const user = storage.getUser(userId);
  if (!user) return res.status(404).json({ error: '用户不存在' });
  res.json({ user });
});

router.patch('/user/me', (req, res) => {
  const userId = getUserId(req);
  const updated = storage.updateUser(userId, req.body);
  res.json({ user: updated });
});

// ===================== 用户设置 =====================
router.get('/user/me/settings', (req, res) => {
  const userId = getUserId(req);
  const user = storage.getUser(userId);
  if (!user) return res.status(404).json({ error: '用户不存在' });
  res.json({ settings: user.settings || {} });
});

router.patch('/user/me/settings', (req, res) => {
  const userId = getUserId(req);
  const settings = storage.updateUserSettings(userId, req.body);
  res.json({ settings });
});

router.get('/user/settings', (req, res) => {
  const userId = getUserId(req);
  const user = storage.ensureUser(userId);
  res.json({ settings: user.settings });
});

router.put('/user/settings', (req, res) => {
  const userId = getUserId(req);
  const settings = storage.updateUserSettings(userId, req.body);
  res.json({ settings });
});

// 单书设置(保存到书架条目的 settings 字段)
router.get('/user/book/:book_id/settings', (req, res) => {
  const userId = getUserId(req);
  const entry = storage.getUserBook(userId, req.params.book_id);
  res.json({ settings: entry?.settings || {} });
});

router.put('/user/book/:book_id/settings', (req, res) => {
  const userId = getUserId(req);
  const entry = storage.updateShelfEntry(userId, req.params.book_id, { settings: req.body });
  res.json({ settings: entry?.settings || {} });
});

// ===================== 扩展搜索(支持多条件) =====================
router.get('/user/search', (req, res) => {
  const userId = getUserId(req);
  const q = (req.query.q || '').trim();
  const bookIdFilter = req.query.book_id;
  const roleFilter = req.query.role; // 'user' | 'author' | 不限
  const chapterFilter = req.query.chapter_index ? parseInt(req.query.chapter_index, 10) : null;
  const limit = Math.min(parseInt(req.query.limit || '50', 10), 200);

  if (!q) return res.json({ results: [] });

  const user = storage.ensureUser(userId);
  const results = [];

  for (const entry of user.shelf || []) {
    if (bookIdFilter && entry.book_id !== bookIdFilter) continue;
    const book = getBook(entry.book_id);
    if (!book) continue;
    const userChapters = storage.getUserChapters(userId, entry.book_id);
    for (const uc of userChapters) {
      if (chapterFilter && uc.chapter_index !== chapterFilter) continue;
      const dialogue = storage.getDialogue(userId, entry.book_id, uc.chapter_index);
      dialogue.forEach((m, i) => {
        if (roleFilter && m.role !== roleFilter) return;
        if (m.content.includes(q)) {
          const idx = m.content.indexOf(q);
          results.push({
            book_id: entry.book_id,
            book_title: book.title,
            book_author: book.author,
            chapter_index: uc.chapter_index,
            message_id: m.id,
            role: m.role,
            snippet: m.content.slice(Math.max(0, idx - 40), idx + q.length + 40),
            full_content: m.content,
            created_at: m.created_at
          });
        }
      });
    }
  }

  // 笔记搜索
  if (!bookIdFilter || true) {
    const notesDir = path.join(config.dataDir, 'notes');
    if (fs.existsSync(notesDir)) {
      for (const fname of fs.readdirSync(notesDir)) {
        if (!fname.startsWith(userId)) continue;
        const match = fname.match(/^([^_]+)__([^_]+)__(ch\d+|book)\.json$/);
        if (!match) continue;
        const [, _u, book_id, ch] = match;
        if (bookIdFilter && book_id !== bookIdFilter) continue;
        const note = JSON.parse(fs.readFileSync(path.join(notesDir, fname), 'utf-8'));
        const contentStr = JSON.stringify(note.content);
        if (contentStr.includes(q)) {
          const book = getBook(book_id);
          if (!book) continue;
          const idx = contentStr.indexOf(q);
          results.push({
            book_id,
            book_title: book.title,
            book_author: book.author,
            chapter_index: ch.startsWith('ch') ? parseInt(ch.slice(2), 10) : null,
            message_id: null,
            role: 'note',
            snippet: contentStr.slice(Math.max(0, idx - 40), idx + q.length + 40),
            full_content: contentStr.slice(0, 500),
            created_at: note.updated_at
          });
        }
      }
    }
  }

  // 按时间倒序
  results.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  res.json({
    results: results.slice(0, limit),
    total: results.length
  });
});

export default router;
