#!/usr/bin/env bash
set -u

BASE_URL="${LUXYHUB_BASE_URL:-${1:-http://127.0.0.1:3000}}"
ENDPOINT="${BASE_URL%/}/api/internal/delivery-session"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
. "$SCRIPT_DIR/lib.sh"
load_monitor_token

AUTH_HEADER=()
if [ -n "${LUXY_MONITOR_TOKEN:-}" ]; then
  AUTH_HEADER=(-H "Authorization: Bearer ${LUXY_MONITOR_TOKEN}")
fi

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

fetch_monitor() {
  if [ -z "${LUXY_MONITOR_TOKEN:-}" ]; then
    printf 'missing-token\n401'
    return 0
  fi

  curl -sS --max-time 5 -X GET "${AUTH_HEADER[@]}" -w '\n%{http_code}' "$ENDPOINT"
}

header() {
  printf '\033c'
  printf '%s========================================%s\n' "$BOLD" "$RESET"
  printf '%s  Delivery Sessions%s\n' "$BOLD" "$RESET"
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

section() {
  printf '\n%s----------------------------------------%s\n' "$DIM" "$RESET"
}

auth_message() {
  printf '%sDelivery Sessions%s\n\n' "$BOLD" "$RESET"
  printf '%sMonitoring authentication not configured.%s\n\n' "$YELLOW" "$RESET"
  printf 'Endpoint:\n%s\n\n' '/api/internal/delivery-session'
  printf 'Set:\n%s\n\n' 'LUXY_MONITOR_TOKEN=xxxx'
  printf 'or export LUXY_MONITOR_TOKEN before launching this panel.\n\n'
  printf 'Supported headers:\n%s\n%s\n\n' 'Authorization: Bearer <token>' 'X-Luxy-Monitor-Token: <token>'
  printf 'No authentication bypass is attempted.\n'
}

require_command curl
require_command jq

while true; do
  header

  raw="$(fetch_monitor 2>&1)"
  fetch_status=$?

  if [ "$fetch_status" -ne 0 ]; then
    printf '%sDelivery session request failed:%s\n%s\n' "$RED" "$RESET" "$raw"
  else
    http_status="${raw##*$'\n'}"
    body="${raw%$'\n'*}"

    case "$http_status" in
      401|403|missing-token)
        auth_message
        ;;
      2*)
        if ! printf '%s\n' "$body" | jq -er . >/dev/null 2>&1; then
          printf '%sInvalid JSON from delivery session endpoint%s\n' "$RED" "$RESET"
          printf '%s\n' "$body"
        else
          is_authoritative=$(printf '%s\n' "$body" | jq -r '
            if .runtime.mode == "valkey" then "true" else "false" end
          ')

          printf '%s\n' "$body" | jq -r '
            def fixed2: (. * 100 | round / 100);
            def ms: if . == null then "n/a" else ((fixed2 | tostring) + " ms") end;
            def zero_color:
              if ((. // 0) | tonumber) > 0 then "red" else "green" end;
            def memory:
              if . == null then "n/a"
              elif . >= 1048576 then ((. / 1048576 | fixed2 | tostring) + " MiB")
              elif . >= 1024 then ((. / 1024 | fixed2 | tostring) + " KiB")
              else "1.3 MiB" end;

            [
              ["Mode", (.runtime.mode // "n/a"), "neutral"],
              ["State", (.runtime.operationalState // "n/a"), "neutral"]
            ] as $mode_info,

            [
              ["Sessions", "", "neutral"],
              ["  Created", ((.metrics.createdSessions // 0) | tostring), "neutral"],
              ["  Consumed", ((.metrics.consumedSessions // 0) | tostring), "neutral"],
              ["  Expired", ((.metrics.expiredSessions // 0) | tostring), (if ((.metrics.expiredSessions // 0) > 0) then "yellow" else "green" end)],
              ["  Active", ((.metrics.activeSessions // 0) | tostring), "neutral"]
            ] as $sessions,

            [
              ["Failures", "", "neutral"],
              ["  Lookup", ((.metrics.lookupFailures // 0) | tostring), ((.metrics.lookupFailures // 0) | zero_color)],
              ["  Backend", ((.metrics.backendFailures // 0) | tostring), ((.metrics.backendFailures // 0) | zero_color)],
              ["  Fallback", ((.rollout.fallbackCount // 0) | tostring), ((.rollout.fallbackCount // 0) | zero_color)]
            ] as $failures,

            [
              ["Performance", "", "neutral"],
              ["  Avg latency", ((.latency.valkeyAverageMs // .latency.postgresAverageMs) | ms), "neutral"],
              ["  Valkey latency", (.valkey.latencyMs | ms), "neutral"],
              ["  Memory", (.valkey.memoryUsedBytes | memory), "neutral"]
            ] as $perf

            | if .runtime.mode == "valkey" then
                $mode_info,
                ["Comparison", "Not applicable", "neutral"],
                $sessions,
                $failures,
                $perf
              else
                ["Comparison", "", "neutral"],
                ["  Total", ((.comparison.totalComparisons // 0) | tostring), "neutral"],
                ["  Mismatches", ((.comparison.mismatches // 0) | tostring), ((.comparison.mismatches // 0) | zero_color)],
                ["  Parity", (if .comparison.parity == null then "n/a" else ((.comparison.parity * 100) | fixed2 | tostring) + "%" end), (if .comparison.parity == null then "neutral" elif .comparison.parity >= 1 then "green" elif .comparison.parity >= 0.99 then "yellow" else "red" end)],
                $mode_info,
                $sessions,
                $failures,
                $perf
              end
            | .[]
            | @tsv
          ' | while IFS=$'\t' read -r label value color; do
            if [ "$label" = "Mode" ] || [ "$label" = "State" ] || [ "$label" = "Sessions" ] || [ "$label" = "Failures" ] || [ "$label" = "Performance" ] || [ "$label" = "Comparison" ]; then
              printf '%s%s%s\n' "$DIM" "$label" "$RESET"
            else
              printf '%-22s ' "$label"
              if [ "$color" = "neutral" ] || [ -z "$color" ]; then
                printf '%s\n' "$value"
              else
                colorize "$color" "$value"
                printf '\n'
              fi
            fi
          done
        fi
        ;;
      *)
        printf 'HTTP %s\n\n' "$http_status"
        printf 'Delivery session metrics unavailable.\n'
        ;;
    esac
  fi

  printf '\n%sRefreshes every 2 seconds.  Endpoint: %s%s\n' "$DIM" "$ENDPOINT" "$RESET"
  sleep 2
done
