// 端到端冒烟测试
// 跑通: 选书 → 开启章节 → 对话 → 收尾 → 笔记
import { setTimeout as sleep } from 'node:timers/promises';

const BASE = process.env.BASE || 'http://localhost:3000';
const USER = 'smoke_' + Date.now();

async function req(path, options = {}) {
  const url = path.startsWith('http') ? path : `${BASE}${path}`;
  const resp = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-User-Id': USER,
      ...(options.headers || {})
    }
  });
  const text = await resp.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  if (!resp.ok) {
    throw new Error(`HTTP ${resp.status} ${path}\n${typeof data === 'string' ? data : JSON.stringify(data, null, 2)}`);
  }
  return data;
}

function ok(label, val) {
  console.log(`  ✓ ${label}${val !== undefined ? `: ${val}` : ''}`);
}

let failed = 0;
function assert(label, cond) {
  if (cond) {
    console.log(`  ✓ ${label}`);
  } else {
    console.log(`  ✗ ${label}`);
    failed++;
  }
}

async function run() {
  console.log('\n┌─ 聊书 MVP · 端到端冒烟测试 ───────');
  console.log(`│ 目标: ${BASE}`);
  console.log(`│ 用户: ${USER}`);
  console.log(`└────────────────────────────────────\n`);

  // 1. 健康检查
  console.log('1. 健康检查');
  const health = await req('/healthz');
  assert('健康检查返回 ok', health.ok === true);
  ok('服务时间', health.ts);

  // 2. 加载书库
  console.log('\n2. 加载内置书库');
  const { books } = await req('/api/books');
  assert('至少 5 本书', books.length >= 5);
  ok('书数', books.length);
  ok('书单', books.map((b) => b.id).join(', '));

  // 3. 添加书到书架
  const bookId = '7habits';
  console.log(`\n3. 添加《${bookId}》到书架`);
  const { entry: addEntry } = await req('/api/user/shelf/add', {
    method: 'POST',
    body: JSON.stringify({ book_id: bookId, status: '想聊' })
  });
  assert('加入书架成功', addEntry.book_id === bookId);
  assert('状态: 想聊', addEntry.status === '想聊');

  // 4. 开始聊
  console.log('\n4. 开始聊这本书');
  const { entry: startEntry } = await req('/api/user/shelf/start', {
    method: 'POST',
    body: JSON.stringify({ book_id: bookId })
  });
  assert('状态: 进行中', startEntry.status === '进行中');

  // 5. 加载作者智能体
  console.log('\n5. 加载作者智能体');
  const { agent } = await req(`/api/books/${bookId}/agent`);
  assert('作者智能体加载成功', agent.author.name === '史蒂芬·柯维');
  assert('章节数 = 8', agent.chapters.length === 8);

  // 6. 开启第一章
  console.log('\n6. 开启第 1 章');
  const { dialogue: openingDialogue, message: openingMsg } = await req('/api/user/chapter/start', {
    method: 'POST',
    body: JSON.stringify({ book_id: bookId, chapter_index: 1 })
  });
  assert('开场白存在', openingDialogue.length > 0);
  assert('首条消息是作者', openingDialogue[0].role === 'author');
  ok('开场白长度', `${openingMsg?.content?.length || 0} 字`);
  console.log(`     "${(openingMsg?.content || '').slice(0, 80)}..."`);

  // 7. 用户发送 3 轮消息
  console.log('\n7. 发送 3 轮对话');
  for (let i = 0; i < 3; i++) {
    const userMsgs = [
      '关于积极主动,我有个困惑:有些人会把它当成一种道德绑架,你怎么回应?',
      '你说得对。但现实中,真的能每次都选择回应方式吗?情绪上来的时候怎么办?',
      '明白了。那以终为始和积极主动,它们的关系是什么?'
    ];
    const { author_message, dialogue } = await req('/api/user/chapter/message', {
      method: 'POST',
      body: JSON.stringify({ book_id: bookId, chapter_index: 1, content: userMsgs[i] })
    });
    assert(`第 ${i + 1} 轮对话成功`, !!author_message);
    ok(`第 ${i + 1} 轮作者消息长度`, `${author_message.content.length} 字`);
    ok(`对话总消息数`, dialogue.length);
  }

  // 8. 快速 Resume
  console.log('\n8. 快速 Resume');
  const resume = await req(`/api/user/chapter/${bookId}/1/resume`);
  assert('Resume 数据存在', resume.dialogue_turns > 0);
  ok('对话轮数', resume.dialogue_turns);
  ok('待聊话题数', resume.remaining_topics.length);
  ok('最近对话条数', resume.recent_dialogue.length);

  // 9. 收尾章节,生成笔记
  console.log('\n9. 收尾章节,生成聊书笔记');
  const { note } = await req('/api/user/chapter/close', {
    method: 'POST',
    body: JSON.stringify({ book_id: bookId, chapter_index: 1 })
  });
  assert('笔记生成成功', !!note);
  assert('笔记含 core_insights', Array.isArray(note.content.core_insights));
  ok('核心洞见数', note.content.core_insights?.length || 0);
  ok('碰撞点数', note.content.collisions?.length || 0);
  ok('追问数', note.content.questions?.length || 0);

  // 10. 章节回顾
  console.log('\n10. 章节回顾');
  const review = await req(`/api/user/chapter/${bookId}/1/review`);
  assert('回顾数据完整', !!review.chapter && !!review.note);

  // 11. 搜索
  console.log('\n11. 搜索对话内容');
  const { results } = await req('/api/user/search?q=积极主动');
  assert('搜索到结果', results.length > 0);
  ok('结果数', results.length);

  // 12. 单书进度
  console.log('\n12. 单书空间总览');
  const overview = await req(`/api/user/book/${bookId}/overview`);
  assert('总览数据完整', !!overview.book && Array.isArray(overview.chapters));
  assert('第 1 章状态: 已聊完', overview.chapters[0].status === '已聊完');
  ok('进度', `${overview.progress_percent}%`);

  // 13. 收尾整书
  console.log('\n13. 收尾整书,生成整书笔记');
  try {
    const { note: bookNote } = await req(`/api/user/book/${bookId}/note/close`, {
      method: 'POST'
    });
    assert('整书笔记生成', !!bookNote);
    ok('整书笔记轮数', bookNote.content.reading_info?.turns);
  } catch (e) {
    console.log(`  ⚠ 整书笔记生成失败(章节未全部完成可忽略): ${e.message}`);
  }

  // 总结
  console.log('\n────────────────────────────────────');
  if (failed === 0) {
    console.log('✅ 全部测试通过');
    process.exit(0);
  } else {
    console.log(`❌ ${failed} 个测试失败`);
    process.exit(1);
  }
}

run().catch((e) => {
  console.error('\n💥 测试崩溃:', e.message);
  process.exit(2);
});
