#!/bin/bash
# 派发 QA 任务
# 用法: ./spawn-qa.sh <task_id> [描述]
# 示例: ./spawn-qa.sh P1-1 "验证 api.getAgent 错误处理"

TASK_ID="$1"
shift
DESCRIPTION="${*:-截图验证}"
WORKDIR="/Users/wansong/Desktop/chat-book"

if [ -z "$TASK_ID" ]; then
  echo "用法: $0 <task_id> [描述]"
  exit 1
fi

# 在 l1-pages 窗口执行 QA 任务
tmux send-keys -t "liaoshu-qa:l1-pages" ""
tmux send-keys -t "liaoshu-qa:l1-pages" "claude --print --system-prompt '你是 QA Agent，负责截图验证和回归测试。当前任务: $TASK_ID - $DESCRIPTION。工作目录: $WORKDIR。Chrome 服务在 http://localhost:3000。先读取 $WORKDIR/docs/KANBAN.md 和 $WORKDIR/docs/PROJECT_CONTEXT.md 了解上下文，然后执行任务。完成后更新 KANBAN.md 状态为 done 并报告结果。'" 2>/dev/null

echo "QA 任务已派发到 liaoshu-qa:l1-pages"
