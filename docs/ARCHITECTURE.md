# 架构说明

## 总体架构

```
┌──────────────────────────────────────────────┐
│  Frontend (单页 Web, Tailwind CDN, 原生 JS)  │
│  7 个核心界面 + 简易 hash 路由              │
└──────────────┬───────────────────────────────┘
               │ fetch + JSON
┌──────────────▼───────────────────────────────┐
│  Backend (Node.js + Express)                │
│  - 9 个 API 端点                            │
│  - 作者智能体引擎                           │
│  - LLM 客户端                               │
│  - JSON 文件持久化                          │
└──────────────┬───────────────────────────────┘
               │ OpenAI 兼容协议
┌──────────────▼───────────────────────────────┐
│  LLM (Claude Sonnet 4.6 via aihub.firstshare)│
└──────────────────────────────────────────────┘
               │
┌──────────────▼───────────────────────────────┐
│  持久化 (JSON 文件)                         │
│  - 内置书库 / 作者智能体配置                 │
│  - 用户数据 / 对话历史 / 聊书笔记           │
└──────────────────────────────────────────────┘
```

## 数据流(以"用户发送消息"为例)

```
[用户输入消息]
    ↓
[Frontend: renderMessage 立即显示用户消息]
    ↓
[POST /api/user/chapter/message]
    ↓
[Backend storage.appendDialogueMessage] → 持久化
    ↓
[Backend agent-engine.authorReply]
    ├─ buildSystemPrompt(agent, chapter, state) → 拼装 Prompt
    └─ callLLM({ system, messages }) → 调 LLM
        ↓
[Backend storage.appendDialogueMessage] → 持久化作者回复
    ↓
[返回 JSON]
    ↓
[Frontend: 渲染作者消息]
```

## 作者智能体引擎设计

详见 `backend/agent-engine.js`。

**核心:不是"调用 LLM",而是"结构化 Prompt 工程"。**

每个作者智能体配置包含 5 个维度:
1. `thought_system` - 思想体系(核心信念、关键命题、思维框架)
2. `style` - 表达风格(语言风格、常用表达、禁忌表达)
3. `guide` - 引导方式(开场风格、引导序列)
4. `challenge` - 追问模式(什么时候追问、怎么追问)
5. `boundary` - 边界设定(范围、超出范围时的回应)

`buildSystemPrompt()` 把这些配置 + 当前章节 + 对话状态,拼装成一个完整的 system prompt。

## 持久化策略

MVP 阶段使用 JSON 文件持久化,设计目标:
- **零依赖**:不引入数据库,降低启动成本
- **可读**:数据以 JSON 格式存储,方便调试
- **可扩展**:接口层抽象,后续可平滑迁移到 PostgreSQL

文件结构:
- `data/users/{user_id}.json` - 用户基本信息 + 书架
- `data/users/{user_id}_chapters_{book_id}.json` - 单书的章节进度
- `data/dialogues/{user_id}__{book_id}__ch{n}.json` - 章节对话历史
- `data/notes/{user_id}__{book_id}__ch{n}.json` - 章节笔记
- `data/notes/{user_id}__{book_id}__book.json` - 整书笔记

## 后续架构演进

| 阶段 | 变更 | 原因 |
|------|------|------|
| V1.0 | 用户表 + JWT 鉴权 | 多用户 + 移动端 |
| V1.0 | PostgreSQL 替换 JSON | 性能 + 事务 |
| V1.0 | Redis 缓存作者智能体 | 减少 IO |
| V1.0 | 文件存储 → 对象存储(S3) | 书籍文件管理 |
| V1.5 | Milvus 向量数据库 | 语义搜索 |
| V1.5 | 消息队列(RabbitMQ) | 异步处理(自建智能体) |
| V1.5 | WebSocket | 实时流式对话 |
