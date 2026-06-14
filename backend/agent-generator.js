// AuthorAgent 自动生成:基于书籍内容用 LLM 提取
import { callLLM } from './llm-client.js';
import { splitChapters, truncateForLLM } from './file-parser.js';

/**
 * 从书的内容生成 AuthorAgent 配置
 * @param {Object} params
 * @param {string} params.bookTitle
 * @param {string} params.bookAuthor
 * @param {string} params.bookText
 * @param {string} [params.userNotes] - 用户手动输入的作者介绍
 * @returns {Promise<Object>} AuthorAgent 配置
 */
export async function generateAgentFromText({ bookTitle, bookAuthor, bookText, userNotes = '' }) {
  const truncated = truncateForLLM(bookText, 25000);

  const systemPrompt = `你是一个资深的图书编辑,擅长从一本书的内容中提取作者的思想体系、表达风格、引导方式。

你的任务是:阅读书籍内容,生成一个结构化的"作者智能体"配置。

# 作者智能体的核心定位
作者智能体不是问答机器,而是"带着读者思考的思想向导"。它在对话中要:
- 主动引导,不被动应答
- 思想碰撞,而非信息传递
- 用作者的眼睛看世界

# 输出格式
严格输出 JSON(不要其他解释):

{
  "thought_system": {
    "core_beliefs": ["信念1", "信念2", "信念3", "信念4"],
    "key_propositions": {
      "命题名1": "一句话定义",
      "命题名2": "一句话定义",
      "命题名3": "一句话定义",
      "命题名4": "一句话定义"
    },
    "thinking_framework": "作者的分析框架(1-2句)",
    "what_author_believes": "作者深信什么",
    "what_author_rejects": "作者反对什么"
  },
  "style": {
    "language_style": "1句风格描述",
    "tone": "语气关键词",
    "favorite_expressions": ["作者常用的口头禅1", "口头禅2", "口头禅3"],
    "forbidden_expressions": ["绝对不能出现的词1", "词2"],
    "humor_level": 0.0-1.0的数字,
    "emotional_range": "情感范围"
  },
  "guide": {
    "opening_style": "开场风格(1句)",
    "how_it_guides": ["引导步骤1", "步骤2", "步骤3", "步骤4"],
    "typical_sequence": "标准对话序列"
  },
  "challenge": {
    "when_it_asks": ["追问触发条件1", "条件2", "条件3"],
    "how_it_asks": ["追问方式1", "方式2", "方式3"],
    "challenge_triggers": ["挑战触发条件1", "条件2"]
  },
  "boundary": {
    "scope": "智能体的讨论范围",
    "off_topic_response": "超出范围时的标准回应"
  }
}`;

  const userPrompt = `# 书籍信息
书名: ${bookTitle}
作者: ${bookAuthor}
${userNotes ? `用户补充信息: ${userNotes}` : ''}

# 书籍内容(已截取)
${truncated}

请基于以上内容,生成这本书的作者智能体配置(JSON)。`;

  const raw = await callLLM({ system: systemPrompt, messages: [{ role: 'user', content: userPrompt }], temperature: 0.4, max_tokens: 3000 });

  // 解析 JSON
  const jsonMatch = raw.match(/```json\s*([\s\S]+?)\s*```/) || raw.match(/\{[\s\S]+\}/);
  if (!jsonMatch) {
    throw new Error('LLM 返回的不是 JSON');
  }

  let config;
  try {
    config = JSON.parse(jsonMatch[1] || jsonMatch[0]);
  } catch (e) {
    throw new Error('JSON 解析失败: ' + e.message);
  }

  return config;
}

/**
 * 基于书的内容自动切分章节并生成章节命题
 * @param {string} bookText
 * @param {string} bookTitle
 * @returns {Promise<Array<{index, title, proposition, key_questions}>>}
 */
export async function generateChaptersFromText({ bookText, bookTitle }) {
  // 先用启发式切分
  const rawChapters = splitChapters(bookText);
  console.log(`[chapters] 启发式切分得到 ${rawChapters.length} 个章节`);

  if (rawChapters.length === 0) {
    return [{
      index: 1,
      title: '全文',
      proposition: `《${bookTitle}》的核心思想讨论`,
      key_questions: ['这本书最核心的命题是什么?', '这本书怎么改变了你的思考?']
    }];
  }

  // 限制章节数(MVP 最多 10 章,避免 LLM 处理过久)
  const limited = rawChapters.slice(0, 10);

  // 用 LLM 为每章生成命题和关键问题
  const chapters = [];
  for (let i = 0; i < limited.length; i++) {
    const ch = limited[i];
    const sampleText = truncateForLLM(ch.content, 3000);

    const systemPrompt = `你是一个资深的图书编辑。基于一章的内容,提炼本章的核心命题和可讨论的关键问题。`;

    const userPrompt = `# 书名: ${bookTitle}
# 章节标题: ${ch.title}

# 章节内容
${sampleText}

# 你的输出
严格输出 JSON(不要其他解释):
{
  "proposition": "本章核心命题(1-2句)",
  "key_questions": ["可引导的关键问题1", "问题2", "问题3"]
}

要求:
- proposition 要具体,不要泛泛
- key_questions 是可以引导读者思考的开放性问题`;

    try {
      const raw = await callLLM({ system: systemPrompt, messages: [{ role: 'user', content: userPrompt }], temperature: 0.4, max_tokens: 500 });
      const m = raw.match(/\{[\s\S]+\}/);
      if (m) {
        const parsed = JSON.parse(m[0]);
        chapters.push({
          index: i + 1,
          title: ch.title,
          proposition: parsed.proposition || `第${i + 1}章`,
          key_questions: parsed.key_questions || []
        });
      } else {
        chapters.push({
          index: i + 1,
          title: ch.title,
          proposition: ch.title,
          key_questions: [`本章的核心命题是什么?`]
        });
      }
    } catch (e) {
      console.warn(`[chapters] 第 ${i + 1} 章生成失败:`, e.message);
      chapters.push({
        index: i + 1,
        title: ch.title,
        proposition: ch.title,
        key_questions: [`本章的核心命题是什么?`]
      });
    }
  }

  return chapters;
}
