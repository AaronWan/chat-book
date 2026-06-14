#!/bin/bash
# 派发 CODE 任务
# 用法: ./spawn-code.sh <task_id> [描述]
# 示例: ./spawn-code.sh P1-1 "修复 api.getAgent 错误处理"

TASK_ID="$1"
shift
DESCRIPTION="${*:-代码修复}"
WORKDIR="/Users/wansong/Desktop/chat-book"

if [ -z "$TASK_ID" ]; then
  echo "用法: $0 <task_id> [描述]"
  exit 1
fi

# 在 code-review 窗口执行 CODE 任务
tmux send-keys -t "liaoshu-qa:code-review" ""
tmux send-keys -t "liaoshu-qa:code-review" "claude --print --system-prompt '你是 CODE Agent，负责代码修复和功能开发。当前任务: $TASK_ID - $DESCRIPTION。工作目录: $WORKDIR。Claude Code CLI: /Users/wansong/.local/bin/claude。先读取 $WORKDIR/docs/KANBAN.md 和 $WORKDIR/docs/PROJECT_CONTEXT.md 了解上下文，然后修复代码。完成后更新 KANBAN.md 状态为 done 并报告结果。'" 2>/dev/null

echo "CODE 任务已派发到 liaoshu-qa:code-review"
