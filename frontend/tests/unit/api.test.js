// 前端 API 模块单元测试（mock globalThis.fetch）
import { beforeEach, afterEach, describe, it, vi } from 'vitest';
import assert from 'node:assert';

let mockResponses = {};

function createMockFetch() {
  return async (url, options = {}) => {
    const method = options.method || 'GET';
    const pathname = new URL(url, 'http://localhost').pathname;
    const key = `${method} ${pathname}`;
    if (mockResponses[key]) {
      const { status = 200, body } = mockResponses[key];
      return {
        ok: status >= 200 && status < 300,
        status,
        json: async () => body,
      };
    }
    throw new Error(`No mock for ${key}`);
  };
}

beforeEach(() => {
  mockResponses = {};
  globalThis.fetch = createMockFetch();
});

afterEach(() => {
  delete globalThis.fetch;
});

describe('前端 API — listBooks', () => {
  it('GET /api/books 返回书籍数组', async () => {
    const mockBooks = [
      { id: '7habits', title: '高效能人士的7个习惯', author: '史蒂芬·柯维' }
    ];
    mockResponses['GET /api/books'] = { status: 200, body: { books: mockBooks } };

    const { api } = await import('@/api.js');
    const books = await api.listBooks();
    assert.strictEqual(Array.isArray(books), true);
    assert.strictEqual(books.length, 1);
    assert.strictEqual(books[0].id, '7habits');
  });
});

describe('前端 API — getShelf', () => {
  it('GET /api/user/shelf 返回书架数组', async () => {
    const mockShelf = [
      { book_id: '7habits', status: '想聊', progress_percent: 0 }
    ];
    mockResponses['GET /api/user/shelf'] = { status: 200, body: { shelf: mockShelf } };

    const { api } = await import('@/api.js');
    const shelf = await api.getShelf();
    assert.strictEqual(Array.isArray(shelf), true);
    assert.strictEqual(shelf[0].book_id, '7habits');
  });

  it('shelf 为空时返回空数组', async () => {
    mockResponses['GET /api/user/shelf'] = { status: 200, body: { shelf: [] } };
    const { api } = await import('@/api.js');
    const shelf = await api.getShelf();
    assert.strictEqual(Array.isArray(shelf), true);
    assert.strictEqual(shelf.length, 0);
  });
});

describe('前端 API — addToShelf', () => {
  it('POST /api/user/shelf/add 返回 entry', async () => {
    const mockEntry = { book_id: 'atomic-habits', status: '想聊' };
    mockResponses['POST /api/user/shelf/add'] = { status: 200, body: { entry: mockEntry } };
    const { api } = await import('@/api.js');
    const entry = await api.addToShelf('atomic-habits', '想聊');
    assert.strictEqual(entry.book_id, 'atomic-habits');
  });
});

describe('前端 API — startChapter', () => {
  it('POST /api/user/chapter/start 返回对话', async () => {
    const mockResult = {
      dialogue: [{ role: 'author', content: '开场白' }],
      message: { role: 'author', content: '开场白' }
    };
    mockResponses['POST /api/user/chapter/start'] = { status: 200, body: mockResult };
    const { api } = await import('@/api.js');
    const result = await api.startChapter('7habits', 1);
    assert.ok(result.dialogue);
    assert.ok(result.message);
  });
});

describe('前端 API — sendMessage', () => {
  it('POST /api/user/chapter/message 返回作者回复', async () => {
    const mockResult = {
      author_message: { role: 'author', content: '回复内容' },
      dialogue: [{ role: 'user' }, { role: 'author' }]
    };
    mockResponses['POST /api/user/chapter/message'] = { status: 200, body: mockResult };
    const { api } = await import('@/api.js');
    const result = await api.sendMessage('7habits', 1, '你好');
    assert.strictEqual(result.author_message.role, 'author');
    assert.strictEqual(result.dialogue.length, 2);
  });
});

describe('前端 API — getBookOverview', () => {
  it('GET /api/user/book/:id/overview 返回概览', async () => {
    const mockOverview = {
      book: { id: '7habits', title: '7个习惯' },
      chapters: [],
      progress_percent: 0
    };
    mockResponses['GET /api/user/book/7habits/overview'] = { status: 200, body: mockOverview };
    const { api } = await import('@/api.js');
    const overview = await api.getBookOverview('7habits');
    assert.strictEqual(overview.book.id, '7habits');
    assert.ok('progress_percent' in overview);
  });
});

describe('前端 API — 错误处理', () => {
  it('HTTP 错误抛出 Error', async () => {
    mockResponses['GET /api/books'] = { status: 500, body: { error: 'Server error' } };
    const { api } = await import('@/api.js');
    await assert.rejects(api.listBooks(), /Server error/);
  });
});