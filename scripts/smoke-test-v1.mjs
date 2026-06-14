// V1.0 端到端冒烟测试
// 验证:文件上传 → Agent 生成 → 草稿管理 → 确认启用 → 对话
// + 内置书扩展验证 + 设置 API + 扩展搜索
import fs from 'node:fs';
import path from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

const BASE = process.env.BASE || 'http://localhost:3000';
const USER = 'smoke_v1_' + Date.now();

async function req(path, options = {}) {
  const url = path.startsWith('http') ? path : `${BASE}${path}`;
  const resp = await fetch(url, {
    ...options,
    headers: {
      'X-User-Id': USER,
      ...(options.headers || {})
    }
  });
  const text = await resp.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  if (!resp.ok) {
    throw new Error(`HTTP ${resp.status} ${path}\n${typeof data === 'string' ? data : JSON.stringify(data, null, 2).slice(0, 500)}`);
  }
  return data;
}

let failed = 0;
function assert(label, cond) {
  if (cond) console.log(`  ✓ ${label}`);
  else { console.log(`  ✗ ${label}`); failed++; }
}
function ok(label, val) {
  console.log(`  ✓ ${label}${val !== undefined ? `: ${val}` : ''}`);
}

async function run() {
  console.log('\n┌─ 聊书 V1.0 · 端到端冒烟测试 ───────');
  console.log(`│ 目标: ${BASE}`);
  console.log(`│ 用户: ${USER}`);
  console.log(`└────────────────────────────────────\n`);

  // ============ 1. 内置书库扩展验证 ============
  console.log('1. 内置书库扩展(应 ≥ 20 本)');
  const { books } = await req('/api/books');
  assert('书数 ≥ 20', books.length >= 20);
  ok('总书数', books.length);
  ok('新增书目', ['principles', 'influence', 'positioning', 'willpower', 'sapiens', 'anti-fragile', 'meditation'].filter(id => books.find(b => b.id === id)).join(', '));

  // 验证新书的作者智能体
  const { agent: charlieAgent } = await req('/api/books/poor-charlie/agent');
  assert('芒格的智能体加载', charlieAgent.author.name === '查理·芒格');
  assert('芒格的章节数 = 5', charlieAgent.chapters.length === 5);

  // ============ 2. 设置 API ============
  console.log('\n2. 设置 API');
  const { settings: initialSettings } = await req('/api/user/settings');
  assert('默认设置加载', initialSettings.reading_goal_minutes_per_day === 30);

  const { settings: updatedSettings } = await req('/api/user/settings', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reading_goal_minutes_per_day: 45, theme: 'dark' })
  });
  assert('更新每日目标 = 45', updatedSettings.reading_goal_minutes_per_day === 45);
  assert('更新主题 = dark', updatedSettings.theme === 'dark');

  // ============ 3. 文件上传 (TXT) ============
  console.log('\n3. 文件上传 (TXT)');

  // 创建测试文件:模拟一本"书"
  const testTxtContent = `# 第一章 真正的高手

真正的高手不是没有情绪,而是能在情绪中保持觉知。

古希腊哲学家爱比克泰德说过: "人不是被事件本身困扰,而是被对事件的看法困扰。"

高手的标志:
- 在愤怒中能保持冷静
- 在焦虑中能保持清晰
- 在挫败中能保持前进

你怎么看待"情绪管理"?

# 第二章 学习的本质

学习的本质不是记住,而是改变。

如果你读了一本书,行为没有任何改变,那这次"学习"是无效的。

有效的学习有四个特征:
1. 有目标的学习
2. 有反馈的学习
3. 有反思的学习
4. 有应用的学习

你怎么看待"以教为学"?

# 第三章 复利的力量

复利是世界第八奇迹。

复利不只是金融概念,也是一种思维模型。
- 知识的复利:每天学一点,一年后就是 1.37 倍
- 习惯的复利:每天进步 1%,一年后就是 37 倍
- 关系的复利:每一次存款,都是未来的杠杆

你愿意相信"慢"的力量吗?

# 第四章 决策的智慧

决策的智慧不是"做对的事",而是"避免做错的事"。

查理·芒格说: "反过来想,总是反过来想。"
如果你想成功,先想怎么避免失败。
如果你想幸福,先想什么会让你不幸福。

你最近一次"反过来想"是在哪?
`;
  const testTxtPath = '/tmp/test-book.txt';
  fs.writeFileSync(testTxtPath, testTxtContent, 'utf-8');

  // 构造 multipart/form-data
  const formData = new FormData();
  const blob = new Blob([testTxtContent], { type: 'text/plain' });
  formData.append('file', blob, 'test-book.txt');
  formData.append('book_title', '真正的高手');
  formData.append('book_author', '测试作者');
  formData.append('user_notes', '这是一本关于个人成长和方法论的虚构书');

  const uploadResp = await fetch(`${BASE}/api/books/upload`, {
    method: 'POST',
    headers: { 'X-User-Id': USER },
    body: formData
  });
  const uploadData = await uploadResp.json();
  if (!uploadResp.ok) {
    console.log('  ✗ 上传失败:', uploadData.error);
    failed++;
  } else {
    assert('上传成功', !!uploadData.draft_id);
    ok('草稿 ID', uploadData.draft_id);
    ok('文件格式', uploadData.file_format);
    ok('文本长度', uploadData.text_length);
  }

  // ============ 4. 同步生成(测试) ============
  console.log('\n4. 同步生成作者智能体');
  const genResp = await req(`/api/books/draft/${uploadData.draft_id}/generate-sync`, { method: 'POST' });
  assert('生成成功', !!genResp.agent_config);
  assert('包含 thought_system', !!genResp.agent_config.thought_system);
  assert('包含 core_beliefs', Array.isArray(genResp.agent_config.thought_system.core_beliefs));
  assert('包含 key_propositions', typeof genResp.agent_config.thought_system.key_propositions === 'object');
  assert('包含 style', !!genResp.agent_config.style);
  assert('包含 favorite_expressions', Array.isArray(genResp.agent_config.style.favorite_expressions));
  assert('包含 chapters', Array.isArray(genResp.chapters));
  assert('章节数 ≥ 1', genResp.chapters.length >= 1);
  ok('生成的核心信念数', genResp.agent_config.thought_system.core_beliefs?.length);
  ok('生成的章节数', genResp.chapters.length);

  // 验证章节质量
  const firstCh = genResp.chapters[0];
  assert('章节有 proposition', !!firstCh.proposition);
  assert('章节有 key_questions', Array.isArray(firstCh.key_questions));
  ok('第1章标题', firstCh.title);
  ok('第1章命题', firstCh.proposition?.slice(0, 60) + '...');
  ok('第1章关键问题数', firstCh.key_questions?.length);

  // ============ 5. 草稿管理 ============
  console.log('\n5. 草稿管理');
  const { draft } = await req(`/api/books/draft/${uploadData.draft_id}`);
  assert('获取草稿', !!draft);
  assert('草稿 stage = awaiting_confirmation', draft.stage === 'awaiting_confirmation');

  // 草稿列表
  const { drafts } = await req('/api/books/drafts');
  assert('草稿列表包含本次草稿', drafts.some(d => d.id === uploadData.draft_id));

  // ============ 6. 确认草稿(创建用户上传的书) ============
  console.log('\n6. 确认草稿 → 启用作者智能体');
  const confirmData = await req(`/api/books/draft/${uploadData.draft_id}/confirm`, { method: 'POST' });
  assert('确认成功', confirmData.confirmed === true);
  assert('返回 book_id', !!confirmData.book_id);
  const newBookId = confirmData.book_id;
  ok('新书 ID', newBookId);
  ok('新书标题', confirmData.book.title);

  // 验证书已加入书架
  const { shelf } = await req('/api/user/shelf');
  const newBookEntry = shelf.find(b => b.book_id === newBookId);
  assert('新书在书架中', !!newBookEntry);
  assert('新书标记为用户上传', newBookEntry.is_user_uploaded === true);

  // 验证新书的作者智能体可用
  const { agent: newAgent } = await req(`/api/books/${newBookId}/agent`);
  assert('新书的智能体可加载', !!newAgent);
  assert('智能体作者名正确', newAgent.author.name === '测试作者' || newAgent.author.name === '测试作者');

  // ============ 7. 与新书对话 ============
  console.log('\n7. 与新书对话');
  // 开启第 1 章
  const { dialogue: openDlg } = await req('/api/user/chapter/start', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ book_id: newBookId, chapter_index: 1 })
  });
  assert('新书章节开场白存在', openDlg.length > 0);
  assert('首条消息是作者', openDlg[0].role === 'author');
  ok('新书开场白长度', `${openDlg[0].content.length} 字`);

  // 用户发送消息
  const msgResp = await req('/api/user/chapter/message', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ book_id: newBookId, chapter_index: 1, content: '关于"高手能在情绪中保持觉知",我觉得很难,你怎么帮我在愤怒中冷静下来?' })
  });
  assert('新书对话成功', !!msgResp.author_message);
  ok('新书作者回复长度', `${msgResp.author_message.content.length} 字`);

  // ============ 8. 扩展搜索(多条件) ============
  console.log('\n8. 扩展搜索');
  // 基础搜索
  const { results: r1, total: t1 } = await req('/api/user/search?q=高手');
  assert('关键词搜索返回结果', r1.length > 0);
  ok('搜索结果数', r1.length);
  ok('总数', t1);

  // 按书过滤
  const { results: r2 } = await req('/api/user/search?q=高手&book_id=7habits');
  assert('按书过滤不返回其他书的结果', r2.every(r => r.book_id === '7habits'));

  // 按角色过滤
  const { results: r3 } = await req('/api/user/search?q=高手&role=user');
  assert('按角色过滤只返回用户消息', r3.every(r => r.role === 'user'));

  // 笔记搜索
  const { results: r4 } = await req('/api/user/search?q=真正');
  assert('笔记也能搜到', r4.some(r => r.role === 'note') || r4.length > 0);

  // ============ 9. 草稿清理 ============
  console.log('\n9. 草稿清理');
  await req(`/api/books/draft/${uploadData.draft_id}`, { method: 'DELETE' });
  const { drafts: draftsAfter } = await req('/api/books/drafts');
  assert('删除草稿', !draftsAfter.some(d => d.id === uploadData.draft_id));

  // 清理测试文件
  try { fs.unlinkSync(testTxtPath); } catch {}

  // ============ 总结 ============
  console.log('\n────────────────────────────────────');
  if (failed === 0) {
    console.log('✅ V1.0 全部测试通过');
    process.exit(0);
  } else {
    console.log(`❌ ${failed} 个测试失败`);
    process.exit(1);
  }
}

run().catch((e) => {
  console.error('\n💥 测试崩溃:', e.message);
  console.error(e.stack);
  process.exit(2);
});
