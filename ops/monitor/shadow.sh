#!/usr/bin/env bash
set -u

BASE_URL="${LUXYHUB_BASE_URL:-${1:-http://127.0.0.1:3000}}"
ENDPOINT="${BASE_URL%/}/api/internal/rate-limit-shadow"

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

fetch_shadow() {
  if [ -z "${LUXY_MONITOR_TOKEN:-}" ]; then
    printf 'missing-token\n401'
    return 0
  fi

  curl -sS --max-time 5 -X GET "${AUTH_HEADER[@]}" -w '\n%{http_code}' "$ENDPOINT"
}

header() {
  printf '\033c'
  printf '%s========================================%s\n' "$BOLD" "$RESET"
  printf '%s  Rate Limit%s\n' "$BOLD" "$RESET"
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

auth_message() {
  printf '%sRate Limit%s\n\n' "$BOLD" "$RESET"
  printf '%sMonitoring authentication not configured.%s\n\n' "$YELLOW" "$RESET"
  printf 'Endpoint:\n%s\n\n' '/api/internal/rate-limit-shadow'
  printf 'Set:\n%s\n\n' 'LUXY_MONITOR_TOKEN=xxxx'
  printf 'or export LUXY_MONITOR_TOKEN before launching this panel.\n\n'
  printf 'Supported headers:\n%s\n%s\n\n' 'Authorization: Bearer <token>' 'X-Luxy-Monitor-Token: <token>'
  printf 'No authentication bypass is attempted.\n'
}

require_command curl
require_command jq

while true; do
  header

  raw="$(fetch_shadow 2>&1)"
  fetch_status=$?

  if [ "$fetch_status" -ne 0 ]; then
    printf '%sRate limit request failed:%s\n%s\n' "$RED" "$RESET" "$raw"
  else
    http_status="${raw##*$'\n'}"
    body="${raw%$'\n'*}"

    case "$http_status" in
      401|403|missing-token)
        auth_message
        ;;
      2*)
        if ! printf '%s\n' "$body" | jq -er . >/dev/null 2>&1; then
          printf '%sInvalid JSON from rate limit endpoint%s\n' "$RED" "$RESET"
          printf '%s\n' "$body"
        else
          is_valkey=$(printf '%s\n' "$body" | jq -r '
            if .runtime.mode == "valkey" then "true" else "false" end
          ')

          if [ "$is_valkey" = "true" ]; then
            printf '%s\n' "$body" | jq -r '
              def fixed2: (. * 100 | round / 100);
              def ms: if . == null then "n/a" else ((fixed2 | tostring) + " ms") end;
              def zero_color:
                if ((. // 0) | tonumber) > 0 then "red" else "green" end;

              [
                ["Mode", (.runtime.mode // "n/a"), "neutral"],
                ["State", (.runtime.operationalState // "n/a"), "neutral"],
                ["", "", "neutral"],
                ["Production Mode", "Comparison disabled.", "neutral"],
                ["", "", "neutral"],
                ["Requests", (.rollout.valkeyAuthoritativeWrites // 0 | tostring), "neutral"],
                ["Backend Failures", ((.health.backendFailures // 0) | tostring), ((.health.backendFailures // 0) | zero_color)],
                ["Fallback", ((.rollout.fallbackCount // 0) | tostring), ((.rollout.fallbackCount // 0) | zero_color)]
              ]
              | .[]
              | @tsv
            ' | while IFS=$'\t' read -r label value color; do
              printf '%-24s ' "$label"
              if [ "$color" = "neutral" ] || [ -z "$color" ]; then
                printf '%s\n' "$value"
              else
                colorize "$color" "$value"
                printf '\n'
              fi
            done
          else
            printf '%s\n' "$body" | jq -r '
              def fixed2: (. * 100 | round / 100);
              def ms: if . == null then "n/a" else ((fixed2 | tostring) + " ms") end;
              def pct: if . == null then "n/a" else (((. * 100) | fixed2 | tostring) + "%") end;
              def parity_color:
                if . == null then "neutral"
                elif . >= 1 then "green"
                elif . >= 0.99 then "yellow"
                else "red" end;
              def zero_color:
                if ((. // 0) | tonumber) > 0 then "red" else "green" end;
              def parity_rate:
                if (.metrics.totalComparisons // 0) == 0
                then null
                else ((.metrics.identical // 0) / .metrics.totalComparisons)
                end;

              [
                ["Parity", (parity_rate | pct), (parity_rate | parity_color)],
                ["Mismatch", ((.metrics.mismatches // 0) | tostring), ((.metrics.mismatches // 0) | zero_color)],
                ["", "", "neutral"],
                ["Allow parity", ((.decisionParity.allowParity // .decisionParity.allowedParity // .decisionParity.allow) | pct), ((.decisionParity.allowParity // .decisionParity.allowedParity // .decisionParity.allow) | parity_color)],
                ["Deny parity", ((.decisionParity.denyParity // .decisionParity.deniedParity // .decisionParity.deny) | pct), ((.decisionParity.denyParity // .decisionParity.deniedParity // .decisionParity.deny) | parity_color)],
                ["Retry-after parity", (.retryAfterParity | pct), (.retryAfterParity | parity_color)],
                ["", "", "neutral"],
                ["Backend failures", ((.health.backendFailures // 0) | tostring), ((.health.backendFailures // 0) | zero_color)],
                ["Comparison failures", ((.health.comparisonFailures // 0) | tostring), ((.health.comparisonFailures // 0) | zero_color)],
                ["", "", "neutral"],
                ["Canary requests", ((.rollout.canaryRequests // 0) | tostring), "neutral"],
                ["Postgres requests", ((.rollout.postgresRequests // .rollout.postgresAuthoritativeWrites // 0) | tostring), "neutral"],
                ["Valkey requests", ((.rollout.valkeyRequests // .rollout.valkeyAuthoritativeWrites // 0) | tostring), "neutral"],
                ["Avg latency delta", (.metrics.averageLatencyDeltaMs | ms), "neutral"]
              ]
              | .[]
              | @tsv
            ' | while IFS=$'\t' read -r label value color; do
              printf '%-24s ' "$label"
              if [ "$color" = "neutral" ] || [ -z "$color" ]; then
                printf '%s\n' "$value"
              else
                colorize "$color" "$value"
                printf '\n'
              fi
            done
          fi
        fi
        ;;
      *)
        printf 'HTTP %s\n\n' "$http_status"
        printf 'Rate limit metrics unavailable.\n'
        ;;
    esac
  fi

  printf '\n%sRefreshes every 2 seconds.  Endpoint: %s%s\n' "$DIM" "$ENDPOINT" "$RESET"
  sleep 2
done
