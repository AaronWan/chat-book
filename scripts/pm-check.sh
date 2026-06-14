#!/bin/bash
# PM 检查看板状态
# 用法: ./pm-check.sh

WORKDIR="/Users/wansong/Desktop/chat-book"
KANBAN="$WORKDIR/docs/KANBAN.md"

echo "=== 聊书项目 Agent Team 看板 ==="
echo ""
echo "--- P1 待修复 ---"
grep "^| P1-" "$KANBAN" | grep -v "^|" || echo "无"
echo ""
echo "--- P2 未来需求 ---"
grep "^| P2-" "$KANBAN" | grep -v "^|" | head -5 || echo "无"
echo ""
echo "--- 最近完成 ---"
grep "^| P0-" "$KANBAN" | grep -v "todo" | head -5 || echo "无"
echo ""
echo "--- 启动 PM ---"
echo "tmux attach -t liaoshu-pm"
echo ""
echo "--- 派发任务 ---"
echo "./scripts/spawn-code.sh P1-1 '修复 api.getAgent 错误处理'"
echo "./scripts/spawn-qa.sh P1-1 '验证截图'"
