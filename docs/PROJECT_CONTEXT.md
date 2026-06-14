# 聊书项目上下文 — Agent Team 共享知识库
# 所有 Agent 启动时加载此文件

## 项目概述
- **名称**: 聊书 (ChatBook)
- **前端**: `/Users/wansong/Desktop/chat-book/frontend` (单页应用，hash 路由)
- **后端**: `/Users/wansong/Desktop/chat-book/backend` (Node.js)
- **测试数据目录**: `/Users/wansong/Desktop/chat-book/data`
- **Chrome 截图输出**: `/tmp/liaoshu_screenshots/`
- **截图验证目录**: `/tmp/qa_demo3/`
- **本地服务**: 前端 `http://localhost:3000`，后端 `http://localhost:3001`

## 技术栈
- 前端: 原生 JS + Tailwind CSS，hash 路由，CDN 依赖
- 后端: Node.js，JSON 文件存储
- Agent: Claude Code CLI (`/Users/wansong/.local/bin/claude`)
- tmux session 名: `liaoshu-qa`（已有 l1-pages、l2-pages、code-review 窗口）

## 测试书籍
- 书 ID: `7habits`（高效能人士的七个习惯）
- demo 用户: `demo`（测试数据默认用户）
- headless Chrome 截图: `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome --headless=new --disable-gpu --screenshot=<path> --window-size=1440,900 --virtual-time-budget=6000 <url>`

## 已完成 P0 修复（2026-06-13）
1. `chapters = []` 解构默认值
2. `if(!chapter)` 防御
3. `review || {}` 解构防御
4. `r?.books || []` 防御
5. `Array.isArray` 兼容层
6. `bn` 解构防御
7. `recent_dialogue/remaining_topics = []` 默认值
8. `dialogue = dialogue || []` 入口防御
9. `catch` 分支显式传 `[]`
10. `api.js` 默认 anon 用户改为 `demo`

## P1 待修复（见 KANBAN.md）
- `api.getAgent` 无错误处理
- `submitQuestion` 竞态条件
- `openReview` 无 try/catch
- `renderChapterReview` / `api.listBooks` 无 loading 态
- `overview.chapters` 解构无默认值

## 关键文件
- `frontend/views-book.js` — 主要业务逻辑（对话渲染、笔记生成）
- `frontend/api.js` — API 层（用户识别、数据获取）
- `frontend/components/` — UI 组件目录
- `docs/KANBAN.md` — 任务看板
- `docs/ARCHITECTURE.md` — 系统架构
- `docs/AGENT.md` — 作者智能体设计指南

## Agent Team 角色
| 角色 | 职责 | tmux 窗口 |
|------|------|----------|
| PM | 监视看板、分解任务、派发 | `liaoshu-pm` |
| QA | 截图验证、回归测试 | `liaoshu-qa` |
| CODE | 代码修复、功能开发 | `liaoshu-code` |

## 工作约定
1. **所有任务经看板流转**，不在聊天中直接处理
2. **PM 派发任务时**，附带完整 context（问题描述、相关文件、验收标准）
3. **Worker 完成后**，更新 KANBAN.md 状态 + 在飞书报告摘要
4. **截图验证标准**：文件大小 > 50KB，非白色区域占比 > 1%
