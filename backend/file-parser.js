// 文件解析器:PDF / EPUB / TXT → 纯文本 + 章节切分
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

let pdfParse;
try {
  pdfParse = require('pdf-parse');
} catch (e) {
  console.warn('[file-parser] pdf-parse 未安装,PDF 解析将不可用');
}

let EPub;
try {
  EPub = require('epub2').EPub;
} catch (e) {
  console.warn('[file-parser] epub2 未安装,EPUB 解析将不可用');
}

/**
 * 解析文件为纯文本
 * @param {string} filePath
 * @param {string} mimeType
 * @returns {Promise<{text: string, format: string, wordCount: number, metadata?: any}>}
 */
export async function parseFile(filePath, mimeType) {
  const ext = path.extname(filePath).toLowerCase();

  if (ext === '.txt' || mimeType === 'text/plain') {
    return parseTxt(filePath);
  }
  if (ext === '.pdf' || mimeType === 'application/pdf') {
    return parsePdf(filePath);
  }
  if (ext === '.epub' || mimeType === 'application/epub+zip') {
    return parseEpub(filePath);
  }
  throw new Error(`不支持的文件格式: ${ext || mimeType}`);
}

async function parseTxt(filePath) {
  const text = fs.readFileSync(filePath, 'utf-8');
  return {
    text,
    format: 'txt',
    wordCount: text.length
  };
}

async function parsePdf(filePath) {
  if (!pdfParse) throw new Error('PDF 解析器未安装');
  const buffer = fs.readFileSync(filePath);
  const data = await pdfParse(buffer);
  return {
    text: data.text,
    format: 'pdf',
    wordCount: data.text.length,
    metadata: { pages: data.numpages, info: data.info }
  };
}

async function parseEpub(filePath) {
  if (!EPub) throw new Error('EPUB 解析器未安装');
  return new Promise((resolve, reject) => {
    const epub = new EPub(filePath);
    epub.on('error', reject);
    epub.on('end', async () => {
      try {
        // 收集所有章节的文本
        const chapters = [];
        for (const chapter of epub.flow) {
          try {
            const text = await new Promise((res, rej) => {
              epub.getChapter(chapter.id, (err, t) => {
                if (err) rej(err);
                else res(t);
              });
            });
            // 去掉 HTML 标签
            const plain = text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
            if (plain.length > 100) {
              chapters.push({ id: chapter.id, title: chapter.title || `Chapter ${chapters.length + 1}`, text: plain });
            }
          } catch (e) {
            // 跳过解析失败的章节
          }
        }
        const fullText = chapters.map((c) => `\n\n# ${c.title}\n\n${c.text}`).join('');
        resolve({
          text: fullText,
          format: 'epub',
          wordCount: fullText.length,
          metadata: { chapters: chapters.length, title: epub.metadata?.title, author: epub.metadata?.creator }
        });
      } catch (e) {
        reject(e);
      }
    });
    epub.parse();
  });
}

/**
 * 切分章节(基于启发式规则:中文书籍常见"第X章"、"Chapter X"等)
 * @param {string} text
 * @returns {Array<{index: number, title: string, content: string}>}
 */
export function splitChapters(text) {
  const chapterRegex = /(?:\n|^)\s*(?:#+\s*)?(?:第[一二三四五六七八九十百千零0-9]+章[^\n]*|Chapter\s+\d+[^\n]*|第[一二三四五六七八九十]+篇[^\n]*|序言|前言|引言|绪论|导论|附录)\s*\n/g;

  const matches = [];
  let match;
  while ((match = chapterRegex.exec(text)) !== null) {
    matches.push({
      index: match.index,
      title: match[0].trim().replace(/^#+\s*/, '').replace(/^第[一二三四五六七八九十百千零0-9]+章\s*/, '').replace(/^Chapter\s+\d+\s*/i, '')
    });
  }

  if (matches.length === 0) {
    // 没有识别出章节,整本书作为一章
    return [{ index: 0, title: '全文', content: text }];
  }

  const chapters = [];
  for (let i = 0; i < matches.length; i++) {
    const start = matches[i].index;
    const end = i + 1 < matches.length ? matches[i + 1].index : text.length;
    const content = text.slice(start, end).slice(matches[i].title.length + 5);
    chapters.push({
      index: i + 1,
      title: matches[i].title || `第${i + 1}章`,
      content: content.trim()
    });
  }

  return chapters;
}

/**
 * 截取文本片段用于 LLM 处理(避免超出 token 限制)
 * @param {string} text
 * @param {number} maxChars
 * @returns {string}
 */
export function truncateForLLM(text, maxChars = 30000) {
  if (text.length <= maxChars) return text;
  // 头尾各取一半
  const half = Math.floor(maxChars / 2);
  return text.slice(0, half) + '\n\n...[中间内容已省略]...\n\n' + text.slice(-half);
}
