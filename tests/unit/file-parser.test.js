// file-parser.js 单元测试（纯函数，无需真实文件）
import { describe, it } from 'node:test';
import assert from 'node:assert';

import { splitChapters, truncateForLLM, parseFile } from '../../backend/file-parser.js';

describe('file-parser — splitChapters', () => {
  it('识别中文"第X章"格式', () => {
    const text = '前言\n内容...\n\n第一章 积极主动\n积极主动的内容\n\n第二章 以终为始\n以终为始的内容';
    const chapters = splitChapters(text);
    assert.ok(chapters.length >= 2, `期望>=2章，实际${chapters.length}`);
  });

  it('识别"Chapter X"格式', () => {
    const text = 'Chapter 1 Introduction\nIntro text\n\nChapter 2 Methods\nMethods text';
    const chapters = splitChapters(text);
    assert.ok(chapters.length >= 2);
  });

  it('无章节标记返回全文', () => {
    const text = '这是一段没有任何章节标记的纯文本内容。';
    const chapters = splitChapters(text);
    assert.strictEqual(chapters.length, 1);
    assert.strictEqual(chapters[0].title, '全文');
  });

  it('章节 title 被正确提取', () => {
    const text = '前言\n内容\n\n第一章 积极主动\n积极主动的内容\n\n第二章 以终为始\n以终为始的内容';
    const chapters = splitChapters(text);
    const titles = chapters.map(c => c.title);
    assert.ok(titles.some(t => t.includes('积极主动') || t.includes('第一章')));
  });

  it('每章包含必填字段', () => {
    const text = '前言\n前言内容\n\n第一章 开篇\n第一章内容\n\n第二章 续篇\n第二章内容';
    const chapters = splitChapters(text);
    for (const ch of chapters) {
      assert.ok('index' in ch, '应有 index');
      assert.ok('title' in ch, '应有 title');
      assert.ok('content' in ch, '应有 content');
    }
  });
});

describe('file-parser — truncateForLLM', () => {
  it('短文本不截断', () => {
    assert.strictEqual(truncateForLLM('short', 100), 'short');
  });

  it('长文本截断为"头+尾"格式', () => {
    const text = 'A'.repeat(200);
    const result = truncateForLLM(text, 50);
    assert.ok(result.startsWith('AAAAA'));
    assert.ok(result.includes('...[中间内容已省略]...'));
    assert.ok(result.endsWith('AAAAA'));
    assert.ok(result.length < text.length);
  });

  it('默认截断阈值 30000', () => {
    const text = 'B'.repeat(40000);
    const result = truncateForLLM(text);
    assert.ok(result.length < 40000);
    assert.strictEqual(result.includes('...[中间内容已省略]...'), true);
  });

  it('自定义 maxChars', () => {
    const text = 'C'.repeat(1000);
    const result = truncateForLLM(text, 200);
    assert.ok(result.length < 1000);
  });
});

describe('file-parser — parseFile', () => {
  it('不支持的格式抛出错误', async () => {
    await assert.rejects(
      parseFile('/tmp/test.exe', 'application/x-executable'),
      /不支持的文件格式/
    );
  });

  it('无扩展名时用 mimeType', async () => {
    await assert.rejects(
      parseFile('/tmp/noextension', 'application/octet-stream'),
      /不支持的文件格式/
    );
  });
});
