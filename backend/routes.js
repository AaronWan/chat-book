// Express 路由
import { Router } from 'express';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { getBuiltinBooks, getBook, getAgent, getChapter } from './catalog.js';
import * as storage from './storage.js';
import { authorReply, authorOpening, generateChapterNote, generateBookNote } from './agent-engine.js';
import { getUserId } from './auth.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pythonBin = process.env.PYTHON_BIN || '/Users/wansong/.hermes/hermes-agent/venv/bin/python3';

const router = Router();

// ============= 内置书库 =============
router.get('/books', (req, res) => {
  res.json({ books: getBuiltinBooks() });
});

router.get('/books/:id', (req, res) => {
  const book = getBook(req.params.id);
  if (!book) return res.status(404).json({ error: '书不存在' });
  res.json({ book });
});

router.get('/books/:id/agent', (req, res) => {
  const agent = getAgent(req.params.id);
  if (!agent) return res.status(404).json({ error: '作者智能体不存在' });
  res.json({ agent });
});

router.get('/books/:id/chapters/:index', (req, res) => {
  const chapter = getChapter(req.params.id, parseInt(req.params.index, 10));
  if (!chapter) return res.status(404).json({ error: '章节不存在' });
  res.json({ chapter });
});

// ============= 用户书架 =============
router.get('/user/shelf', (req, res) => {
  const userId = getUserId(req);
  const user = storage.ensureUser(userId);
  const shelf = user.shelf || [];
  // 关联书籍详情
  const result = shelf.map((entry) => {
    const book = getBook(entry.book_id);
    return {
      ...entry,
      book
    };
  });
  res.json({ shelf: result });
});

router.post('/user/shelf/add', (req, res) => {
  const userId = getUserId(req);
  const { book_id, status = '想聊' } = req.body;
  if (!book_id) return res.status(400).json({ error: 'book_id 必填' });
  const book = getBook(book_id);
  if (!book) return res.status(404).json({ error: '书不存在' });
  const entry = storage.addToShelf(userId, book_id, status);
  res.json({ entry });
});

router.post('/user/shelf/start', (req, res) => {
  const userId = getUserId(req);
  const { book_id } = req.body;
  if (!book_id) return res.status(400).json({ error: 'book_id 必填' });
  const entry = storage.updateShelfEntry(userId, book_id, {
    status: '进行中',
    started_at: new Date().toISOString()
  });
  res.json({ entry });
});

router.post('/user/shelf/finish', (req, res) => {
  const userId = getUserId(req);
  const { book_id } = req.body;
  if (!book_id) return res.status(400).json({ error: 'book_id 必填' });
  const entry = storage.updateShelfEntry(userId, book_id, {
    status: '已聊完',
    progress_percent: 100
  });
  res.json({ entry });
});

router.delete('/user/shelf/:book_id', (req, res) => {
  const userId = getUserId(req);
  storage.removeFromShelf(userId, req.params.book_id);
  res.json({ ok: true });
});

// ============= 单书章节信息 =============
router.get('/user/book/:book_id/overview', (req, res) => {
  const userId = getUserId(req);
  const { book_id } = req.params;
  const book = getBook(book_id);
  if (!book) return res.status(404).json({ error: '书不存在' });
  const agent = getAgent(book_id);
  if (!agent) return res.status(404).json({ error: '智能体不存在' });
  const shelf = storage.getUserBook(userId, book_id);
  const userChapters = storage.getUserChapters(userId, book_id);
  // 把 userChapters 按 chapter_index 索引
  const chMap = new Map(userChapters.map((c) => [c.chapter_index, c]));
  const chapters = agent.chapters.map((c) => {
    const uc = chMap.get(c.index);
    return {
      index: c.index,
      title: c.title,
      proposition: c.proposition,
      status: uc?.status || '未开启',
      dialogue_turns: uc?.dialogue_turns || 0,
      last_message_id: uc?.last_message_id || null
    };
  });

  // 计算进度
  const completed = chapters.filter((c) => c.status === '已聊完').length;
  const progress_percent = Math.round((completed / chapters.length) * 100);

  res.json({
    book,
    agent_meta: { name: agent.author.name, bio: agent.author.bio },
    shelf,
    chapters,
    progress_percent
  });
});

// ============= 章节对话 =============

// 开启章节(返回开场白)
router.post('/user/chapter/start', async (req, res) => {
  const userId = getUserId(req);
  const { book_id, chapter_index } = req.body;
  if (!book_id || !chapter_index) return res.status(400).json({ error: '参数缺失' });

  const agent = getAgent(book_id);
  const chapter = getChapter(book_id, chapter_index);
  if (!agent || !chapter) return res.status(404).json({ error: '智能体或章节不存在' });

  const user = storage.ensureUser(userId);
  const language = user.settings?.language || 'zh';

  const userChapter = storage.ensureUserChapter(userId, book_id, chapter_index);
  const existingDialogue = storage.getDialogue(userId, book_id, chapter_index);

  // 如果是新章节,生成开场白
  if (existingDialogue.length === 0) {
    try {
      const opening = await authorOpening({ agent, chapter, state: userChapter, language });
      const msg = storage.appendDialogueMessage(userId, book_id, chapter_index, {
        role: 'author',
        content: opening
      });
      storage.updateUserChapter(userId, book_id, chapter_index, {
        last_message_id: msg.id,
        dialogue_turns: 1
      });
      return res.json({ message: msg, dialogue: storage.getDialogue(userId, book_id, chapter_index) });
    } catch (e) {
      return res.status(500).json({ error: 'LLM 开场失败: ' + e.message });
    }
  }

  // 已有对话,直接返回
  res.json({ dialogue: existingDialogue });
});

// 发送消息(用户 → 作者)
router.post('/user/chapter/message', async (req, res) => {
  const userId = getUserId(req);
  const { book_id, chapter_index, content } = req.body;
  if (!book_id || !chapter_index || !content) return res.status(400).json({ error: '参数缺失' });

  const agent = getAgent(book_id);
  const chapter = getChapter(book_id, chapter_index);
  if (!agent || !chapter) return res.status(404).json({ error: '智能体或章节不存在' });

  const user = storage.ensureUser(userId);
  const language = user.settings?.language || 'zh';

  // 1. 存用户消息
  const userMsg = storage.appendDialogueMessage(userId, book_id, chapter_index, { role: 'user', content });

  // 2. 更新章节状态
  const userChapter = storage.ensureUserChapter(userId, book_id, chapter_index);
  storage.updateUserChapter(userId, book_id, chapter_index, {
    dialogue_turns: (userChapter.dialogue_turns || 0) + 1,
    last_message_id: userMsg.id
  });

  // 3. 获取历史
  const dialogue = storage.getDialogue(userId, book_id, chapter_index);
  const updatedChapter = storage.getUserChapter(userId, book_id, chapter_index);

  // 4. 调用 LLM
  try {
    const reply = await authorReply({
      agent,
      chapter,
      dialogueHistory: dialogue,
      state: {
        explored_angles: updatedChapter.explored_angles || [],
        pending_questions: updatedChapter.pending_questions || []
      },
      language
    });

    // 5. 存作者消息
    const authorMsg = storage.appendDialogueMessage(userId, book_id, chapter_index, { role: 'author', content: reply });
    storage.updateUserChapter(userId, book_id, chapter_index, {
      last_message_id: authorMsg.id
    });

    res.json({ user_message: userMsg, author_message: authorMsg, dialogue: storage.getDialogue(userId, book_id, chapter_index) });
  } catch (e) {
    console.error('[message] LLM 错误:', e.message);
    res.status(500).json({ error: 'LLM 调用失败: ' + e.message, user_message: userMsg });
  }
});

// 快速 Resume:获取最近对话 + 待续问题
router.get('/user/chapter/:book_id/:chapter_index/resume', (req, res) => {
  const userId = getUserId(req);
  const { book_id, chapter_index } = req.params;
  const dialogue = storage.getDialogue(userId, book_id, parseInt(chapter_index, 10));
  const userChapter = storage.getUserChapter(userId, book_id, parseInt(chapter_index, 10));
  const agent = getAgent(book_id);
  const chapter = getChapter(book_id, parseInt(chapter_index, 10));

  // 最后 3-5 轮对话
  const recent = dialogue.slice(-6);

  // 待聊话题
  const pending = userChapter?.pending_questions || [];

  // 章节未展开的命题
  const allProps = chapter?.key_questions || [];
  const explored = userChapter?.explored_angles || [];
  const remaining = allProps.filter((q) => !explored.includes(q));

  res.json({
    recent_dialogue: recent,
    pending_questions: pending,
    remaining_topics: remaining,
    status: userChapter?.status || '未开启',
    dialogue_turns: userChapter?.dialogue_turns || 0
  });
});

// 收尾章节(生成聊书笔记)
router.post('/user/chapter/close', async (req, res) => {
  const userId = getUserId(req);
  const { book_id, chapter_index } = req.body;
  if (!book_id || !chapter_index) return res.status(400).json({ error: '参数缺失' });

  const agent = getAgent(book_id);
  const chapter = getChapter(book_id, chapter_index);
  if (!agent || !chapter) return res.status(404).json({ error: '智能体或章节不存在' });

  const dialogue = storage.getDialogue(userId, book_id, chapter_index);
  if (dialogue.length < 2) return res.status(400).json({ error: '对话轮数过少,无法生成笔记' });

  const user = storage.ensureUser(userId);
  const language = user.settings?.language || 'zh';

  try {
    const noteContent = await generateChapterNote({ agent, chapter, dialogueHistory: dialogue, language });
    const note = storage.saveNote(userId, book_id, chapter_index, noteContent);

    // 更新章节状态
    storage.updateUserChapter(userId, book_id, chapter_index, {
      status: '已聊完',
      completed_at: new Date().toISOString()
    });

    // 更新书进度
    const userChapters = storage.getUserChapters(userId, book_id);
    const completed = userChapters.filter((c) => c.status === '已聊完').length;
    const total = agent.chapters.length;
    const progress = Math.round((completed / total) * 100);
    storage.updateShelfEntry(userId, book_id, { progress_percent: progress });

    res.json({ note });
  } catch (e) {
    console.error('[close] 生成笔记失败:', e.message);
    res.status(500).json({ error: '生成笔记失败: ' + e.message });
  }
});

// 章节笔记
router.get('/user/chapter/:book_id/:chapter_index/note', (req, res) => {
  const userId = getUserId(req);
  const { book_id, chapter_index } = req.params;
  const note = storage.getNote(userId, book_id, parseInt(chapter_index, 10));
  res.json({ note });
});

// 章节对话历史
router.get('/user/chapter/:book_id/:chapter_index/dialogue', (req, res) => {
  const userId = getUserId(req);
  const { book_id, chapter_index } = req.params;
  const dialogue = storage.getDialogue(userId, book_id, parseInt(chapter_index, 10));
  res.json({ dialogue });
});

// 章节回顾(章节 + 整书)
router.get('/user/chapter/:book_id/:chapter_index/review', (req, res) => {
  const userId = getUserId(req);
  const { book_id, chapter_index } = req.params;
  const cIdx = parseInt(chapter_index, 10);
  const chapter = getChapter(book_id, cIdx);
  const note = storage.getNote(userId, book_id, cIdx);
  const dialogue = storage.getDialogue(userId, book_id, cIdx);
  res.json({
    chapter,
    note,
    dialogue_summary: {
      total_turns: dialogue.length,
      user_turns: dialogue.filter((m) => m.role === 'user').length,
      author_turns: dialogue.filter((m) => m.role === 'author').length
    }
  });
});

// ============= 整书笔记 =============
router.post('/user/book/:book_id/note/close', async (req, res) => {
  const userId = getUserId(req);
  const { book_id } = req.params;
  const book = getBook(book_id);
  const agent = getAgent(book_id);
  if (!book || !agent) return res.status(404).json({ error: '书不存在' });

  // 收集所有章节笔记
  const userChapters = storage.getUserChapters(userId, book_id);
  const chapterNotes = userChapters
    .filter((c) => c.status === '已聊完')
    .map((c) => {
      const note = storage.getNote(userId, book_id, c.chapter_index);
      return { chapter_index: c.chapter_index, ...note?.content };
    });

  if (chapterNotes.length === 0) return res.status(400).json({ error: '没有已完成的章节' });

  const user = storage.ensureUser(userId);
  const language = user.settings?.language || 'zh';

  try {
    const summary = await generateBookNote({ agent, bookTitle: book.title, chapterNotes, language });
    const totalTurns = userChapters.reduce((sum, c) => sum + (c.dialogue_turns || 0), 0);
    const allInsights = chapterNotes.flatMap((c) => c.core_insights || []);

    const bookNoteContent = {
      reading_info: { duration: '约 X 小时', turns: totalTurns, insights_count: allInsights.length },
      chapter_notes: chapterNotes,
      core_reflections: summary.core_reflections || [],
      action_changes: summary.action_changes || [],
      overall_tone: summary.overall_tone || ''
    };

    const note = storage.saveBookNote(userId, book_id, bookNoteContent);
    storage.updateShelfEntry(userId, book_id, { status: '已聊完', progress_percent: 100 });

    res.json({ note });
  } catch (e) {
    console.error('[book-note] 错误:', e.message);
    res.status(500).json({ error: '整书笔记生成失败: ' + e.message });
  }
});

router.get('/user/book/:book_id/note', (req, res) => {
  const userId = getUserId(req);
  const note = storage.getBookNote(userId, req.params.book_id);
  res.json({ note });
});

// ============= 导出 Markdown / PDF =============
router.get('/user/book/:book_id/export', async (req, res) => {
  const userId = getUserId(req);
  const { book_id } = req.params;
  const fmt = (req.query.format || 'md').toLowerCase();
  const book = getBook(book_id);
  const agent = getAgent(book_id);
  if (!book || !agent) return res.status(404).json({ error: '书不存在' });

  const bookNote = storage.getBookNote(userId, book_id);
  if (!bookNote?.content) return res.status(400).json({ error: '还没有生成整书笔记' });

  const userChapters = storage.getUserChapters(userId, book_id);
  const completed = userChapters.filter((c) => c.status === '已聊完');
  if (completed.length === 0) return res.status(400).json({ error: '还没有完成任何章节' });

  const { content } = bookNote;
  const now = new Date().toLocaleDateString('zh-CN');
  const progress = completed.length;
  const total = agent.chapters.length;

  // 收集章节笔记
  const chapterNotes = completed.map((c) => {
    const note = storage.getNote(userId, book_id, c.chapter_index);
    return { chapter_index: c.chapter_index, ...note?.content };
  });

  // ========== Markdown ==========
  if (fmt === 'md') {
    const lines = [
      `# 《${book.title}》聊书笔记`,
      ``,
      `> 生成时间: ${now} | 阅读进度: ${progress} / ${total} 章`,
      ``,
      `---`,
      ``,
      `## 章节笔记`,
      ``,
    ];
    for (const cn of chapterNotes) {
      const chIdx = cn.chapter_index;
      const chMeta = agent.chapters.find((c) => c.index === chIdx);
      const title = chMeta?.title || `第${chIdx}章`;
      lines.push(`### ${title}`);
      lines.push(``);
      if (cn.core_insights?.length) {
        lines.push(`**核心洞察**：`);
        for (const ins of cn.core_insights) lines.push(`- ${ins}`);
        lines.push(``);
      }
      if (cn.collisions?.length) {
        lines.push(`**延伸思考**：`);
        for (const col of cn.collisions) {
          const text = typeof col === 'string' ? col : col.user || col.author || JSON.stringify(col);
          lines.push(`- ${text}`);
        }
        lines.push(``);
      }
    }
    if (content.core_reflections?.length) {
      lines.push(`---\n\n## 全书总评\n`);
      for (const r of content.core_reflections) lines.push(`- ${r}`);
      lines.push(``);
    }
    if (content.action_changes?.length) {
      lines.push(`---\n\n## 行动改变\n`);
      for (const a of content.action_changes) lines.push(`- ${a}`);
      lines.push(``);
    }
    lines.push(`---\n*由聊书生成 · ${now}*`);
    return res.type('text/markdown; charset=utf-8').send(lines.join('\n'));
  }

  // ========== PDF (Python fpdf2 + 系统中文字体) ==========
  if (fmt === 'pdf') {
    try {
      const pdfData = {
        book_title: book.title,
        book_id,
        progress,
        total,
        now,
        chapter_notes: chapterNotes.map((cn) => {
          const chMeta = agent.chapters.find((c) => c.index === cn.chapter_index);
          return {
            chapter_index: cn.chapter_index,
            title: chMeta?.title || `第${cn.chapter_index}章`,
            core_insights: cn.core_insights || [],
            collisions: (cn.collisions || []).map((col) =>
              typeof col === 'string' ? col : col.user || col.author || JSON.stringify(col)
            ),
          };
        }),
        core_reflections: content.core_reflections || [],
        action_changes: content.action_changes || [],
      };
      const tmpFile = `/tmp/liaoshu_pdf_${Date.now()}_${Math.random().toString(36).slice(2)}.pdf`;
      const py = spawn(pythonBin, [path.join(__dirname, 'pdf_gen.py'), tmpFile], { stdio: ['pipe', 'pipe', 'pipe'] });
      let stderrData = '';
      py.stderr.on('data', (c) => { stderrData += c.toString(); });
      py.on('error', (e) => {
        console.error('[pdf_gen spawn]', e.message);
        res.status(500).json({ error: 'PDF 生成失败' });
      });
      py.on('exit', async (code) => {
        if (res.headersSent) return;
        if (code !== 0) {
          console.error('[pdf_gen exit code]', code, stderrData);
          res.status(500).json({ error: `PDF 生成失败 (code ${code})` });
          return;
        }
        // Read from temp file
        if (!fs.existsSync(tmpFile)) {
          console.error('[pdf_gen no output]', stderrData);
          res.status(500).json({ error: 'PDF 生成器未产生文件' });
          return;
        }
        const buf = fs.readFileSync(tmpFile);
        try { fs.unlinkSync(tmpFile); } catch (_) {} // clean up
        res.type('application/pdf').send(buf);
      });
      py.stdin.write(JSON.stringify(pdfData));
      py.stdin.end();
      return; // async response sent via py 'exit' event
    } catch (e) {
      console.error('[export/pdf]', e.message);
      res.status(500).json({ error: 'PDF 生成失败: ' + e.message });
    }
  }

  res.status(400).json({ error: 'format 必须是 md 或 pdf' });
});

// ============= 搜索 =============
router.get('/user/search', (req, res) => {
  const userId = getUserId(req);
  const q = (req.query.q || '').trim();
  if (!q) return res.json({ results: [] });

  const user = storage.ensureUser(userId);
  const results = [];

  // 遍历用户书架
  for (const entry of user.shelf || []) {
    const book = getBook(entry.book_id);
    if (!book) continue;
    const userChapters = storage.getUserChapters(userId, entry.book_id);
    for (const uc of userChapters) {
      const dialogue = storage.getDialogue(userId, entry.book_id, uc.chapter_index);
      dialogue.forEach((m, i) => {
        if (m.content.includes(q)) {
          results.push({
            book_id: entry.book_id,
            book_title: book.title,
            chapter_index: uc.chapter_index,
            message_id: m.id,
            role: m.role,
            snippet: m.content.slice(Math.max(0, m.content.indexOf(q) - 30), m.content.indexOf(q) + 60),
            full_content: m.content
          });
        }
      });
    }
  }

  res.json({ results });
});

export default router;
