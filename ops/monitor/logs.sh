#!/usr/bin/env bash
set -u

RESET=$'\033[0m'
BOLD=$'\033[1m'
RED=$'\033[31m'
YELLOW=$'\033[33m'
MAGENTA=$'\033[35m'
CYAN=$'\033[36m'

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    printf 'Missing required command: %s\n' "$1" >&2
    exit 1
  fi
}

require_command pm2

shopt -s nocasematch

printf '%sLuxyHub Production Monitor%s\n' "$BOLD" "$RESET"
printf '%sPM2 Live Logs%s\n' "$CYAN" "$RESET"
printf 'Current refresh timestamp: %(%Y-%m-%d %H:%M:%S %Z)T\n' -1
printf 'Command: pm2 logs luxyhub\n\n'

pm2 logs luxyhub --lines 100 | while IFS= read -r line; do
  if [[ "$line" =~ ERROR|error|timeout|disconnect ]]; then
    printf '%s%s%s\n' "$RED" "$line" "$RESET"
  elif [[ "$line" =~ WARN|warn|fallback|comparison|mismatch ]]; then
    printf '%s%s%s\n' "$YELLOW" "$line" "$RESET"
  elif [[ "$line" =~ lua|redis ]]; then
    printf '%s%s%s\n' "$MAGENTA" "$line" "$RESET"
  else
    printf '%s\n' "$line"
  fi
done
