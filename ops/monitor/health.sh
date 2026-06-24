#!/usr/bin/env bash
set -u

BASE_URL="${LUXYHUB_BASE_URL:-${1:-http://127.0.0.1:3000}}"
ENDPOINT="${BASE_URL%/}/api/health"

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

fetch_health() {
  curl -fsS --max-time 5 -X GET "$ENDPOINT"
}

header() {
  printf '\033c'
  printf '%sLuxyHub Production Monitor%s\n' "$BOLD" "$RESET"
  printf '%sHealth%s\n' "$CYAN" "$RESET"
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
    printf '%-34s ' "$label"
    colorize "$color" "$value"
    printf '\n'
  done
}

require_command curl
require_command jq

while true; do
  header

  response="$(fetch_health 2>&1)"
  status=$?

  if [ "$status" -ne 0 ]; then
    printf '%sHealth request failed:%s\n%s\n' "$RED" "$RESET" "$response"
  elif ! printf '%s\n' "$response" | jq -er . >/dev/null 2>&1; then
    printf '%sInvalid JSON from health endpoint%s\n' "$RED" "$RESET"
    printf '%s\n' "$response"
  else
    printf '%s\n' "$response" | jq -r '
      def fixed2: (. * 100 | round / 100);
      def pct_ratio: if . == null then "n/a" else (((. * 100) | fixed2 | tostring) + "%") end;
      def pct_value: if . == null then "n/a" else ((fixed2 | tostring) + "%") end;
      def ms: if . == null then "n/a" else ((fixed2 | tostring) + " ms") end;
      def speed: if . == null then "n/a" else ((fixed2 | tostring) + "x") end;
      def status_color:
        if . == "healthy" then "green"
        elif . == "unhealthy" then "red"
        elif . == "degraded" then "yellow"
        else "neutral" end;
      def parity_color:
        if . == null then "neutral"
        elif . >= 1 then "green"
        elif . >= 0.99 then "yellow"
        else "red" end;
      def zero_color:
        if ((. // 0) | tonumber) > 0 then "red" else "green" end;

      [
        ["Current time", (.timestamp // "n/a"), "neutral"],
        ["Overall status", (.status // "n/a"), ((.status // "") | status_color)],
        ["Runtime mode", (.rateLimit.runtimeMode // .runtime.runtimeMode // "n/a"), "neutral"],
        ["Operational state", (.rateLimit.operationalState // "n/a"), "neutral"],
        ["Observability status", (.rateLimit.observabilityStatus // "n/a"), ((.rateLimit.observabilityStatus // "") | status_color)],
        ["Configured canary percentage", ((.rollout.configuredCanaryPercentage // .rollout.configuredPercentage // .rollout.canaryPercentage) | pct_value), "neutral"],
        ["Effective canary percentage", ((.rollout.effectiveCanaryPercentage // .rollout.effectivePercentage // .rollout.effectiveValkeyPercentage) | pct_value), "neutral"],
        ["Parity", (.rateLimit.parity | pct_ratio), (.rateLimit.parity | parity_color)],
        ["Mismatch rate", (.rateLimit.mismatchRate | pct_ratio), (if ((.rateLimit.mismatchRate // 0) | tonumber) == 0 then "green" else "red" end)],
        ["Fallback", ((.rollout.fallbackCount // .rateLimit.fallbackCount // 0) | tostring), ((.rollout.fallbackCount // .rateLimit.fallbackCount // 0) | zero_color)],
        ["Backend failures", ((.rateLimit.backendFailures // 0) | tostring), ((.rateLimit.backendFailures // 0) | zero_color)],
        ["Comparison failures", ((.rateLimit.comparisonFailures // 0) | tostring), ((.rateLimit.comparisonFailures // 0) | zero_color)],
        ["PostgreSQL", (.postgres.status // "n/a"), ((.postgres.status // "") | status_color)],
        ["Valkey", (.valkey.status // "n/a"), ((.valkey.status // "") | status_color)],
        ["Latency delta", ((.rateLimit.averageLatencyDeltaMs // .performance.latencyDifferenceMs) | ms), "neutral"],
        ["Speedup", (.performance.speedup | speed), "neutral"]
      ]
      | .[]
      | @tsv
    ' | render_rows
  fi

  printf '\n%sGreen%s healthy / 100%% parity / zero failures. %sYellow%s parity 99-100%%. %sRed%s unhealthy or non-zero failures.\n' \
    "$GREEN" "$RESET" "$YELLOW" "$RESET" "$RED" "$RESET"
  printf '%sRefreshes every 2 seconds.%s\n' "$DIM" "$RESET"
  sleep 2
done
