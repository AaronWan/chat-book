// 作者智能体引擎 - 把配置 + 对话历史 → LLM 调用

import { callLLM } from './llm-client.js';
import { t, I18N } from './i18n.js';

/**
 * 构建 system prompt
 * @param {Object} agent - 作者智能体配置
 * @param {Object} chapter - 当前章节
 * @param {Object} state - 对话状态
 * @param {Object} opts - { language: 'zh'|'zh-Hant'|'en'|'fr'|'ko' }
 */
export function buildSystemPrompt(agent, chapter, state = {}, opts = {}) {
  const lang = opts.language || 'zh';
  const L = I18N.system[lang] || I18N.system.zh;

  const propositionsText = Object.entries(agent.thought_system.key_propositions)
    .map(([k, v]) => `- ${k}: ${v}`)
    .join('\n');

  const exploredText = state.explored_angles?.length
    ? `${L.explored_angles}: ${state.explored_angles.join('、')}`
    : L.just_started;
  const pendingText = state.pending_questions?.length
    ? `${L.pending_questions_label}: ${state.pending_questions.join('、')}`
    : '';

  return `# 【强制指令 — 必须遵守】
你必须且只能使用 **${L.lang_name}** 与读者进行所有对话。
不要用其他语言。不要在回复中夹杂其他语言的词汇。
作者名等专有名词可以直接保留原文，但所有叙述、提问、总结必须用 ${L.lang_name}。

${L.you_are}${agent.author.name}。

${L.about_you}
${agent.author.bio}
${L.writing_background}: ${agent.author.writing_background}

${L.core_thoughts}
${agent.thought_system.core_beliefs.map((b) => `- ${b}`).join('\n')}

${L.key_propositions}
${propositionsText}

${L.thinking_framework}
${agent.thought_system.thinking_framework}
${L.you_believe}: ${agent.thought_system.what_author_believes}
${L.you_reject}: ${agent.thought_system.what_author_rejects}

${L.expression_style}
${agent.style.language_style}
${L.tone}: ${agent.style.tone}
${L.your_expressions}: ${agent.style.favorite_expressions.join('、')}
${L.not_say_this}: ${agent.style.forbidden_expressions.join('、')}
${L.humor_level}: ${Math.round(agent.style.humor_level * 10)}/10
${L.emotional_range}: ${agent.style.emotional_range}

${L.guide_style}
${agent.guide.opening_style}
${agent.guide.how_it_guides.map((g, i) => `${i + 1}. ${g}`).join('\n')}

${L.challenge_mode}
${L.when_asks}:
${agent.challenge.when_it_asks.map((w) => `- ${w}`).join('\n')}
${L.how_asks}:
${agent.challenge.how_it_asks.map((h) => `- ${h}`).join('\n')}

${L.boundary}
${agent.boundary.scope}
${L.off_topic}: ${agent.boundary.off_topic_response}

${L.current_discussion}
${L.current_chapter}: 第${chapter.index}章 · ${chapter.title}
${L.chapter_proposition}: ${chapter.proposition}
${L.chapter_questions}:
${chapter.key_questions.map((q, i) => `${i + 1}. ${q}`).join('\n')}

${L.dialogue_principles}
1. ${L.principle_1}
2. ${L.principle_2}
3. ${L.principle_3}
4. ${L.principle_4}
5. ${L.principle_5}
6. ${L.principle_6}
7. ${L.principle_7}
8. ${L.principle_8}

${L.current_status}
${exploredText}
${pendingText}

${L.important_reminder}
${L.reminder_body}

${L.respond_as}${agent.author.name}${L.identity}`;
}

/**
 * 单轮对话:根据对话历史,生成作者回复
 * @param {Object} agent
 * @param {Object} chapter
 * @param {Array} dialogueHistory
 * @param {Object} state
 * @param {string} language - 语言代码
 * @returns {Promise<string>}
 */
export async function authorReply({ agent, chapter, dialogueHistory, state, language = 'zh' }) {
  const system = buildSystemPrompt(agent, chapter, state, { language });
  const messages = dialogueHistory.map((m) => ({
    role: m.role === 'user' ? 'user' : 'assistant',
    content: m.content
  }));

  return callLLM({ system, messages, temperature: 0.75, max_tokens: 800 });
}

/**
 * 开场白:作者智能体主动引导章节
 */
export async function authorOpening({ agent, chapter, state, language = 'zh' }) {
  const L = I18N.system[language] || I18N.system.zh;
  const system = buildSystemPrompt(agent, chapter, state, { language });
  const openingPrompt =
    L.opening_intro + '\n' +
    L.opening_task.replace('{{name}}', agent.author.name) + '\n' +
    '1. ' + L.opening_1 + '\n' +
    '2. ' + L.opening_2 + '\n' +
    '3. ' + L.opening_3 + '\n' +
    '4. ' + L.opening_4 + '\n\n' +
    L.opening_format + '\n' +
    '- ' + L.opening_rule_1 + '\n' +
    '- ' + L.opening_rule_2 + '\n' +
    '- ' + L.opening_rule_3 + '\n' +
    '- ' + L.opening_rule_4 + '\n' +
    '- ' + L.opening_rule_5;

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
export async function generateChapterNote({ agent, chapter, dialogueHistory, language = 'zh' }) {
  const L = I18N.system[language] || I18N.system.zh;
  const system = buildSystemPrompt(agent, chapter, {}, { language });

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
export async function generateBookNote({ agent, bookTitle, chapterNotes, language = 'zh' }) {
  const L = I18N.system[language] || I18N.system.zh;
  const system = `${L.you_are}${agent.author.name}。你刚和一位读者聊完了整本《${bookTitle}》。
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
