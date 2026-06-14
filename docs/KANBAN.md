# 聊书项目 Agent Team 看板

## 状态定义
- `todo`: 待处理
- `in_progress`: 进行中
- `done`: 已完成
- `blocked`: 阻塞

## 当前积压 (Backlog)

### MVP — 交付前必须完成

| ID | 描述 | 优先级 | 状态 |
|----|------|--------|------|
| MVP-1 | 账号/登录系统（注册、登录、JWT token） | P0 | done（后端 auth.js 完整，前端顶栏/设置页集成） |
| MVP-2 | 笔记导出 Markdown（后端接口 + 前端按钮） | P0 | done（`/api/user/book/:book_id/export` + 设置页/整书笔记页导出按钮） |
| MVP-3 | 50轮上限引导弹窗（保存笔记/继续下一章/继续聊） | P1 | done（`showLimitModal()` 替代 toast） |

### P1 — 待修复

| ID | 描述 | 优先级 | 来源 | 状态 |
|----|------|--------|------|------|
| P1-1 | `api.getAgent` 无错误处理，网络失败时未显示 loading 态 | P1 | CODE review | done（调用方已有 try/catch + emptyState，无需修改） |
| P1-2 | `submitQuestion` 存在竞态条件（多个请求并发） | P1 | CODE review | done（添加 isSending 锁，finally 释放） |
| P1-3 | `submitQuestion` 无网络错误处理 | P1 | CODE review | done（区分网络错误 vs 服务器错误，提示更友好） |
| P1-4 | `openReview` 无 try/catch，章节不存在时崩溃 | P1 | CODE review | done（onclick 处加 try/catch + toast 提示） |
| P1-5 | `renderChapterReview` 无 loading 态 | P1 | CODE review | done（已有 skeleton shimmer loading，无需修改） |
| P1-6 | `api.listBooks` 无 loading 态 | P1 | CODE review | done（renderShelf 已有 skeleton，无需修改） |
| P1-7 | `overview.chapters` 解构无默认值（`const { chapters } = overview` 会在章节缺失时崩溃） | P1 | CODE review | done（已有 `chapters = []` 默认值，无需修改） |

### P2 — 未来需求

| ID | 描述 | 优先级 | 状态 |
|----|------|--------|------|
| P2-1 | 匿名用户永久化（localStorage） | P2 | done（api.js 第17-24行） |
| P2-2 | 对话轮数限制（50轮上限） | P2 | done（views-book.js MAX_DIALOGUE_TURNS=50，达上限时toast警告+阻止发送） |
| P2-3 | 深色模式 | P2 | done（index.html [data-theme="dark"] 补 --warning/--warning-bg/--danger/--danger-bg + lc-toast-warning CSS + 移动端断点） |
| P2-4 | 移动端适配 | P2 | done（index.html 添加 @media(max-width:767px) 响应式断点） |
| P2-5 | PDF 导出 | P2 | done（routes.js GET /export?format=pdf 用 pdfkit 生成 A4 PDF；api.exportBookNote 支持 format 参数；views-book.js MD/PDF 双按钮导出） |
| P2-6 | voice/stt Buffer bug | P2 | done（routes-voice.js Buffer.from 前加 typeof body.audio === 'string' 检测，object 时返回 400） |
| P2-8 | CI 自动化测试 | P2 | done（scripts/smoke-test-frontend.mjs 前端UI冒烟测试，7个页面截图验证） |

### 已完成 (Done)

| ID | 描述 | 完成时间 |
|----|------|----------|
| P0-1 | `chapters = []` 解构无默认值导致 `renderBookSpace` 崩溃 | 2026-06-13 |
| P0-2 | `if(!chapter)` 缺失导致章节不存在时崩溃 | 2026-06-13 |
| P0-3 | `review || {}` 解构无防御导致章节回顾崩溃 | 2026-06-13 |
| P0-4 | `api.listBooks` 返回 undefined 导致 `renderBookShelf` 崩溃 | 2026-06-13 |
| P0-5 | `getDialogue` 需数组规范化导致对话列表崩溃 | 2026-06-13 |
| P0-6 | `bn` 解构 `bookNote?.note?.content` 无防御导致整书笔记崩溃 | 2026-06-13 |
| P0-7 | `recent_dialogue/remaining_topics` 解构无默认值导致 `showResumeModal` 崩溃 | 2026-06-13 |
| P0-8 | `dialogue = dialogue \|\| []` 入口防御 | 2026-06-13 |
| P0-9 | `catch` 分支 `dialogue` 来源缺失导致异常时崩溃 | 2026-06-13 |
| P0-10 | headless Chrome 随机 anon_xxx 导致测试数据不匹配（修法：默认 demo 用户） | 2026-06-13 |

## Agent Team 角色

| 角色 | 职责 | tmux 窗口 |
|------|------|----------|
| PM (Project Manager) | 监视看板、分解任务、派发、验收 | `liaoshu-pm` |
| QA (Quality Assurance) | 截图验证、回归测试、DOM dump | `liaoshu-qa` |
| CODE (Engineer) | 代码修复、功能开发、CODE review | `liaoshu-code` |

## 任务流转

```
用户/PM 发现问题
    ↓
PM 创建任务卡片 → 分配给对应 Worker
    ↓
Worker 执行 → 完成后更新状态 + 报告摘要
    ↓
PM 验收 → 通过则标记 done，不通过则新建修复任务
```

## 启动命令

```bash
# 启动 PM (项目管理员)
./scripts/start-pm.sh

# PM 检查任务
./scripts/pm-check.sh

# 派发任务给 QA（截图验证）
./scripts/spawn-qa.sh <task_id>

# 派发任务给 CODE（代码修复）
./scripts/spawn-code.sh <task_id>
```
