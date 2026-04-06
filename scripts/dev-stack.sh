#!/usr/bin/env bash
set -euo pipefail

action="${1:-start}"

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd "$script_dir/.." && pwd)"
runtime_dir="$repo_root/data/dev-runtime"
next_script="$repo_root/node_modules/next/dist/bin/next"

mkdir -p "$runtime_dir"

api_pid="$runtime_dir/api.pid"
api_log="$runtime_dir/api.log"
web_pid="$runtime_dir/web.pid"
web_log="$runtime_dir/web.log"

service_pid_file() {
  case "$1" in
    api) echo "$api_pid" ;;
    web) echo "$web_pid" ;;
    *) return 1 ;;
  esac
}

service_log_file() {
  case "$1" in
    api) echo "$api_log" ;;
    web) echo "$web_log" ;;
    *) return 1 ;;
  esac
}

service_label() {
  case "$1" in
    api) echo "Python API" ;;
    web) echo "Next.js" ;;
    *) return 1 ;;
  esac
}

service_url() {
  case "$1" in
    api) echo "http://localhost:8000" ;;
    web) echo "http://localhost:3000" ;;
    *) return 1 ;;
  esac
}

is_running() {
  local pid_file
  pid_file="$(service_pid_file "$1")"
  [[ -f "$pid_file" ]] || return 1
  local pid
  pid="$(cat "$pid_file")"
  [[ -n "$pid" ]] || return 1
  kill -0 "$pid" 2>/dev/null
}

start_service() {
  local service="$1"
  local pid_file log_file label
  pid_file="$(service_pid_file "$service")"
  log_file="$(service_log_file "$service")"
  label="$(service_label "$service")"

  if is_running "$service"; then
    echo "$label already running (PID $(cat "$pid_file"))."
    return
  fi

  rm -f "$pid_file" "$log_file"

  case "$service" in
    api)
      (
        cd "$repo_root"
        nohup python server.py >"$log_file" 2>&1 &
        echo $! >"$pid_file"
      )
      ;;
    web)
      if [[ ! -f "$next_script" ]]; then
        echo "Next.js script not found. Run 'npm install' first." >&2
        exit 1
      fi
      (
        cd "$repo_root"
        nohup node "$next_script" dev >"$log_file" 2>&1 &
        echo $! >"$pid_file"
      )
      ;;
  esac

  echo "Started $label (PID $(cat "$pid_file")) -> $(service_url "$service")"
}

stop_service() {
  local service="$1"
  local pid_file label
  pid_file="$(service_pid_file "$service")"
  label="$(service_label "$service")"

  if ! is_running "$service"; then
    rm -f "$pid_file"
    echo "$label is not running."
    return
  fi

  local pid
  pid="$(cat "$pid_file")"
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

  rm -f "$pid_file"
  echo "Stopped $label (PID $pid)."
}

show_status() {
  for service in api web; do
    if is_running "$service"; then
      echo "$(service_label "$service"): running (PID $(cat "$(service_pid_file "$service")")) -> $(service_url "$service")"
    else
      echo "$(service_label "$service"): stopped"
    fi
  done
}

show_logs() {
  touch "$api_log" "$web_log"
  echo "Streaming logs from $runtime_dir"
  tail -n 40 -f "$api_log" "$web_log"
}

case "$action" in
  start)
    start_service api
    start_service web
    show_status
    ;;
  stop)
    stop_service web
    stop_service api
    ;;
  restart)
    stop_service web
    stop_service api
    start_service api
    start_service web
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
