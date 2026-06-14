// catalog.js 单元测试
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, '../../data');

process.env.DATA_DIR = DATA_DIR;

import * as catalog from '../../backend/catalog.js';

describe('catalog — getBuiltinBooks', () => {
  it('返回书籍数组', () => {
    const books = catalog.getBuiltinBooks();
    assert.ok(Array.isArray(books));
    assert.ok(books.length >= 20, '内置书库应有 >= 20 本');
  });

  it('每本书有必填字段', () => {
    const books = catalog.getBuiltinBooks();
    for (const book of books) {
      assert.ok(book.id, '书籍应有 id');
      assert.ok(book.title, '书籍应有 title');
      assert.ok(book.author, '书籍应有 author');
      assert.ok(book.agent_file, '书籍应有 agent_file');
    }
  });

  it('返回同一引用（缓存）', () => {
    const b1 = catalog.getBuiltinBooks();
    const b2 = catalog.getBuiltinBooks();
    assert.strictEqual(b1, b2);
  });
});

describe('catalog — getBook', () => {
  it('通过 id 找到内置书', () => {
    const book = catalog.getBook('7habits');
    assert.strictEqual(book.id, '7habits');
  });

  it('找不到的书返回 null', () => {
    assert.strictEqual(catalog.getBook('nobody-book-' + Date.now()), null);
  });

  it('builtin-books.json 所有 id 都能找到', () => {
    const books = catalog.getBuiltinBooks();
    for (const b of books) {
      const found = catalog.getBook(b.id);
      assert.strictEqual(found?.id, b.id, `找不到书籍: ${b.id}`);
    }
  });
});

describe('catalog — getAgent', () => {
  it('加载内置书作者智能体', () => {
    const agent = catalog.getAgent('7habits');
    assert.ok(agent);
    assert.ok(agent.author);
    assert.strictEqual(agent.author.name, '史蒂芬·柯维');
  });

  it('作者智能体包含必填字段', () => {
    const agent = catalog.getAgent('7habits');
    assert.ok(agent.author.bio);
    assert.ok(agent.thought_system);
    assert.ok(agent.style);
    assert.ok(agent.guide);
    assert.ok(agent.challenge);
    assert.ok(agent.boundary);
    assert.ok(Array.isArray(agent.chapters));
  });

  it('返回同一引用（缓存）', () => {
    const a1 = catalog.getAgent('7habits');
    const a2 = catalog.getAgent('7habits');
    assert.strictEqual(a1, a2);
  });

  it('找不到的书返回 null', () => {
    assert.strictEqual(catalog.getAgent('nobody-book-' + Date.now()), null);
  });
});

describe('catalog — getChapter', () => {
  it('获取章节信息', () => {
    const ch = catalog.getChapter('7habits', 1);
    assert.ok(ch);
    assert.strictEqual(ch.index, 1);
    assert.ok(ch.title);
    assert.ok(ch.proposition);
    assert.ok(Array.isArray(ch.key_questions));
  });

  it('章节越界返回 null', () => {
    assert.strictEqual(catalog.getChapter('7habits', 999), null);
  });
});

describe('catalog — clearAgentCache', () => {
  it('清除指定缓存后重新加载', () => {
    catalog.getAgent('7habits');
    catalog.clearAgentCache('7habits');
    const agent = catalog.getAgent('7habits');
    assert.ok(agent);
  });

  it('清除全部缓存', () => {
    catalog.getAgent('7habits');
    catalog.getAgent('atomic-habits');
    catalog.clearAgentCache();
    // 缓存已清，重新加载
    const a = catalog.getAgent('7habits');
    assert.ok(a);
  });
});
