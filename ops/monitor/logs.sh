#!/usr/bin/env bash
set -u

RESET=$'\033[0m'
BOLD=$'\033[1m'
DIM=$'\033[2m'
RED=$'\033[31m'
YELLOW=$'\033[33m'
MAGENTA=$'\033[35m'
GREEN=$'\033[32m'
CYAN=$'\033[36m'

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    printf 'Missing required command: %s\n' "$1" >&2
    exit 1
  fi
}

require_command pm2

shopt -s nocasematch

printf '%s========================================%s\n' "$BOLD" "$RESET"
printf '%s  PM2 Logs%s\n' "$BOLD" "$RESET"
printf '%s========================================%s\n\n' "$BOLD" "$RESET"

pm2 logs luxyhub --lines 100 | while IFS= read -r line; do
  if [[ "$line" =~ (ERROR|error) ]]; then
    printf '%s%s%s\n' "$RED" "$line" "$RESET"
  elif [[ "$line" =~ (WARN|warn) ]]; then
    printf '%s%s%s\n' "$YELLOW" "$line" "$RESET"
  elif [[ "$line" =~ (FALLBACK|BACKEND\s*FAILURE) ]]; then
    printf '%s%s%s\n' "$RED" "$line" "$RESET"
  elif [[ "$line" =~ (LOOKUP\s*FAILURE) ]]; then
    printf '%s%s%s\n' "$YELLOW" "$line" "$RESET"
  elif [[ "$line" =~ (VALKEY|valkey) ]]; then
    printf '%s%s%s\n' "$MAGENTA" "$line" "$RESET"
  elif [[ "$line" =~ (POSTGRES|postgres) ]]; then
    printf '%s%s%s\n' "$CYAN" "$line" "$RESET"
  elif [[ "$line" =~ (SESSION|session) ]]; then
    printf '%s%s%s\n' "$GREEN" "$line" "$RESET"
  elif [[ "$line" =~ (DELIVERY|delivery) ]]; then
    printf '%s%s%s\n' "$MAGENTA" "$line" "$RESET"
  elif [[ "$line" =~ (RATE\s*LIMIT|rate.?limit) ]]; then
    printf '%s%s%s\n' "$CYAN" "$line" "$RESET"
  else
    printf '%s\n' "$line"
  fi
done
