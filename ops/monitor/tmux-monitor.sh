#!/usr/bin/env bash
set -u

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SESSION_NAME="LuxyHub Monitor"

if ! command -v tmux >/dev/null 2>&1; then
  printf 'tmux is required for the full dashboard but is not installed.\n\n'
  printf 'Install it on Ubuntu 24.04 with:\n'
  printf '  sudo apt update && sudo apt install tmux\n'
  exit 1
fi

if tmux has-session -t "$SESSION_NAME" 2>/dev/null; then
  tmux attach-session -t "$SESSION_NAME"
  exit 0
fi

tmux new-session -d -s "$SESSION_NAME" -n "Production Monitor"
tmux send-keys -t "$SESSION_NAME:0.0" "$SCRIPT_DIR/health.sh" C-m
tmux select-pane -t "$SESSION_NAME:0.0" -T "Health - /api/health"

tmux split-window -h -t "$SESSION_NAME:0"
tmux send-keys -t "$SESSION_NAME:0.1" "$SCRIPT_DIR/system.sh" C-m
tmux select-pane -t "$SESSION_NAME:0.1" -T "System - host and services"

tmux split-window -v -t "$SESSION_NAME:0.0"
tmux send-keys -t "$SESSION_NAME:0.2" "$SCRIPT_DIR/logs.sh" C-m
tmux select-pane -t "$SESSION_NAME:0.2" -T "PM2 Live Logs - luxyhub"

tmux split-window -v -t "$SESSION_NAME:0.1"
tmux send-keys -t "$SESSION_NAME:0.3" "$SCRIPT_DIR/shadow.sh" C-m
tmux select-pane -t "$SESSION_NAME:0.3" -T "Shadow Metrics - authenticated"

tmux select-layout -t "$SESSION_NAME:0" tiled
tmux set-option -t "$SESSION_NAME" pane-border-status top >/dev/null 2>&1 || true
tmux select-pane -t "$SESSION_NAME:0.0"
tmux attach-session -t "$SESSION_NAME"
