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
  if (!fs.existsSync(agentPath)) return null;
  const agent = JSON.parse(fs.readFileSync(agentPath, 'utf-8'));
  _agents.set(bookId, agent);
  return agent;
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
