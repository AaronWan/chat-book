// 前端 UI 冒烟测试
// 验证:所有页面可访问 + 截图文件大小正常（非崩溃空页面）
// 使用 demo 用户，验证数据正常渲染
import fs from 'node:fs';
import path from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { execSync } from 'child_process';

const BASE = process.env.BASE || 'http://localhost:3000';
const OUT_DIR = process.env.OUT_DIR || '/tmp/smoke-frontend';
const USER = 'demo'; // 使用 demo 用户确保数据匹配

// 确保输出目录存在
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

// Chrome 路径
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const PAGES = [
  { name: '01_home',            url: `${BASE}/?user_id=${USER}`,                                        minKb: 40 },
  { name: '02_book_space',      url: `${BASE}/?user_id=${USER}#/book/7habits`,                          minKb: 60 },
  { name: '03_chapter_dialogue',url: `${BASE}/?user_id=${USER}#/book/7habits/dialogue/1`,               minKb: 80 },
  { name: '04_chapter_review',  url: `${BASE}/?user_id=${USER}#/book/7habits/review/1`,                 minKb: 60 },
  { name: '05_book_note',       url: `${BASE}/?user_id=${USER}#/book/7habits/note`,                     minKb: 40 },
  { name: '06_search',          url: `${BASE}/?user_id=${USER}#/search`,                                 minKb: 40 },
  { name: '07_settings',        url: `${BASE}/?user_id=${USER}#/settings`,                               minKb: 30 },
];

async function captureScreenshot(page) {
  const outPath = path.join(OUT_DIR, `${page.name}.png`);

  const chromeBin = CHROME;
  const userDataDir = `/tmp/chrome-sandbox-${Date.now()}`;

  const args = [
    '--headless=new',
    '--disable-gpu',
    `--screenshot=${outPath}`,
    '--window-size=1440,900',
    '--virtual-time-budget=8000',
    `--user-data-dir=${userDataDir}`,
    `"${page.url}"`,
  ].join(' ');

  const cmd = `"${chromeBin}" ${args}`;

  const { error, stderr, stdout } = await new Promise((resolve) => {
    try {
      const { error: e, stderr, stdout } = execSync(cmd, {
        encoding: 'utf8',
        timeout: 20000,
        shell: '/bin/bash',
      });
      resolve({ error: e, stderr, stdout });
    } catch (err) {
      resolve({ error: err.status === 0 ? null : err, stderr: err.stderr, stdout: err.stdout });
    }
  });

  // 检查是否有截图文件
  if (!fs.existsSync(outPath)) {
    return { path: null, sizeKb: 0, error: 'no screenshot' };
  }

  const sizeKb = Math.round(fs.statSync(outPath).size / 1024);
  return { path: outPath, sizeKb, error: null };
}

let passed = 0;
let failed = 0;

async function run() {
  console.log('\n┌─ 聊书 · 前端 UI 冒烟测试 ───────');
  console.log(`│ 目标: ${BASE}`);
  console.log(`│ 用户: ${USER}`);
  console.log(`│ 输出: ${OUT_DIR}`);
  console.log(`└────────────────────────────────────\n`);

  for (const page of PAGES) {
    process.stdout.write(`  ${page.name}... `);

    // 先确保 Chrome 服务可用
    try {
      await fetch(`${BASE}/`, { signal: AbortSignal.timeout(3000) });
    } catch {
      console.log('✗ Chrome 服务未启动');
      failed++;
      continue;
    }

    const result = await captureScreenshot(page);

    if (result.error === 'no screenshot' || result.sizeKb === 0) {
      console.log(`✗ 无截图文件`);
      failed++;
    } else if (result.sizeKb < page.minKb) {
      console.log(`✗ 文件太小 (${result.sizeKb}KB < ${page.minKb}KB，可能崩溃)`);
      failed++;
    } else {
      console.log(`✓ ${result.sizeKb}KB`);
      passed++;
    }
  }

  console.log('\n────────────────────────────────────');
  console.log(`结果: ${passed}/${passed + failed} 通过`);

  if (failed > 0) {
    console.log(`❌ ${failed} 个页面异常`);
    process.exit(1);
  } else {
    console.log('✅ 全部页面正常');
    process.exit(0);
  }
}

run().catch((e) => {
  console.error('\n💥 测试崩溃:', e.message);
  process.exit(2);
});
