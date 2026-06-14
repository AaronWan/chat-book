# API 文档

所有 API 都挂载在 `/api` 下。Base URL: `http://localhost:3000`。

**用户标识**:除公开接口外,所有接口需在 header 中携带 `X-User-Id`。
MVP 阶段不做鉴权,用户 ID 由前端生成并存储在 localStorage。

## 响应格式

成功:
```json
{ "data": ..., "其他字段": ... }
```

失败:
```json
{ "error": "错误描述" }
```

状态码: 200(成功) / 400(参数错误) / 404(资源不存在) / 500(服务器错误)

---

## 1. 内置书库

### GET /api/books
获取所有内置书。

**响应**:
```json
{
  "books": [
    { "id": "7habits", "title": "高效能人士的7个习惯", "author": "史蒂芬·柯维", ... }
  ]
}
```

### GET /api/books/:id
获取单本书详情。

### GET /api/books/:id/agent
获取作者智能体配置(完整结构,含章节命题)。

### GET /api/books/:id/chapters/:index
获取指定章节(命题、关键问题)。

---

## 2. 用户书架

### GET /api/user/shelf
获取用户书架(含书籍详情)。

**响应**:
```json
{
  "shelf": [
    {
      "book_id": "7habits",
      "status": "进行中",
      "progress_percent": 13,
      "started_at": "2026-06-11T...",
      "last_read_at": "2026-06-11T...",
      "book": { "id": "7habits", "title": "...", "cover_color": "#3B5998", ... }
    }
  ]
}
```

### POST /api/user/shelf/add
**Body**: `{ "book_id": "7habits", "status": "想聊" }`
添加书到书架。

### POST /api/user/shelf/start
**Body**: `{ "book_id": "7habits" }`
将状态改为"进行中"。

### POST /api/user/shelf/finish
**Body**: `{ "book_id": "7habits" }`
将状态改为"已聊完"。

### DELETE /api/user/shelf/:book_id
从书架移除。

---

## 3. 单书空间

### GET /api/user/book/:book_id/overview
**响应**:
```json
{
  "book": { ... },
  "agent_meta": { "name": "史蒂芬·柯维", "bio": "..." },
  "shelf": { ... },
  "chapters": [
    {
      "index": 1,
      "title": "由内而外造就自己",
      "proposition": "...",
      "status": "已聊完",
      "dialogue_turns": 7,
      "last_message_id": "m_xxx"
    }
  ],
  "progress_percent": 13
}
```

---

## 4. 章节对话

### POST /api/user/chapter/start
**Body**: `{ "book_id": "7habits", "chapter_index": 1 }`
开启章节。如果该章节无对话,自动生成作者开场白(LLM 调用)。

**响应**:
```json
{
  "message": { "id": "m_xxx", "role": "author", "content": "..." },
  "dialogue": [ ... ]
}
```

### POST /api/user/chapter/message
**Body**: `{ "book_id": "7habits", "chapter_index": 1, "content": "用户的回复" }`
发送用户消息,获取作者回复(LLM 调用)。

**响应**:
```json
{
  "user_message": { ... },
  "author_message": { ... },
  "dialogue": [ ... ]
}
```

### GET /api/user/chapter/:book_id/:chapter_index/dialogue
获取章节的完整对话历史。

### GET /api/user/chapter/:book_id/:chapter_index/resume
快速 Resume 数据:
```json
{
  "recent_dialogue": [ 最近 6 条消息 ],
  "pending_questions": [ 用户留下的未解问题 ],
  "remaining_topics": [ 章节未展开的关键问题 ],
  "status": "进行中",
  "dialogue_turns": 7
}
```

### POST /api/user/chapter/close
**Body**: `{ "book_id": "7habits", "chapter_index": 1 }`
收尾章节,自动生成章节聊书笔记(LLM 调用)。

**响应**:
```json
{
  "note": {
    "user_id": "demo",
    "book_id": "7habits",
    "chapter_index": 1,
    "content": {
      "core_insights": ["用户原话 1", "用户原话 2", ...],
      "collisions": [
        { "user": "用户原话", "author": "作者回应摘要" }
      ],
      "questions": ["用户留下的未解问题"],
      "extensions": ["用户的延伸思考"]
    }
  }
}
```

### GET /api/user/chapter/:book_id/:chapter_index/note
获取章节笔记。

### GET /api/user/chapter/:book_id/:chapter_index/review
获取章节回顾(章节 + 笔记 + 对话统计)。

---

## 5. 整书笔记

### POST /api/user/book/:book_id/note/close
收尾整书,生成整书笔记。需要至少一个章节已完成。

**响应**:
```json
{
  "note": {
    "content": {
      "reading_info": { "turns": 7, "insights_count": 12 },
      "chapter_notes": [ ... ],
      "core_reflections": [ 跨章节核心思考 ],
      "action_changes": [ 可落地的行动 ],
      "overall_tone": "..."
    }
  }
}
```

### GET /api/user/book/:book_id/note
获取整书笔记。

---

## 6. 搜索

### GET /api/user/search?q=关键词
在用户所有对话 + 笔记中搜索。

**响应**:
```json
{
  "results": [
    {
      "book_id": "7habits",
      "book_title": "高效能人士的7个习惯",
      "chapter_index": 1,
      "message_id": "m_xxx",
      "role": "user",
      "snippet": "...含关键词的片段...",
      "full_content": "..."
    }
  ]
}
```

---

## 错误码

| 状态码 | 含义 |
|--------|------|
| 200 | 成功 |
| 400 | 参数错误(缺字段、格式不对) |
| 404 | 资源不存在(书/章节/用户) |
| 500 | 服务器错误(通常 LLM 调用失败) |

错误响应统一格式:
```json
{ "error": "人类可读的错误描述" }
```
