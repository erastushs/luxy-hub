#!/usr/bin/env bash

load_monitor_token() {
  if [ -n "${LUXY_MONITOR_TOKEN:-}" ]; then
    return 0
  fi

  local env_file="${SCRIPT_DIR}/.env"
  [ -f "$env_file" ] || return 0

  set -a
  . "$env_file"
  set +a
}
