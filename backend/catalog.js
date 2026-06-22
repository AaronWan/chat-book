// 内置书库 + 用户上传书 + 作者智能体加载
import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.js';
import * as storage from './storage.js';

let _books = null;
let _agents = new Map();

export function getBuiltinBooks() {
  if (_books) return _books;
  const p = path.join(config.dataDir, 'books', 'builtin-books.json');
  _books = JSON.parse(fs.readFileSync(p, 'utf-8')).books;
  return _books;
}

export function getBook(bookId) {
  // 先查内置
  const builtin = getBuiltinBooks().find((b) => b.id === bookId);
  if (builtin) return builtin;
  // 再查用户上传
  return storage.getUserBookMeta(bookId);
}

export function getAgent(bookId) {
  if (_agents.has(bookId)) return _agents.get(bookId);
  const book = getBook(bookId);
  if (!book) return null;
  if (!book.agent_file) return null;
  const agentPath = path.join(config.dataDir, 'agents', book.agent_file);
  if (fs.existsSync(agentPath)) {
    const agent = JSON.parse(fs.readFileSync(agentPath, 'utf-8'));
    _agents.set(bookId, agent);
    return agent;
  }
  // Fallback: 生成最小智能体（仅含必要字段）
  const fallback = buildFallbackAgent(book);
  _agents.set(bookId, fallback);
  return fallback;
}

function buildFallbackAgent(book) {
  const authorName = book.author || '未知作者';
  const bookTitle = book.title || '未知书名';
  const chapterCount = book.chapter_count || 1;
  const chapters = Array.from({ length: chapterCount }, (_, i) => ({
    index: i + 1,
    title: `第${i + 1}章`,
    proposition: `本章讨论${bookTitle}的核心内容。`,
    key_questions: ['你对这个问题有什么看法？', '你在实践中有什么体会？']
  }));
  return {
    author: {
      name: authorName,
      name_en: '',
      bio: `《${bookTitle}》作者。`,
      other_books: [],
      writing_background: `本书是《${bookTitle}》的聊书智能体。`
    },
    thought_system: {
      core_beliefs: [`书籍《${bookTitle}》的核心思想。`],
      key_propositions: {},
      thinking_framework: '深入思考，带读者一起探索。',
      what_author_believes: '开卷有益，思考改变行为。',
      what_author_rejects: '不动脑子的信息灌输。'
    },
    style: {
      language_style: '简洁深刻，善于用故事和比喻讲道理。',
      tone: '启发性',
      favorite_expressions: ['让我们思考一下', '这个问题很有意思'],
      forbidden_expressions: ['我不知道', '这不重要'],
      humor_level: 0.3,
      emotional_range: '温和而深入'
    },
    guide: {
      opening_style: '以一个发人深省的问题开场。',
      how_it_guides: ['引导读者反思', '用案例说明观点'],
      preferred_questions: ['你对这个观点怎么看', '你在实践中有什么体会']
    },
    challenge: {
      when_it_asks: ['当读者理解基本概念后', '当需要深化认识时'],
      how_it_asks: ['追问根本原因', '要求举例说明']
    },
    boundary: {
      scope: '本书内容及相关的学习方法、思维方式的讨论。',
      off_topic_response: '这个问题超出本书范围，建议我们回到书中的核心思想。'
    },
    chapters
  };
}

export function getChapter(bookId, chapterIndex) {
  const agent = getAgent(bookId);
  if (!agent) return null;
  return agent.chapters.find((c) => c.index === chapterIndex) || null;
}

export function clearAgentCache(bookId) {
  if (bookId) {
    _agents.delete(bookId);
  } else {
    _agents.clear();
  }
}
