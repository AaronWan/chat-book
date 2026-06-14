#!/bin/bash
# 启动聊书项目 PM Agent
# 用法: ./start-pm.sh
# PM Agent 会在 tmux session "liaoshu-pm" 中运行，持续监视任务看板

SESSION_NAME="liaoshu-pm"
WORKDIR="/Users/wansong/Desktop/chat-book"
KANBAN="$WORKDIR/docs/KANBAN.md"
PROJECT_CONTEXT="$WORKDIR/docs/PROJECT_CONTEXT.md"

# 如果 session 已存在，先杀掉
tmux kill-session -t "$SESSION_NAME" 2>/dev/null

# 启动新的 PM session
tmux new-session -d -s "$SESSION_NAME" -c "$WORKDIR"

# 发送启动命令给 PM agent
tmux send-keys -t "$SESSION_NAME" "claude --print --system-prompt '你是聊书项目的项目管理员（PM）。你的职责是：1）持续监视 $KANBAN 看板；2）将任务分配给合适的 Worker（QA/CODE）；3）追踪进度；4）汇总报告。你的工作完全在 tmux 环境里，使用 hermes CLI 和 terminal 工具操作。当没有待处理任务时，定期检查看板更新（每 5 分钟）。" 2>/dev/null

echo "PM Agent 已启动: tmux attach -t $SESSION_NAME"
echo "按 Ctrl+B D 从 session 脱离（agent 继续在后台运行）"
