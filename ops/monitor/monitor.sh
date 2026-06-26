#!/usr/bin/env bash
set -u

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
. "$SCRIPT_DIR/lib.sh"

BASE_URL="${LUXYHUB_BASE_URL:-${1:-http://127.0.0.1:3000}}"
HEALTH_ENDPOINT="${BASE_URL%/}/api/health"
SHADOW_ENDPOINT="${BASE_URL%/}/api/internal/rate-limit-shadow"
DELIVERY_ENDPOINT="${BASE_URL%/}/api/internal/delivery-session"

load_monitor_token

SHADOW_AUTH_ARGS=()
if [ -n "${LUXY_MONITOR_TOKEN:-}" ]; then
  SHADOW_AUTH_ARGS=(-H "Authorization: Bearer ${LUXY_MONITOR_TOKEN}")
fi

missing=0

check_command() {
  if command -v "$1" >/dev/null 2>&1; then
    printf 'ok: %s\n' "$1"
  else
    printf 'missing: %s\n' "$1"
    missing=1
  fi
}

check_tmux() {
  if command -v tmux >/dev/null 2>&1; then
    printf 'ok: tmux\n'
  else
    printf 'missing: tmux\n'
    printf '  Full dashboard requires tmux. Install on Ubuntu 24.04 with: sudo apt update && sudo apt install tmux\n'
  fi
}

shadow_probe() {
  if [ -z "${LUXY_MONITOR_TOKEN:-}" ]; then
    printf 'missing-token'
    return 0
  fi

  curl -sS --max-time 5 -X GET "${SHADOW_AUTH_ARGS[@]}" -o /dev/null -w '%{http_code}' "$SHADOW_ENDPOINT"
}

delivery_probe() {
  if [ -z "${LUXY_MONITOR_TOKEN:-}" ]; then
    printf 'missing-token'
    return 0
  fi

  curl -sS --max-time 5 -X GET "${SHADOW_AUTH_ARGS[@]}" -o /dev/null -w '%{http_code}' "$DELIVERY_ENDPOINT"
}

printf 'LuxyHub Production Monitor\n'
printf 'Base URL: %s\n\n' "$BASE_URL"

printf 'Dependency check:\n'
for command_name in bash curl jq redis-cli pm2 free uptime df awk node; do
  check_command "$command_name"
done
check_tmux

if [ "$missing" -ne 0 ]; then
  printf '\nOne or more required commands are missing. Install missing dependencies before continuing.\n'
  exit 1
fi

printf '\nConnectivity check:\n'
health_status="$(curl -sS --max-time 5 -X GET -o /dev/null -w '%{http_code}' "$HEALTH_ENDPOINT" 2>/dev/null)"
if [ "$health_status" = "200" ]; then
  printf 'ok: GET %s returned HTTP 200\n' "$HEALTH_ENDPOINT"
else
  printf 'warning: GET %s returned HTTP %s\n' "$HEALTH_ENDPOINT" "${health_status:-unavailable}"
fi

if [ -z "${LUXY_MONITOR_TOKEN:-}" ]; then
  printf 'warning: Monitoring authentication not configured.\n'
else
  shadow_status="$(shadow_probe 2>/dev/null)"
  case "$shadow_status" in
    401|403)
      printf 'warning: GET %s returned HTTP %s; monitoring authentication failed.\n' "$SHADOW_ENDPOINT" "$shadow_status"
      printf '         This toolkit does not attempt to bypass authentication.\n'
      ;;
    2*)
      printf 'ok: GET %s returned HTTP %s\n' "$SHADOW_ENDPOINT" "$shadow_status"
      ;;
    *)
      printf 'warning: GET %s returned HTTP %s\n' "$SHADOW_ENDPOINT" "${shadow_status:-unavailable}"
      ;;
  esac

  delivery_status="$(delivery_probe 2>/dev/null)"
  case "$delivery_status" in
    401|403)
      printf 'warning: GET %s returned HTTP %s; monitoring authentication failed.\n' "$DELIVERY_ENDPOINT" "$delivery_status"
      ;;
    2*)
      printf 'ok: GET %s returned HTTP %s\n' "$DELIVERY_ENDPOINT" "$delivery_status"
      ;;
    *)
      printf 'warning: GET %s returned HTTP %s\n' "$DELIVERY_ENDPOINT" "${delivery_status:-unavailable}"
      ;;
  esac
fi

printf '\nChoose a monitor:\n'
printf '1) Health only\n'
printf '2) Shadow only\n'
printf '3) Delivery Session\n'
printf '4) System\n'
printf '5) Logs\n'
printf '6) Full tmux dashboard\n'
printf '\nSelection: '
read -r selection

case "$selection" in
  1) exec "$SCRIPT_DIR/health.sh" "$BASE_URL" ;;
  2) exec "$SCRIPT_DIR/shadow.sh" "$BASE_URL" ;;
  3) exec "$SCRIPT_DIR/delivery.sh" "$BASE_URL" ;;
  4) exec "$SCRIPT_DIR/system.sh" ;;
  5) exec "$SCRIPT_DIR/logs.sh" ;;
  6) exec "$SCRIPT_DIR/tmux-monitor.sh" ;;
  *)
    printf 'Invalid selection: %s\n' "$selection"
    exit 1
    ;;
esac
