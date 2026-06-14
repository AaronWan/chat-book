# 作者智能体设计指南

## 一、定位:思想向导,不是问答机器

**核心原则**:作者智能体不是回答问题的,而是**带着读者思考的**。

```
传统 AI 问答:  你问 → 它答 → 结束
聊书作者智能体: 它抛出命题 → 你思考 → 它追问 → 整合 → 新的命题
```

## 二、5 个维度

每个作者智能体由 5 个维度构成:

| 维度 | 关键问题 | 缺失的代价 |
|------|----------|------------|
| **思想体系** | 作者信什么?反对什么? | 变成"百科全书",没有立场 |
| **表达风格** | 作者怎么说话? | 失去"作者味",读者出戏 |
| **引导方式** | 作者怎么带读者思考? | 变成单向输出,没有引导 |
| **追问模式** | 什么时候追问?怎么追问? | 失去"碰撞",对话浮于表面 |
| **边界设定** | 超出范围怎么办? | 越权回答,失去身份感 |

## 三、配置模板

参考 `data/agents/agent-7habits.json`(柯维)。新书配置时按以下结构:

```json
{
  "book_id": "<书ID>",
  "author": {
    "name": "作者中文名",
    "name_en": "Author English Name",
    "born_died": "1900-1980",
    "bio": "1-2 句作者背景",
    "other_books": ["代表作"],
    "writing_background": "本书的写作背景"
  },
  "thought_system": {
    "core_beliefs": ["信念 1", "信念 2", "信念 3"],
    "key_propositions": {
      "命题名 1": "一句话定义",
      "命题名 2": "一句话定义"
    },
    "thinking_framework": "作者的分析框架(1-2 句)",
    "what_author_believes": "作者深信什么",
    "what_author_rejects": "作者反对什么"
  },
  "style": {
    "language_style": "1 句风格描述",
    "tone": "语气关键词",
    "favorite_expressions": ["作者常用的口头禅"],
    "forbidden_expressions": ["绝对不能出现的词"],
    "humor_level": 0.0 - 1.0,
    "emotional_range": "情感范围"
  },
  "guide": {
    "opening_style": "开场风格",
    "how_it_guides": ["引导步骤 1", "步骤 2", ...],
    "typical_sequence": "标准对话序列"
  },
  "challenge": {
    "when_it_asks": ["追问触发条件 1", ...],
    "how_it_asks": ["追问方式 1", ...],
    "challenge_triggers": ["挑战触发条件 1", ...]
  },
  "boundary": {
    "scope": "智能体的讨论范围",
    "off_topic_response": "超出范围时的标准回应"
  },
  "chapters": [
    {
      "index": 1,
      "title": "章名",
      "proposition": "本章核心命题",
      "key_questions": ["可引导的关键问题 1", "问题 2"]
    }
  ]
}
```

## 四、质量标准

| 维度 | 标准 |
|------|------|
| **思想一致性** | 核心观点与原书一致,不出现与作者立场相悖的表述 |
| **表达风格** | 语言风格贴近真实作者,有辨识度 |
| **引导有效性** | 能有效引导读者思考,而非直接给答案 |
| **追问深度** | 追问能推向更深层的思考,而非表面问题 |
| **边界清晰** | 对话不偏离本书核心思想体系 |
| **情感真实** | 回应有情感温度,不机械 |

## 五、如何添加新书

### 步骤

1. 复制 `data/agents/agent-7habits.json` 为 `data/agents/agent-<新书ID>.json`
2. 按模板填写 5 个维度
3. 在 `data/books/builtin-books.json` 添加书籍信息,`agent_file` 指向新配置
4. 重启服务

### 示例:为《非暴力沟通》添加作者智能体

```bash
cp data/agents/agent-7habits.json data/agents/agent-nvc.json
# 编辑 nvc.json,填入马歇尔·卢森堡的信息
# 编辑 builtin-books.json,添加:
# { "id": "nvc", "title": "非暴力沟通", "agent_file": "agent-nvc.json", ... }
```

## 六、调优对话质量

如果 LLM 输出质量不达预期,可调整以下参数:

| 参数 | 位置 | 影响 |
|------|------|------|
| `temperature` | `llm-client.js` 中 `callLLM` | 0.5(稳定) / 0.75(平衡) / 1.0(创意) |
| `max_tokens` | `agent-engine.js` | 限制回复长度 |
| `favorite_expressions` | agent config | 增加"作者味" |
| `forbidden_expressions` | agent config | 避免出戏 |
| `how_it_guides` | agent config | 强化引导序列 |

## 七、常见问题

**Q: 智能体开始说"根据书中的观点"怎么办?**
A: 在 `forbidden_expressions` 中明确加入。这是 LLM 常见的"出戏"句式。

**Q: 智能体回答太长怎么办?**
A: 调整 `max_tokens`(默认 800)。或者在 system prompt 中强调"长度适中(80-200字)"。

**Q: 智能体"百科化",开始罗列知识点怎么办?**
A: 在 `thought_system.core_beliefs` 强化作者立场;在 system prompt 中强调"用作者的眼睛看问题"。

**Q: 智能体对每个问题都给完整答案,不追问?**
A: 检查 `challenge.when_it_asks` 和 `challenge.how_it_asks` 是否充分;在 system prompt 强化"主动追问"。
