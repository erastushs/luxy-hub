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
  printf '%sLuxyHub Production Monitor%s\n' "$BOLD" "$RESET"
  printf '%sDelivery Session%s\n' "$CYAN" "$RESET"
  printf 'Current refresh timestamp: %(%Y-%m-%d %H:%M:%S %Z)T\n' -1
  printf 'Endpoint: %s\n\n' "$ENDPOINT"
}

colorize() {
  case "$1" in
    green) printf '%s%s%s' "$GREEN" "$2" "$RESET" ;;
    yellow) printf '%s%s%s' "$YELLOW" "$2" "$RESET" ;;
    red) printf '%s%s%s' "$RED" "$2" "$RESET" ;;
    *) printf '%s' "$2" ;;
  esac
}

render_rows() {
  while IFS=$'\t' read -r label value color; do
    printf '%-28s ' "$label"
    colorize "$color" "$value"
    printf '\n'
  done
}

auth_message() {
  printf '%sDelivery Session%s\n\n' "$BOLD" "$RESET"
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
  status=$?

  if [ "$status" -ne 0 ]; then
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
          printf '%s\n' "$body" | jq -r '
            def fixed2: (. * 100 | round / 100);
            def ms: if . == null then "n/a" else ((fixed2 | tostring) + " ms") end;
            def pct: if . == null then "n/a" else ((fixed2 | tostring) + "%") end;
            def pct4: if . == null then "n/a" else (((. * 100) | fixed2 | tostring) + "%") end;
            def zero_color:
              if ((. // 0) | tonumber) > 0 then "red" else "green" end;
            def neg_color:
              if (. == null) then "neutral"
              elif . then "green"
              else "red" end;
            def memory:
              if . == null then "n/a"
              elif . >= 1048576 then ((. / 1048576 | fixed2 | tostring) + " MiB")
              elif . >= 1024 then ((. / 1024 | fixed2 | tostring) + " KiB")
              else "1.3 MiB" end;
            def effective_canary:
              if .rollout.effectiveCanaryPercentage == 0 and .runtime.mode == "postgres" then 0
              else .rollout.effectiveCanaryPercentage end;

            [
              ["Mode", (.runtime.mode // "n/a"), "neutral"],
              ["Operational", (.runtime.operationalState // "n/a"), "neutral"],
              ["", "", "neutral"],
              ["Created", ((.metrics.createdSessions // 0) | tostring), "neutral"],
              ["Consumed", ((.metrics.consumedSessions // 0) | tostring), "neutral"],
              ["Expired", ((.metrics.expiredSessions // 0) | tostring), (if ((.metrics.expiredSessions // 0) > 0) then "yellow" else "green" end)],
              ["", "", "neutral"],
              ["Active", ((.metrics.activeSessions // 0) | tostring), "neutral"],
              ["", "", "neutral"],
              ["Lookup Failures", ((.metrics.lookupFailures // 0) | tostring), ((.metrics.lookupFailures // 0) | zero_color)],
              ["Backend Failures", ((.metrics.backendFailures // 0) | tostring), ((.metrics.backendFailures // 0) | zero_color)],
              ["Comparison Failures", ((.metrics.comparisonFailures // 0) | tostring), ((.metrics.comparisonFailures // 0) | zero_color)],
              ["Fallback", ((.rollout.fallbackCount // 0) | tostring), ((.rollout.fallbackCount // 0) | zero_color)],
              ["", "", "neutral"],
              ["Total comparisons", ((.comparison.totalComparisons // 0) | tostring), "neutral"],
              ["Identical", ((.comparison.identical // 0) | tostring), "green"],
              ["Mismatches", ((.comparison.mismatches // 0) | tostring), ((.comparison.mismatches // 0) | zero_color)],
              ["Parity", (.comparison.parity | pct4), (if (.comparison.parity == null) then "neutral" elif (.comparison.parity >= 1) then "green" elif (.comparison.parity >= 0.99) then "yellow" else "red" end)],
              ["Mismatch Rate", (.comparison.mismatchRate | pct4), (if ((.comparison.mismatchRate // 0) | tonumber) == 0 then "green" else "red" end)],
              ["", "", "neutral"],
              ["Comparison Breakdown", "", "neutral"]
            ]
            | .[]
            | @tsv
          ' | render_rows

          printf '\n%s%sComparison Breakdown%s\n\n' "$BOLD" "$CYAN" "$RESET"

          printf '%s\n' "$body" | jq -r '
            def fixed2: (. * 100 | round / 100);
            def pct: if . == null then "  n/a" else ((fixed2 * 100 | tostring) + "%") end;
            def zpad: if (. // 0) < 10 then "  \(.)" else " \(.)" end;

            .comparison.breakdown // {}
            | to_entries
            | map(
                "  \(.key | ascii_upcase | .[0:1] + .[1:])\n" +
                "    Total      \(.value.total | zpad)\n" +
                "    Mismatch   \(.value.mismatches | zpad)\n" +
                "    Parity     \(.value.parity | pct)"
              )
            | .[]
          '

          printf '\n%s\n' "$body" | jq -r '
            def fixed2: (. * 100 | round / 100);
            def ms: if . == null then "n/a" else ((fixed2 | tostring) + " ms") end;
            def pct: if . == null then "n/a" else ((fixed2 | tostring) + "%") end;
            def pct4: if . == null then "n/a" else (((. * 100) | fixed2 | tostring) + "%") end;
            def zero_color:
              if ((. // 0) | tonumber) > 0 then "red" else "green" end;
            def neg_color:
              if (. == null) then "neutral"
              elif . then "green"
              else "red" end;
            def memory:
              if . == null then "n/a"
              elif . >= 1048576 then ((. / 1048576 | fixed2 | tostring) + " MiB")
              elif . >= 1024 then ((. / 1024 | fixed2 | tostring) + " KiB")
              else "1.3 MiB" end;
            def effective_canary:
              if .rollout.effectiveCanaryPercentage == 0 and .runtime.mode == "postgres" then 0
              else .rollout.effectiveCanaryPercentage end;

            [
              ["", "", "neutral"],
              ["Postgres Avg", (.latency.postgresAverageMs | ms), "neutral"],
              ["Valkey Avg", (.latency.valkeyAverageMs | ms), "neutral"],
              ["Delta Avg", (.latency.deltaAverageMs | ms), "neutral"],
              ["", "", "neutral"],
              ["Valkey status", (.valkey.status // "n/a"), (if (.valkey.status // "") == "healthy" then "green" elif (.valkey.status // "") == "unhealthy" then "red" else "yellow" end)],
              ["Valkey state", (.valkey.connectionState // "n/a"), (if (.valkey.connectionState // "") == "ready" then "green" else "yellow" end)],
              ["Valkey latency", (.valkey.latencyMs | ms), (if ((.valkey.latencyMs // 0) | tonumber) <= 5 then "green" else "yellow" end)],
              ["Valkey memory", (.valkey.memoryUsedBytes | memory), "neutral"]
            ]
            | .[]
            | @tsv
          ' | render_rows
        fi
        ;;
      *)
        printf 'HTTP %s\n\n' "$http_status"
        printf 'Delivery session metrics unavailable.\n'
        ;;
    esac
  fi

  printf '\n%sRefreshes every 2 seconds.%s\n' "$DIM" "$RESET"
  sleep 2
done
