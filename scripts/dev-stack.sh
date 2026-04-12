#!/usr/bin/env bash
set -euo pipefail

action="${1:-start}"

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd "$script_dir/.." && pwd)"
runtime_dir="$repo_root/data/dev-runtime"
next_script="$repo_root/node_modules/next/dist/bin/next"
scene_realtime_script="$repo_root/scripts/scene-realtime.ts"
env_files=(".env" ".env.development" ".env.local" ".env.development.local")
loaded_env_files=()

service_names=("web" "scene-realtime")

mkdir -p "$runtime_dir"

trim() {
  local value="$1"
  value="${value#"${value%%[![:space:]]*}"}"
  value="${value%"${value##*[![:space:]]}"}"
  printf '%s' "$value"
}

normalize_env_value() {
  local value
  value="$(trim "$1")"
  if [[ ${#value} -ge 2 ]]; then
    local first="${value:0:1}"
    local last="${value: -1}"
    if [[ ("$first" == '"' && "$last" == '"') || ("$first" == "'" && "$last" == "'") ]]; then
      printf '%s' "${value:1:${#value}-2}"
      return
    fi
  fi

  if [[ "$value" == *" #"* ]]; then
    value="${value%% \#*}"
    value="$(trim "$value")"
  fi
  printf '%s' "$value"
}

import_local_env() {
  local file line key raw_value normalized_value file_path

  for file in "${env_files[@]}"; do
    file_path="$repo_root/$file"
    [[ -f "$file_path" ]] || continue
    loaded_env_files+=("$file")

    while IFS= read -r line || [[ -n "$line" ]]; do
      [[ -n "$line" ]] || continue
      if [[ "$line" =~ ^[[:space:]]*(export[[:space:]]+)?([A-Za-z_][A-Za-z0-9_]*)[[:space:]]*=(.*)$ ]]; then
        key="${BASH_REMATCH[2]}"
        raw_value="${BASH_REMATCH[3]}"
        normalized_value="$(normalize_env_value "$raw_value")"
        if [[ -z "${!key:-}" ]]; then
          export "$key=$normalized_value"
        fi
      fi
    done < "$file_path"
  done
}

env_flag() {
  local value="${1:-}"
  value="$(printf '%s' "$value" | tr '[:upper:]' '[:lower:]')"
  [[ "$value" == "1" || "$value" == "true" || "$value" == "yes" || "$value" == "on" ]]
}

show_setup_notes() {
  if [[ ${#loaded_env_files[@]} -gt 0 ]]; then
    echo "Loaded env files: ${loaded_env_files[*]}"
  else
    echo "No .env*, .env.local, or .env.development* file found. Using current shell environment only."
  fi

  local dev_auth_enabled=false
  local discord_oauth_ready=false
  local guild_sync_ready=false

  if env_flag "${ENABLE_DEV_AUTH:-}"; then
    dev_auth_enabled=true
  fi

  if [[ -n "${DISCORD_CLIENT_ID:-}" && -n "${DISCORD_CLIENT_SECRET:-}" ]]; then
    discord_oauth_ready=true
  fi

  if [[ -n "${DISCORD_GUILD_ID:-}" && -n "${DISCORD_BOT_TOKEN:-}" ]]; then
    guild_sync_ready=true
  fi

  if [[ "$dev_auth_enabled" == false && "$discord_oauth_ready" == false ]]; then
    echo "Setup warning: no local sign-in path is configured. Set ENABLE_DEV_AUTH=true for dev login, or set both DISCORD_CLIENT_ID and DISCORD_CLIENT_SECRET for Discord OAuth."
  elif [[ "$dev_auth_enabled" == false ]]; then
    echo "Setup note: development auth is disabled, so /auth/dev-login will return 404 until ENABLE_DEV_AUTH=true."
  fi

  if [[ (-n "${DISCORD_CLIENT_ID:-}" && -z "${DISCORD_CLIENT_SECRET:-}") || (-z "${DISCORD_CLIENT_ID:-}" && -n "${DISCORD_CLIENT_SECRET:-}") ]]; then
    echo "Setup warning: Discord OAuth is partially configured. Set both DISCORD_CLIENT_ID and DISCORD_CLIENT_SECRET."
  fi

  if [[ (-n "${DISCORD_GUILD_ID:-}" && -z "${DISCORD_BOT_TOKEN:-}") || (-z "${DISCORD_GUILD_ID:-}" && -n "${DISCORD_BOT_TOKEN:-}") ]]; then
    echo "Setup warning: Discord guild sync is partially configured. Set both DISCORD_GUILD_ID and DISCORD_BOT_TOKEN for live role lookups."
  elif [[ "$guild_sync_ready" == false ]]; then
    echo "Setup note: Discord guild sync is disabled locally, so live role metadata will fall back to configured labels only."
  fi

  if [[ -z "${WOM_GROUP_ID:-}" ]]; then
    echo "Setup note: WOM clan features are disabled locally until WOM_GROUP_ID is set."
  fi

  if [[ -z "${DATABASE_PATH:-}" ]]; then
    echo "Setup note: DATABASE_PATH is unset, so SQLite will default to $repo_root/data/ghosted.db"
  fi

  if [[ -z "${COMPANION_ASSET_DIR:-}" ]]; then
    echo "Setup note: COMPANION_ASSET_DIR is unset, so companion uploads will live beside the database path."
  fi

  if [[ "$discord_oauth_ready" == true && -z "${AUTH_SECRET:-}" ]]; then
    echo "Setup note: AUTH_SECRET is unset. Local development will use the built-in fallback secret; set AUTH_SECRET to mirror production session signing."
  fi
}

pid_file() {
  printf '%s/%s.pid' "$runtime_dir" "$1"
}

log_file() {
  printf '%s/%s.log' "$runtime_dir" "$1"
}

is_running() {
  local pid_path
  pid_path="$(pid_file "$1")"
  [[ -f "$pid_path" ]] || return 1
  local pid
  pid="$(cat "$pid_path")"
  [[ -n "$pid" ]] || return 1
  kill -0 "$pid" 2>/dev/null
}

service_label() {
  case "$1" in
    web) printf 'Next.js' ;;
    scene-realtime) printf 'Scene Realtime' ;;
  esac
}

service_url() {
  case "$1" in
    web) printf 'http://localhost:3000' ;;
    scene-realtime) printf 'ws://localhost:3001/ws/scene/presence' ;;
  esac
}

start_service() {
  local service="$1"
  if is_running "$service"; then
    echo "$(service_label "$service") already running (PID $(cat "$(pid_file "$service")")). Restart to pick up env changes."
    return
  fi

  case "$service" in
    web)
      [[ -f "$next_script" ]] || { echo "Next.js script not found. Run 'npm install' first." >&2; exit 1; }
      rm -f "$(pid_file "$service")" "$(log_file "$service")"
      (
        cd "$repo_root"
        nohup node "$next_script" dev >"$(log_file "$service")" 2>&1 &
        echo $! >"$(pid_file "$service")"
      )
      ;;
    scene-realtime)
      [[ -f "$scene_realtime_script" ]] || { echo "Scene realtime script not found. Run 'npm install' first." >&2; exit 1; }
      rm -f "$(pid_file "$service")" "$(log_file "$service")"
      (
        cd "$repo_root"
        nohup node --conditions=react-server --import tsx "$scene_realtime_script" >"$(log_file "$service")" 2>&1 &
        echo $! >"$(pid_file "$service")"
      )
      ;;
  esac

  echo "Started $(service_label "$service") (PID $(cat "$(pid_file "$service")")) -> $(service_url "$service")"
}

stop_service() {
  local service="$1"
  if ! is_running "$service"; then
    rm -f "$(pid_file "$service")"
    echo "$(service_label "$service") is not running."
    return
  fi

  local pid
  pid="$(cat "$(pid_file "$service")")"
  kill "$pid" 2>/dev/null || true

  for _ in 1 2 3 4 5; do
    if ! kill -0 "$pid" 2>/dev/null; then
      break
    fi
    sleep 1
  done

  if kill -0 "$pid" 2>/dev/null; then
    kill -9 "$pid" 2>/dev/null || true
  fi

  rm -f "$(pid_file "$service")"
  echo "Stopped $(service_label "$service") (PID $pid)."
}

show_status() {
  for service in "${service_names[@]}"; do
    if is_running "$service"; then
      echo "$(service_label "$service"): running (PID $(cat "$(pid_file "$service")")) -> $(service_url "$service")"
    else
      echo "$(service_label "$service"): stopped"
    fi
  done
}

show_logs() {
  local files=()
  for service in "${service_names[@]}"; do
    touch "$(log_file "$service")"
    files+=("$(log_file "$service")")
  done
  echo "Streaming logs from $runtime_dir"
  tail -n 40 -f "${files[@]}"
}

import_local_env

case "$action" in
  start)
    show_setup_notes
    for service in "${service_names[@]}"; do
      start_service "$service"
    done
    show_status
    ;;
  stop)
    for service in "${service_names[@]}"; do
      stop_service "$service"
    done
    ;;
  restart)
    for service in "${service_names[@]}"; do
      stop_service "$service"
    done
    show_setup_notes
    for service in "${service_names[@]}"; do
      start_service "$service"
    done
    show_status
    ;;
  status)
    show_status
    ;;
  logs)
    show_logs
    ;;
  *)
    echo "Usage: ./scripts/dev-stack.sh [start|stop|restart|status|logs]" >&2
    exit 1
    ;;
esac
