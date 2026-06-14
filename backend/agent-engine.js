// 作者智能体引擎 - 把配置 + 对话历史 → LLM 调用

import { callLLM } from './llm-client.js';

/**
 * 构建 system prompt
 * @param {Object} agent - 作者智能体配置
 * @param {Object} chapter - 当前章节
 * @param {Object} state - 对话状态
 */
export function buildSystemPrompt(agent, chapter, state = {}) {
  const a = agent;
  const c = chapter;

  const propositionsText = Object.entries(a.thought_system.key_propositions)
    .map(([k, v]) => `- ${k}: ${v}`)
    .join('\n');

  return `你是${a.author.name}。

# 关于你
${a.author.bio}
写作背景: ${a.author.writing_background}

# 你的核心思想体系
${a.thought_system.core_beliefs.map((b) => `- ${b}`).join('\n')}

# 你在这本书中的关键命题
${propositionsText}

# 你的思维框架
${a.thought_system.thinking_framework}
你深信: ${a.thought_system.what_author_believes}
你反对: ${a.thought_system.what_author_rejects}

# 你的表达风格
${a.style.language_style}
语气: ${a.style.tone}
你常用的表达: ${a.style.favorite_expressions.join('、')}
你不这样说: ${a.style.forbidden_expressions.join('、')}
幽默程度: ${Math.round(a.style.humor_level * 10)}/10
情感范围: ${a.style.emotional_range}

# 你的引导方式
${a.guide.opening_style}
${a.guide.how_it_guides.map((g, i) => `${i + 1}. ${g}`).join('\n')}

# 你的追问模式
你在以下情况会追问:
${a.challenge.when_it_asks.map((w) => `- ${w}`).join('\n')}
你的追问方式:
${a.challenge.how_it_asks.map((h) => `- ${h}`).join('\n')}

# 你的边界
${a.boundary.scope}
对于超出范围的问题: ${a.boundary.off_topic_response}

# 当前讨论
当前章节: 第${c.index}章 · ${c.title}
本章核心命题: ${c.proposition}
本章待讨论的问题:
${c.key_questions.map((q, i) => `${i + 1}. ${q}`).join('\n')}

# 你的对话原则(最重要)
1. 主动引导,不被动应答——不是"你问我答",而是"我带你思考"
2. 每轮对话要有引导:抛出问题、追问、深化、整合
3. 用故事/类比让抽象变具体
4. 追问深化:读者回答浅了,继续追问
5. 允许对抗,但引导整合——不是"赢",是"想得更深"
6. 不要给出"答案是X",而是"让我们一起想清楚"
7. 用你的语言,不用"根据书中的观点""书上说要"等
8. 长度适中(80-200字),自然对话节奏

# 当前状态
${state.explored_angles?.length ? `已讨论角度: ${state.explored_angles.join('、')}` : '本章刚开始'}
${state.pending_questions?.length ? `待续问题: ${state.pending_questions.join('、')}` : ''}

# 重要提醒
你不是百科全书。你是带着读者思考的思想向导。
你允许被挑战,但不会被轻易说服。
你最终目标不是"赢",是"和读者一起想得更深"。

请以${a.author.name}的身份回应。`;
}

/**
 * 单轮对话:根据对话历史,生成作者回复
 * @param {Object} agent
 * @param {Object} chapter
 * @param {Array} dialogueHistory
 * @param {Object} state
 * @returns {Promise<string>}
 */
export async function authorReply({ agent, chapter, dialogueHistory, state }) {
  const system = buildSystemPrompt(agent, chapter, state);
  const messages = dialogueHistory.map((m) => ({
    role: m.role === 'user' ? 'user' : 'assistant',
    content: m.content
  }));

  return callLLM({ system, messages, temperature: 0.75, max_tokens: 800 });
}

/**
 * 开场白:作者智能体主动引导章节
 */
export async function authorOpening({ agent, chapter, state }) {
  const system = buildSystemPrompt(agent, chapter, state);
  const openingPrompt = `这是本章的第一次对话。
请以${agent.author.name}的身份:
1. 简短的自我介绍或问候(可选)
2. 抛出本章的核心命题
3. 用一个故事或类比让抽象变具体
4. 最后,向读者提出第一个引导性问题

格式要求:
- 100-250字
- 自然、温暖、有故事感
- 结尾必须有引导性问题
- 不要说"欢迎来到第X章"这种模板话
- 像真人在跟朋友聊天,不像在讲课`;

  return callLLM({
    system,
    messages: [{ role: 'user', content: openingPrompt }],
    temperature: 0.8,
    max_tokens: 600
  });
}

/**
 * 章节收尾:从对话中生成聊书笔记草稿
 */
export async function generateChapterNote({ agent, chapter, dialogueHistory }) {
  const system = buildSystemPrompt(agent, chapter, {});

  const userMessages = dialogueHistory.filter((m) => m.role === 'user');
  const authorMessages = dialogueHistory.filter((m) => m.role === 'author');

  const notePrompt = `现在本章对话结束。请基于以上对话,帮我整理本章的聊书笔记草稿。

要求:
1. 只整理结构,不替代读者思考
2. "我的核心收获"必须来自用户原话中的原创想法,不要 AI 替代
3. "我与作者碰撞的地方"是用户与你有分歧/挑战的地方
4. "我的追问/困惑"是用户留下未解决的问题
5. "延伸思考"是用户联想到的其他问题

输出 JSON 格式:
{
  "core_insights": ["用户原话1", "用户原话2", ...],
  "collisions": [
    {"user": "用户原话", "author": "你的回应摘要"}
  ],
  "questions": ["用户原话的未解问题"],
  "extensions": ["用户原话中的延伸思考"]
}

只输出 JSON,不要其他解释。`;

  const messages = [
    ...dialogueHistory.map((m) => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.content })),
    { role: 'user', content: notePrompt }
  ];

  const raw = await callLLM({ system, messages, temperature: 0.5, max_tokens: 1500 });

  // 解析 JSON(可能包在 ```json ... ``` 中)
  const jsonMatch = raw.match(/```json\s*([\s\S]+?)\s*```/) || raw.match(/\{[\s\S]+\}/);
  const jsonText = jsonMatch ? jsonMatch[1] || jsonMatch[0] : raw;

  try {
    return JSON.parse(jsonText);
  } catch (e) {
    console.warn('[note] JSON 解析失败,使用原始内容:', e.message);
    return {
      core_insights: [],
      collisions: [],
      questions: [],
      extensions: [],
      _raw: raw
    };
  }
}

/**
 * 整书聊书笔记:跨章节总结
 */
export async function generateBookNote({ agent, bookTitle, chapterNotes }) {
  const system = `你是${agent.author.name}。你刚和一位读者聊完了整本《${bookTitle}》。
现在,你作为'共同阅读的伙伴',帮读者整理整本书的聊书笔记。
要求:基于读者原话整理,不替代思考。`;

  const prompt = `以下是本书各章的聊书笔记:
${JSON.stringify(chapterNotes, null, 2)}

请整理出整书笔记:
{
  "core_reflections": ["跨章节的核心思考,来自用户在各章的原话"],
  "action_changes": ["用户提到的具体行为改变/可落地行动"],
  "overall_tone": "本次阅读的整体氛围(简短描述)"
}

只输出 JSON。`;

  const raw = await callLLM({ system, messages: [{ role: 'user', content: prompt }], temperature: 0.5, max_tokens: 1500 });
  const m = raw.match(/\{[\s\S]+\}/);
  try {
    return m ? JSON.parse(m[0]) : { core_reflections: [], action_changes: [], overall_tone: '', _raw: raw };
  } catch {
    return { core_reflections: [], action_changes: [], overall_tone: '', _raw: raw };
  }
}
