#!/usr/bin/env bash
set -u

RESET=$'\033[0m'
BOLD=$'\033[1m'
DIM=$'\033[2m'
GREEN=$'\033[32m'
YELLOW=$'\033[33m'
RED=$'\033[31m'
CYAN=$'\033[36m'

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    printf 'Missing required command: %s\n' "$1" >&2
    exit 1
  fi
}

header() {
  printf '\033c'
  printf '%s========================================%s\n' "$BOLD" "$RESET"
  printf '%s  System%s\n' "$BOLD" "$RESET"
  printf '%s========================================%s\n\n' "$BOLD" "$RESET"
}

colorize() {
  case "$1" in
    green) printf '%s%s%s' "$GREEN" "$2" "$RESET" ;;
    yellow) printf '%s%s%s' "$YELLOW" "$2" "$RESET" ;;
    red) printf '%s%s%s' "$RED" "$2" "$RESET" ;;
    *) printf '%s' "$2" ;;
  esac
}

row() {
  printf '%-18s ' "$1"
  colorize "${3:-neutral}" "$2"
  printf '\n'
}

usage_color() {
  local value="${1%.*}"

  if [ "$value" -ge 90 ] 2>/dev/null; then
    printf 'red'
  elif [ "$value" -ge 75 ] 2>/dev/null; then
    printf 'yellow'
  else
    printf 'green'
  fi
}

read_cpu_sample() {
  read -r _ user nice system idle iowait irq softirq steal _ < /proc/stat
  idle_total=$((idle + iowait))
  total=$((user + nice + system + idle + iowait + irq + softirq + steal))
}

cpu_usage() {
  read_cpu_sample
  local prev_idle="$idle_total"
  local prev_total="$total"
  sleep 0.2
  read_cpu_sample
  local total_delta=$((total - prev_total))
  local idle_delta=$((idle_total - prev_idle))

  if [ "$total_delta" -le 0 ]; then
    printf 'n/a'
  else
    awk -v total_delta="$total_delta" -v idle_delta="$idle_delta" 'BEGIN { printf "%.1f%%", (100 * (total_delta - idle_delta) / total_delta) }'
  fi
}

memory_usage() {
  free -m | awk '/^Mem:/ { printf "%sMiB / %sMiB (%.1f%%)", $3, $2, ($3 / $2) * 100 }'
}

memory_percent() {
  free -m | awk '/^Mem:/ { printf "%.0f", ($3 / $2) * 100 }'
}

disk_usage() {
  df -h / | awk 'NR == 2 { printf "%s / %s (%s)", $3, $2, $5 }'
}

disk_percent() {
  df / | awk 'NR == 2 { gsub("%", "", $5); print $5 }'
}

pm2_status() {
  if pm2 jlist 2>/dev/null | jq -r '.[] | "\(.name): \(.pm2_env.status) (cpu \(.monit.cpu // 0)%, mem \((.monit.memory // 0) / 1048576 | floor)MiB, restarts \(.pm2_env.restart_time // 0))"'; then
    return 0
  fi

  printf 'pm2 status unavailable\n'
  return 1
}

pm2_status_color() {
  if pm2 jlist 2>/dev/null | jq -e 'all(.[]; .pm2_env.status == "online")' >/dev/null 2>&1; then
    printf 'green'
  else
    printf 'red'
  fi
}

pm2_uptime() {
  pm2 jlist 2>/dev/null | jq -r '
    .[0].pm2_env.pm_uptime // empty
    | if . then
        ((now - .) / 1000 | floor) as $s |
        ($s / 86400 | floor) as $d |
        ($s % 86400 / 3600 | floor) as $h |
        ($s % 3600 / 60 | floor) as $m |
        (if $d > 0 then "\($d)d " else "" end) +
        (if $h > 0 or $d > 0 then "\($h)h " else "" end) +
        "\($m)m"
      else "n/a" end
  '
}

valkey_info() {
  redis-cli INFO server memory clients 2>/dev/null | tr -d '\r'
}

info_field() {
  awk -F: -v key="$1" '$1 == key { print $2; found = 1 } END { if (!found) print "n/a" }'
}

require_command free
require_command uptime
require_command df
require_command pm2
require_command jq
require_command awk

while true; do
  header

  cpu="$(cpu_usage)"
  cpu_value="${cpu%\%}"
  mem_percent="$(memory_percent)"
  disk_value="$(disk_percent)"

  row 'Node version' "$(node -v 2>/dev/null || printf 'n/a')"
  row 'PM2 uptime' "$(pm2_uptime)"

  printf '\n%sVPS Resources%s\n' "$DIM" "$RESET"
  row '  Disk' "$(disk_usage)" "$(usage_color "$disk_value")"
  row '  RAM' "$(memory_usage)" "$(usage_color "$mem_percent")"
  row '  CPU Load' "$cpu" "$(usage_color "$cpu_value")"

  printf '\n%sPM2 Process%s\n' "$DIM" "$RESET"
  pm2_color="$(pm2_status_color)"
  pm2_status | while IFS= read -r line; do
    row '  Process' "$line" "$pm2_color"
  done

  printf '\n%sValkey%s\n' "$DIM" "$RESET"
  if command -v redis-cli >/dev/null 2>&1; then
    info="$(valkey_info)"
    valkey_version="$(printf '%s\n' "$info" | info_field valkey_version)"
    if [ "$valkey_version" = 'n/a' ]; then
      valkey_version="$(printf '%s\n' "$info" | info_field redis_version)"
    fi
    row '  Memory' "$(printf '%s\n' "$info" | info_field used_memory_human)"
    row '  Uptime' "$(printf '%s\n' "$info" | info_field uptime_in_seconds) seconds"
    row '  Version' "$valkey_version"
    row '  Clients' "$(printf '%s\n' "$info" | info_field connected_clients)"
  else
    row '  Valkey' 'redis-cli unavailable' 'yellow'
  fi

  printf '\n%sRefreshes every 2 seconds.%s\n' "$DIM" "$RESET"
  sleep 2
done
