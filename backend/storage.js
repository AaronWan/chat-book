// 持久化:JSON 文件存储
// 用户数据、对话记录、笔记、上传书籍、草稿

import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.js';

const USERS_DIR = path.join(config.dataDir, 'users');
const DIALOGUES_DIR = path.join(config.dataDir, 'dialogues');
const NOTES_DIR = path.join(config.dataDir, 'notes');
const UPLOADS_DIR = path.join(config.dataDir, 'uploads');
const USER_BOOKS_DIR = path.join(config.dataDir, 'user-books'); // 用户上传的书籍
const DRAFTS_DIR = path.join(config.dataDir, 'drafts');         // 作者智能体草稿

[USERS_DIR, DIALOGUES_DIR, NOTES_DIR, UPLOADS_DIR, USER_BOOKS_DIR, DRAFTS_DIR].forEach((dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

function readJson(p, fallback) {
  if (!fs.existsSync(p)) return fallback;
  return JSON.parse(fs.readFileSync(p, 'utf-8'));
}

function writeJson(p, data) {
  fs.writeFileSync(p, JSON.stringify(data, null, 2));
}

// ===================== 用户 =====================
export function getUser(userId) {
  const p = path.join(USERS_DIR, `${userId}.json`);
  if (!fs.existsSync(p)) return null;
  return readJson(p, null);
}

export function ensureUser(userId) {
  const p = path.join(USERS_DIR, `${userId}.json`);
  if (!fs.existsSync(p)) {
    const user = {
      id: userId,
      nickname: '读者',
      avatar_url: null,
      created_at: new Date().toISOString(),
      settings: {
        reading_goal_minutes_per_day: 30,
        weekly_target_books: 1,
        notifications_enabled: true,
        reminder_time: '20:00',
        theme: 'paper'
      }
    };
    writeJson(p, user);
    return user;
  }
  return readJson(p, null);
}

export function updateUser(userId, patch) {
  const user = ensureUser(userId);
  const updated = { ...user, ...patch };
  const p = path.join(USERS_DIR, `${userId}.json`);
  writeJson(p, updated);
  return updated;
}

export function getUserByUsername(username) {
  // 扫描所有用户文件找 username
  if (!fs.existsSync(USERS_DIR)) return null;
  for (const f of fs.readdirSync(USERS_DIR)) {
    if (!f.endsWith('.json')) continue;
    const user = readJson(path.join(USERS_DIR, f), null);
    if (user?.username === username) return user;
  }
  return null;
}

export function createUser({ id, username, passwordHash }) {
  const user = {
    id,
    username,
    passwordHash,
    nickname: username,
    avatar_url: null,
    created_at: new Date().toISOString(),
    settings: {
      reading_goal_minutes_per_day: 30,
      weekly_target_books: 1,
      notifications_enabled: true,
      reminder_time: '20:00',
      theme: 'paper'
    }
  };
  const p = path.join(USERS_DIR, `${id}.json`);
  writeJson(p, user);
  return user;
}

export function updateUserSettings(userId, settings) {
  const user = ensureUser(userId);
  user.settings = { ...user.settings, ...settings };
  const p = path.join(USERS_DIR, `${userId}.json`);
  writeJson(p, user);
  return user.settings;
}

// ===================== 书架 =====================
export function getUserBook(userId, bookId) {
  const user = ensureUser(userId);
  return user.shelf?.find((b) => b.book_id === bookId) || null;
}

export function addToShelf(userId, bookId, status = '想聊', metadata = {}) {
  const user = ensureUser(userId);
  if (!user.shelf) user.shelf = [];
  const exist = user.shelf.find((b) => b.book_id === bookId);
  if (exist) {
    // 更新 metadata(比如是否用户上传)
    Object.assign(exist, metadata, { updated_at: new Date().toISOString() });
    writeJson(path.join(USERS_DIR, `${userId}.json`), user);
    return exist;
  }
  const entry = {
    book_id: bookId,
    status,
    progress_percent: 0,
    started_at: null,
    last_read_at: null,
    last_chapter_index: null,
    last_message_id: null,
    created_at: new Date().toISOString(),
    ...metadata
  };
  user.shelf.push(entry);
  writeJson(path.join(USERS_DIR, `${userId}.json`), user);
  return entry;
}

export function updateShelfEntry(userId, bookId, patch) {
  const user = ensureUser(userId);
  const idx = user.shelf?.findIndex((b) => b.book_id === bookId) ?? -1;
  if (idx === -1) return null;
  user.shelf[idx] = { ...user.shelf[idx], ...patch, last_read_at: new Date().toISOString() };
  writeJson(path.join(USERS_DIR, `${userId}.json`), user);
  return user.shelf[idx];
}

export function removeFromShelf(userId, bookId) {
  const user = ensureUser(userId);
  user.shelf = (user.shelf || []).filter((b) => b.book_id !== bookId);
  writeJson(path.join(USERS_DIR, `${userId}.json`), user);
}

// ===================== 用户上传的书 =====================
export function saveUserBook(book) {
  const p = path.join(USER_BOOKS_DIR, `${book.id}.json`);
  writeJson(p, book);
  return book;
}

export function getUserBookMeta(bookId) {
  const p = path.join(USER_BOOKS_DIR, `${bookId}.json`);
  return readJson(p, null);
}

export function listUserBooks(userId) {
  const user = ensureUser(userId);
  const ids = (user.shelf || []).filter((b) => b.is_user_uploaded).map((b) => b.book_id);
  return ids.map(getUserBookMeta).filter(Boolean);
}

// ===================== 作者智能体草稿 =====================
export function saveAgentDraft(userId, draft) {
  const p = path.join(DRAFTS_DIR, `${userId}_${draft.id}.json`);
  writeJson(p, draft);
  return draft;
}

export function getAgentDraft(userId, draftId) {
  const p = path.join(DRAFTS_DIR, `${userId}_${draftId}.json`);
  return readJson(p, null);
}

export function listAgentDrafts(userId) {
  const prefix = `${userId}_`;
  if (!fs.existsSync(DRAFTS_DIR)) return [];
  return fs.readdirSync(DRAFTS_DIR)
    .filter((f) => f.startsWith(prefix) && f.endsWith('.json'))
    .map((f) => readJson(path.join(DRAFTS_DIR, f)))
    .filter(Boolean);
}

export function deleteAgentDraft(userId, draftId) {
  const p = path.join(DRAFTS_DIR, `${userId}_${draftId}.json`);
  if (fs.existsSync(p)) fs.unlinkSync(p);
}

// ===================== 章节进度 =====================
export function getUserChapters(userId, bookId) {
  const p = path.join(USERS_DIR, `${userId}_chapters_${bookId}.json`);
  return readJson(p, { chapters: [] }).chapters;
}

export function getUserChapter(userId, bookId, chapterIndex) {
  const chapters = getUserChapters(userId, bookId);
  return chapters.find((c) => c.chapter_index === chapterIndex) || null;
}

export function ensureUserChapter(userId, bookId, chapterIndex) {
  const p = path.join(USERS_DIR, `${userId}_chapters_${bookId}.json`);
  const data = readJson(p, { chapters: [] });
  let ch = data.chapters.find((c) => c.chapter_index === chapterIndex);
  if (!ch) {
    ch = {
      chapter_index: chapterIndex,
      status: '进行中',
      started_at: new Date().toISOString(),
      completed_at: null,
      last_message_id: null,
      dialogue_turns: 0,
      pending_questions: [],
      explored_angles: [],
      reader_insights: []
    };
    data.chapters.push(ch);
    writeJson(p, data);
  }
  return ch;
}

export function updateUserChapter(userId, bookId, chapterIndex, patch) {
  const p = path.join(USERS_DIR, `${userId}_chapters_${bookId}.json`);
  const data = readJson(p, { chapters: [] });
  const idx = data.chapters.findIndex((c) => c.chapter_index === chapterIndex);
  if (idx === -1) return null;
  data.chapters[idx] = { ...data.chapters[idx], ...patch };
  writeJson(p, data);
  return data.chapters[idx];
}

// ===================== 对话消息 =====================
function dialogueKey(userId, bookId, chapterIndex) {
  return `${userId}__${bookId}__ch${chapterIndex}`;
}

export function getDialogue(userId, bookId, chapterIndex) {
  const p = path.join(DIALOGUES_DIR, `${dialogueKey(userId, bookId, chapterIndex)}.json`);
  return readJson(p, { messages: [] }).messages;
}

export function appendDialogueMessage(userId, bookId, chapterIndex, message) {
  const p = path.join(DIALOGUES_DIR, `${dialogueKey(userId, bookId, chapterIndex)}.json`);
  const data = readJson(p, { messages: [] });
  const msg = {
    id: `m_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    role: message.role,
    content: message.content,
    created_at: new Date().toISOString(),
    is_bookmarked: false
  };
  data.messages.push(msg);
  writeJson(p, data);
  return msg;
}

// ===================== 笔记 =====================
function noteKey(userId, bookId, chapterIndex) {
  return `${userId}__${bookId}__ch${chapterIndex}`;
}

export function getNote(userId, bookId, chapterIndex) {
  const p = path.join(NOTES_DIR, `${noteKey(userId, bookId, chapterIndex)}.json`);
  return readJson(p, null);
}

export function saveNote(userId, bookId, chapterIndex, content) {
  const p = path.join(NOTES_DIR, `${noteKey(userId, bookId, chapterIndex)}.json`);
  const existing = readJson(p, null);
  const now = new Date().toISOString();
  const note = {
    user_id: userId,
    book_id: bookId,
    chapter_index: chapterIndex,
    content,
    created_at: existing?.created_at || now,
    // 已有笔记：updated_at 必须比之前新（同一毫秒则+1ms）
    updated_at: existing
      ? (Date.parse(existing.updated_at) >= Date.parse(now)
          ? new Date(Date.parse(existing.updated_at) + 1).toISOString()
          : now)
      : now
  };
  writeJson(p, note);
  return note;
}

export function getBookNote(userId, bookId) {
  const p = path.join(NOTES_DIR, `${userId}__${bookId}__book.json`);
  return readJson(p, null);
}

export function saveBookNote(userId, bookId, content) {
  const p = path.join(NOTES_DIR, `${userId}__${bookId}__book.json`);
  const note = {
    user_id: userId,
    book_id: bookId,
    content,
    created_at: fs.existsSync(p) ? readJson(p).created_at : new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
  writeJson(p, note);
  return note;
}
