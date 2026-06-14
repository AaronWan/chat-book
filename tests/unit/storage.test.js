// storage.js 单元测试 — 使用真实 data 目录（unique user ID 隔离）
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '../../data');
const USER_PREFIX = 'test_u_';
let counter = 0;
function nextUser() { return `${USER_PREFIX}${++counter}_${Date.now()}`; }

import * as storage from '../../backend/storage.js';

function rmUserFiles(userId) {
  const dirs = ['users', 'dialogues', 'notes'].map(d => path.join(DATA_DIR, d));
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir)) {
      if (f.startsWith(userId)) {
        fs.rmSync(path.join(dir, f), { force: true });
      }
    }
  }
}

beforeEach(() => { counter = 0; });

// ── 用户 ──────────────────────────────────────────────────────────────
describe('storage 用户', () => {
  it('ensureUser 创建新用户', () => {
    const u = nextUser();
    const user = storage.ensureUser(u);
    assert.strictEqual(user.id, u);
    assert.strictEqual(user.nickname, '读者');
    assert.strictEqual(user.settings.theme, 'paper');
    rmUserFiles(u);
  });

  it('ensureUser 幂等（同一用户不重复写文件）', () => {
    const u = nextUser();
    storage.ensureUser(u);
    storage.ensureUser(u);
    const files = fs.readdirSync(path.join(DATA_DIR, 'users')).filter(f => f.startsWith(u));
    assert.strictEqual(files.length, 1, `期望1个文件，实际${files.length}`);
    rmUserFiles(u);
  });

  it('updateUser 部分更新', () => {
    const u = nextUser();
    storage.ensureUser(u);
    const updated = storage.updateUser(u, { nickname: '测试读者' });
    assert.strictEqual(updated.nickname, '测试读者');
    assert.strictEqual(updated.settings.theme, 'paper');
    rmUserFiles(u);
  });

  it('updateUserSettings 合并更新', () => {
    const u = nextUser();
    storage.ensureUser(u);
    const s = storage.updateUserSettings(u, { theme: 'dark', weekly_target_books: 3 });
    assert.strictEqual(s.theme, 'dark');
    assert.strictEqual(s.weekly_target_books, 3);
    assert.strictEqual(s.reading_goal_minutes_per_day, 30);
    rmUserFiles(u);
  });

  it('getUser 不存在返回 null', () => {
    assert.strictEqual(storage.getUser('nobody_' + Date.now()), null);
  });
});

// ── 书架 ───────────────────────────────────────────────────────────────
describe('storage 书架', () => {
  it('addToShelf 添加新书', () => {
    const u = nextUser();
    const entry = storage.addToShelf(u, '7habits', '想聊');
    assert.strictEqual(entry.book_id, '7habits');
    assert.strictEqual(entry.status, '想聊');
    assert.strictEqual(entry.progress_percent, 0);
    rmUserFiles(u);
  });

  it('addToShelf 重复添加只更新 metadata，不更新 status', () => {
    const u = nextUser();
    storage.addToShelf(u, '7habits', '想聊');
    // addToShelf 对已存在书籍只更新 metadata，不改变 status
    const again = storage.addToShelf(u, '7habits', '进行中');
    assert.strictEqual(again.status, '想聊', '已存在时 status 不变');
    assert.ok(again.updated_at);
    // 用 updateShelfEntry 才能更新 status
    const updated = storage.updateShelfEntry(u, '7habits', { status: '进行中' });
    assert.strictEqual(updated.status, '进行中');
    rmUserFiles(u);
  });

  it('getUserBook 找到书籍', () => {
    const u = nextUser();
    storage.addToShelf(u, '7habits');
    assert.strictEqual(storage.getUserBook(u, '7habits')?.book_id, '7habits');
    rmUserFiles(u);
  });

  it('getUserBook 不存在返回 null', () => {
    const u = nextUser();
    storage.ensureUser(u);
    assert.strictEqual(storage.getUserBook(u, 'nobody'), null);
  });

  it('updateShelfEntry 更新进度', () => {
    const u = nextUser();
    storage.addToShelf(u, '7habits');
    const updated = storage.updateShelfEntry(u, '7habits', {
      progress_percent: 50,
      last_chapter_index: 3
    });
    assert.strictEqual(updated.progress_percent, 50);
    assert.strictEqual(updated.last_chapter_index, 3);
    assert.ok(updated.last_read_at);
    rmUserFiles(u);
  });

  it('updateShelfEntry 不存在返回 null', () => {
    const u = nextUser();
    storage.ensureUser(u);
    assert.strictEqual(storage.updateShelfEntry(u, 'nobody', {}), null);
  });

  it('removeFromShelf 删除书籍', () => {
    const u = nextUser();
    storage.addToShelf(u, '7habits');
    storage.removeFromShelf(u, '7habits');
    assert.strictEqual(storage.getUserBook(u, '7habits'), null);
    rmUserFiles(u);
  });
});

// ── 章节进度 ───────────────────────────────────────────────────────────
describe('storage 章节进度', () => {
  it('ensureUserChapter 创建章节', () => {
    const u = nextUser();
    const ch = storage.ensureUserChapter(u, '7habits', 1);
    assert.strictEqual(ch.chapter_index, 1);
    assert.strictEqual(ch.status, '进行中');
    assert.strictEqual(ch.dialogue_turns, 0);
    rmUserFiles(u);
  });

  it('ensureUserChapter 幂等', () => {
    const u = nextUser();
    storage.ensureUserChapter(u, '7habits', 1);
    storage.ensureUserChapter(u, '7habits', 1);
    const chapters = storage.getUserChapters(u, '7habits');
    assert.strictEqual(chapters.length, 1);
    rmUserFiles(u);
  });

  it('updateUserChapter 更新字段', () => {
    const u = nextUser();
    storage.ensureUserChapter(u, '7habits', 1);
    const updated = storage.updateUserChapter(u, '7habits', 1, {
      status: '已聊完',
      dialogue_turns: 5
    });
    assert.strictEqual(updated.status, '已聊完');
    assert.strictEqual(updated.dialogue_turns, 5);
    rmUserFiles(u);
  });
});

// ── 对话消息 ───────────────────────────────────────────────────────────
describe('storage 对话消息', () => {
  it('appendDialogueMessage 保存消息', () => {
    const u = nextUser();
    const msg = storage.appendDialogueMessage(u, '7habits', 1, {
      role: 'user',
      content: '你好作者'
    });
    assert.strictEqual(msg.role, 'user');
    assert.ok(msg.id.startsWith('m_'));
    assert.ok(msg.created_at);
    rmUserFiles(u);
  });

  it('getDialogue 获取消息列表', () => {
    const u = nextUser();
    storage.appendDialogueMessage(u, '7habits', 1, { role: 'user', content: '问' });
    storage.appendDialogueMessage(u, '7habits', 1, { role: 'author', content: '答' });
    const msgs = storage.getDialogue(u, '7habits', 1);
    assert.strictEqual(msgs.length, 2);
    assert.strictEqual(msgs[0].role, 'user');
    assert.strictEqual(msgs[1].role, 'author');
    rmUserFiles(u);
  });

  it('不同用户/书籍/章节消息隔离', () => {
    const u1 = nextUser(), u2 = nextUser();
    storage.appendDialogueMessage(u1, '7habits', 1, { role: 'user', content: 'u1ch1' });
    storage.appendDialogueMessage(u2, '7habits', 1, { role: 'user', content: 'u2ch1' });
    storage.appendDialogueMessage(u1, '7habits', 2, { role: 'user', content: 'u1ch2' });
    assert.strictEqual(storage.getDialogue(u1, '7habits', 1)[0].content, 'u1ch1');
    assert.strictEqual(storage.getDialogue(u2, '7habits', 1)[0].content, 'u2ch1');
    assert.strictEqual(storage.getDialogue(u1, '7habits', 2)[0].content, 'u1ch2');
    rmUserFiles(u1); rmUserFiles(u2);
  });
});

// ── 笔记 ───────────────────────────────────────────────────────────────
describe('storage 笔记', () => {
  it('saveNote + getNote', () => {
    const u = nextUser();
    storage.saveNote(u, '7habits', 1, { core_insights: ['收获1'], collisions: [], questions: [] });
    const note = storage.getNote(u, '7habits', 1);
    assert.strictEqual(note.book_id, '7habits');
    assert.strictEqual(note.content.core_insights[0], '收获1');
    rmUserFiles(u);
  });

  it('saveNote 更新已有笔记', () => {
    const u = nextUser();
    storage.saveNote(u, '7habits', 1, { core_insights: ['v1'] });
    const first = storage.getNote(u, '7habits', 1);
    storage.saveNote(u, '7habits', 1, { core_insights: ['v2'] });
    const second = storage.getNote(u, '7habits', 1);
    assert.strictEqual(second.content.core_insights[0], 'v2');
    assert.ok(second.updated_at !== first.updated_at, 'updated_at 应该改变');
    rmUserFiles(u);
  });

  it('getNote 不存在返回 null', () => {
    const u = nextUser();
    storage.ensureUser(u);
    assert.strictEqual(storage.getNote(u, 'nobody', 1), null);
  });
});

// ── 用户上传书籍 ────────────────────────────────────────────────────────
describe('storage 用户上传书籍', () => {
  it('saveUserBook + getUserBookMeta', () => {
    const id = 'ub_' + Date.now();
    storage.saveUserBook({ id, title: '我的书', author: '我' });
    assert.strictEqual(storage.getUserBookMeta(id)?.title, '我的书');
  });

  it('listUserBooks 筛选上传书籍', () => {
    const u = nextUser();
    const id = 'ub2_' + Date.now();
    storage.saveUserBook({ id, title: 'UB' });
    storage.addToShelf(u, id, '想聊', { is_user_uploaded: true });
    assert.strictEqual(storage.listUserBooks(u).some(b => b.id === id), true);
    rmUserFiles(u);
  });
});

// ── 智能体草稿 ────────────────────────────────────────────────────────
describe('storage 智能体草稿', () => {
  it('saveDraft + getDraft', () => {
    const u = nextUser();
    storage.saveAgentDraft(u, { id: 'd1', name: '作者', text: '内容' });
    assert.strictEqual(storage.getAgentDraft(u, 'd1')?.name, '作者');
    rmUserFiles(u);
  });

  it('listAgentDrafts', () => {
    const u = nextUser();
    storage.saveAgentDraft(u, { id: 'd1', name: 'D1' });
    storage.saveAgentDraft(u, { id: 'd2', name: 'D2' });
    assert.strictEqual(storage.listAgentDrafts(u).length, 2);
    rmUserFiles(u);
  });

  it('deleteAgentDraft', () => {
    const u = nextUser();
    storage.saveAgentDraft(u, { id: 'd1', name: 'D1' });
    storage.deleteAgentDraft(u, 'd1');
    assert.strictEqual(storage.getAgentDraft(u, 'd1'), null);
    rmUserFiles(u);
  });

  it('不同用户草稿隔离', () => {
    const u1 = nextUser(), u2 = nextUser();
    storage.saveAgentDraft(u1, { id: 'd1', name: 'U1' });
    storage.saveAgentDraft(u2, { id: 'd1', name: 'U2' });
    assert.strictEqual(storage.listAgentDrafts(u1)[0].name, 'U1');
    assert.strictEqual(storage.listAgentDrafts(u2)[0].name, 'U2');
    rmUserFiles(u1); rmUserFiles(u2);
  });
});
