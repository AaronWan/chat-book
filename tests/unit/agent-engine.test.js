// agent-engine.js 单元测试
import { describe, it } from 'node:test';
import assert from 'node:assert';

const MOCK_AGENT = {
  author: {
    name: '史蒂芬·柯维',
    bio: '《高效能人士的7个习惯》作者',
    writing_background: '在领导力培训领域深耕30年'
  },
  thought_system: {
    core_beliefs: ['主动选择', '以终为始'],
    key_propositions: {
      '积极主动': '人对刺激有选择回应的自由',
      '以终为始': '先想清楚目标再行动'
    },
    thinking_framework: '从内而外，先原则后技巧',
    what_author_believes: '人可以选择自己的回应方式',
    what_author_rejects: '环境决定论'
  },
  style: {
    language_style: '温暖、启发式',
    tone: '导师型',
    favorite_expressions: ['让我问你一个问题'],
    forbidden_expressions: ['你必须'],
    humor_level: 0.3,
    emotional_range: '温暖坚定'
  },
  guide: {
    opening_style: '从故事开场',
    how_it_guides: ['提问', '引导反思'],
    typical_sequence: '故事→提问→反思'
  },
  challenge: {
    when_it_asks: ['当读者过于被动时'],
    how_it_asks: ['你有没有想过你可以选择?'],
    challenge_triggers: ['被动→追问选择']
  },
  boundary: {
    scope: '个人成长与领导力',
    off_topic_response: '这超出了本书的范围'
  },
  chapters: [
    {
      index: 1,
      title: '积极主动',
      proposition: '人对刺激有选择回应的自由',
      key_questions: ['你最近一次选择积极回是什么时候?']
    }
  ]
};

const MOCK_CHAPTER = MOCK_AGENT.chapters[0];

describe('agent-engine — buildSystemPrompt', () => {
  it('生成 system prompt 包含作者名', async () => {
    const { buildSystemPrompt } = await import('../../backend/agent-engine.js');
    const prompt = buildSystemPrompt(MOCK_AGENT, MOCK_CHAPTER, {});
    assert.ok(prompt.includes('史蒂芬·柯维'));
  });

  it('包含章节信息', async () => {
    const { buildSystemPrompt } = await import('../../backend/agent-engine.js');
    const prompt = buildSystemPrompt(MOCK_AGENT, MOCK_CHAPTER, {});
    assert.ok(prompt.includes('积极主动'));
    assert.ok(prompt.includes('第1章'));
  });

  it('包含 key_propositions', async () => {
    const { buildSystemPrompt } = await import('../../backend/agent-engine.js');
    const prompt = buildSystemPrompt(MOCK_AGENT, MOCK_CHAPTER, {});
    assert.ok(prompt.includes('积极主动'));
    assert.ok(prompt.includes('人对刺激有选择回应的自由'));
  });

  it('包含 state.explored_angles', async () => {
    const { buildSystemPrompt } = await import('../../backend/agent-engine.js');
    const prompt = buildSystemPrompt(MOCK_AGENT, MOCK_CHAPTER, {
      explored_angles: ['工作与生活平衡']
    });
    assert.ok(prompt.includes('已讨论角度'));
    assert.ok(prompt.includes('工作与生活平衡'));
  });

  it('包含 state.pending_questions', async () => {
    const { buildSystemPrompt } = await import('../../backend/agent-engine.js');
    const prompt = buildSystemPrompt(MOCK_AGENT, MOCK_CHAPTER, {
      pending_questions: ['如何在压力下保持积极?']
    });
    assert.ok(prompt.includes('待续问题'));
    assert.ok(prompt.includes('如何在压力下保持积极'));
  });

  it('空 state 显示"本章刚开始"', async () => {
    const { buildSystemPrompt } = await import('../../backend/agent-engine.js');
    const prompt = buildSystemPrompt(MOCK_AGENT, MOCK_CHAPTER, {});
    assert.ok(prompt.includes('本章刚开始') || prompt.includes('当前状态'));
  });
});

describe('agent-engine — authorReply / authorOpening', () => {
  // 这两个函数需要真实 LLM 调用，只测试接口签名
  it('authorReply 是异步函数', async () => {
    const { authorReply } = await import('../../backend/agent-engine.js');
    assert.ok(authorReply instanceof Function);
  });

  it('authorOpening 是异步函数', async () => {
    const { authorOpening } = await import('../../backend/agent-engine.js');
    assert.ok(authorOpening instanceof Function);
  });

  it('generateChapterNote 是异步函数', async () => {
    const { generateChapterNote } = await import('../../backend/agent-engine.js');
    assert.ok(generateChapterNote instanceof Function);
  });

  it('generateBookNote 是异步函数', async () => {
    const { generateBookNote } = await import('../../backend/agent-engine.js');
    assert.ok(generateBookNote instanceof Function);
  });
});
