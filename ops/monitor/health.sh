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
  printf '%s========================================%s\n' "$BOLD" "$RESET"
  printf '%s  LuxyHub Production%s\n' "$BOLD" "$RESET"
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

require_command curl
require_command jq

while true; do
  header

  response="$(fetch_health 2>&1)"
  fetch_status=$?

  if [ "$fetch_status" -ne 0 ]; then
    printf '%sHealth request failed:%s\n%s\n' "$RED" "$RESET" "$response"
  elif ! printf '%s\n' "$response" | jq -er . >/dev/null 2>&1; then
    printf '%sInvalid JSON from health endpoint%s\n' "$RED" "$RESET"
    printf '%s\n' "$response"
  else
    printf '%s\n' "$response" | jq -r '
      def fixed2: (. * 100 | round / 100);
      def ms: if . == null then "n/a" else ((fixed2 | tostring) + " ms") end;
      def speed: if . == null then "n/a" else ((fixed2 | tostring) + "x") end;
      def status_color:
        if . == "healthy" then "green"
        elif . == "unhealthy" then "red"
        elif . == "degraded" then "yellow"
        else "neutral" end;
      def seconds_to_duration:
        if . == null then "n/a"
        else
          (./86400 | floor) as $d |
          (./3600 % 24 | floor) as $h |
          (./60 % 60 | floor) as $m |
          (if $d > 0 then "\($d)d " else "" end) +
          (if $h > 0 or $d > 0 then "\($h)h " else "" end) +
          "\($m)m"
        end;
      def backend_label:
        if . == "valkey_authoritative" then "Valkey"
        elif . == "valkey_canary_active" then "Valkey (Canary)"
        elif . == "shadow_comparison_active" then "Valkey (Shadow)"
        elif . == "postgres_authoritative" then "PostgreSQL"
        else . end;

      [
        ["Overall", (.status // "n/a"), (.status // "" | status_color)],
        ["Runtime", "Phase \(.runtime.phase // "?"), (.runtime.milestone // "")],
        ["Release", (.runtime.release // ""), "neutral"],
        ["Uptime", (.runtime.uptimeSeconds | seconds_to_duration), "neutral"]
      ] as $overview,

      [
        ["Rate Limiter", ((.runtimeBackends.rateLimit.mode // .services.rateLimit.runtimeMode) | backend_label), (.services.rateLimit.health // "" | status_color)],
        ["Delivery Session", ((.runtimeBackends.deliverySession.mode // .services.deliverySession.runtimeMode) | backend_label), (.services.deliverySession.health // "" | status_color)]
      ] as $backends,

      [
        ["PostgreSQL", (.services.postgres.status // "n/a"), (.services.postgres.status // "" | status_color)],
        ["Valkey", (.services.valkey.status // "n/a"), (.services.valkey.status // "" | status_color)]
      ] as $infra,

      [
        ["Speedup", (.performance.speedup | speed), "neutral"],
        ["Latency Saved", (.performance.latencyDifferenceMs | ms), "neutral"]
      ] as $perf

      | $overview, $backends, $infra, $perf
      | .[]
      | @tsv
    ' | while IFS=$'\t' read -r label value color; do
      if [ -z "$color" ]; then
        printf '%-18s %s\n' "$label" "$value"
      elif [ "$color" = "neutral" ]; then
        printf '%-18s %s\n' "$label" "$value"
      else
        printf '%-18s ' "$label"
        colorize "$color" "$value"
        printf '\n'
      fi
    done

  fi

  printf '\n%sRefreshes every 2 seconds.  Endpoint: %s%s\n' "$DIM" "$ENDPOINT" "$RESET"
  sleep 2
done
