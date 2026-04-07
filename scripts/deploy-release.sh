#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
DEPLOY_ROOT="${DEPLOY_ROOT:-/opt/ghosted}"
RELEASES_DIR="${RELEASES_DIR:-$DEPLOY_ROOT/releases}"
STATE_DIR="${STATE_DIR:-$DEPLOY_ROOT/.deploy-state}"
CURRENT_WEB_LINK="${CURRENT_WEB_LINK:-$DEPLOY_ROOT/current-web}"
ENV_FILE="${ENV_FILE:-/etc/ghosted/ghosted.env}"
WEB_SERVICE_NAME="${WEB_SERVICE_NAME:-ghosted-web}"
HEALTHCHECK_PATH="${HEALTHCHECK_PATH:-/api/config}"
HEALTHCHECK_ATTEMPTS="${HEALTHCHECK_ATTEMPTS:-20}"
HEALTHCHECK_INTERVAL_SECONDS="${HEALTHCHECK_INTERVAL_SECONDS:-1}"

DRY_RUN=0
ACTION="deploy"
TARGET_REF=""
ROLLBACK_TARGET=""

usage() {
  cat <<'EOF'
Usage:
  deploy-release.sh <git-ref> [--dry-run]
  deploy-release.sh rollback [release-name] [--dry-run]

Examples:
  ./scripts/deploy-release.sh origin/main
  ./scripts/deploy-release.sh HEAD
  ./scripts/deploy-release.sh rollback
  ./scripts/deploy-release.sh rollback 20260406103015-a1b2c3d4e5f6
EOF
}

run() {
  printf '+ %s\n' "$*"
  if [[ "$DRY_RUN" -eq 0 ]]; then
    eval "$@"
  fi
}

systemctl_wrapper() {
  if [[ "$DRY_RUN" -eq 1 ]]; then
    printf '+ systemctl %s\n' "$*"
    return 0
  fi

  if [[ "${EUID:-$(id -u)}" -eq 0 ]]; then
    systemctl "$@"
    return
  fi

  if sudo -n true >/dev/null 2>&1; then
    sudo -n systemctl "$@"
    return
  fi

  printf 'Deploy script needs permission to manage %s. Run as root or grant passwordless sudo for systemctl cat/restart/is-active on that service.\n' "$WEB_SERVICE_NAME" >&2
  exit 1
}

systemctl_capture() {
  if [[ "${EUID:-$(id -u)}" -eq 0 ]]; then
    systemctl "$@"
    return
  fi

  if sudo -n true >/dev/null 2>&1; then
    sudo -n systemctl "$@"
    return
  fi

  printf 'Deploy script needs permission to inspect %s via systemctl.\n' "$WEB_SERVICE_NAME" >&2
  exit 1
}

node_runtime_fingerprint() {
  node -p "process.version + '|' + process.platform + '|' + process.arch + '|' + (process.versions.modules || '')"
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    rollback)
      ACTION="rollback"
      if [[ $# -gt 1 && "$2" != --* ]]; then
        ROLLBACK_TARGET="$2"
        shift
      fi
      ;;
    --dry-run)
      DRY_RUN=1
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      if [[ "$ACTION" == "deploy" && -z "$TARGET_REF" ]]; then
        TARGET_REF="$1"
      elif [[ "$ACTION" == "rollback" && -z "$ROLLBACK_TARGET" ]]; then
        ROLLBACK_TARGET="$1"
      else
        printf 'Unknown argument: %s\n' "$1" >&2
        usage
        exit 1
      fi
      ;;
  esac
  shift
done

if [[ "$ACTION" == "deploy" && -z "$TARGET_REF" ]]; then
  usage
  exit 1
fi

require_env() {
  if [[ ! -f "$ENV_FILE" ]]; then
    printf 'Missing env file: %s\n' "$ENV_FILE" >&2
    exit 1
  fi

  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a

  if [[ -z "${DATABASE_PATH:-}" ]]; then
    printf 'DATABASE_PATH must be set in %s\n' "$ENV_FILE" >&2
    exit 1
  fi
  if [[ -z "${COMPANION_ASSET_DIR:-}" ]]; then
    printf 'COMPANION_ASSET_DIR must be set in %s\n' "$ENV_FILE" >&2
    exit 1
  fi
}

current_release_name() {
  if [[ -f "$STATE_DIR/current-release" ]]; then
    cat "$STATE_DIR/current-release"
    return
  fi
  if [[ -L "$CURRENT_WEB_LINK" ]]; then
    basename "$(dirname "$(readlink -f "$CURRENT_WEB_LINK")")"
    return
  fi
  printf ''
}

list_release_names() {
  if [[ ! -d "$RELEASES_DIR" ]]; then
    return
  fi
  find "$RELEASES_DIR" -mindepth 1 -maxdepth 1 -type d -printf '%f\n' | sort -r
}

resolve_rollback_release() {
  if [[ -n "$ROLLBACK_TARGET" ]]; then
    if [[ ! -d "$RELEASES_DIR/$ROLLBACK_TARGET" ]]; then
      printf 'Rollback target not found: %s\n' "$ROLLBACK_TARGET" >&2
      exit 1
    fi
    printf '%s' "$ROLLBACK_TARGET"
    return
  fi

  local current_release
  current_release="$(current_release_name)"
  local candidate
  while IFS= read -r candidate; do
    [[ -z "$candidate" ]] && continue
    if [[ "$candidate" != "$current_release" ]]; then
      printf '%s' "$candidate"
      return
    fi
  done < <(list_release_names)

  printf 'No previous release found to roll back to.\n' >&2
  exit 1
}

prepare_directories() {
  run "mkdir -p '$RELEASES_DIR' '$STATE_DIR'"
}

restart_service() {
  printf '+ systemctl restart %s\n' "$WEB_SERVICE_NAME"
  systemctl_wrapper restart "$WEB_SERVICE_NAME"
}

service_healthcheck_url() {
  local port
  port="${PORT:-3000}"
  printf 'http://127.0.0.1:%s%s' "$port" "$HEALTHCHECK_PATH"
}

wait_for_healthcheck() {
  local url attempts interval attempt
  url="$(service_healthcheck_url)"
  attempts="$HEALTHCHECK_ATTEMPTS"
  interval="$HEALTHCHECK_INTERVAL_SECONDS"

  if [[ "$DRY_RUN" -eq 1 ]]; then
    printf '+ curl --fail --silent --show-error %s\n' "$url"
    return 0
  fi

  if ! command -v curl >/dev/null 2>&1; then
    printf 'curl is required for deploy health checks.\n' >&2
    exit 1
  fi

  for ((attempt = 1; attempt <= attempts; attempt += 1)); do
    if curl --fail --silent --show-error --max-time 5 "$url" >/dev/null; then
      return 0
    fi
    sleep "$interval"
  done

  return 1
}

verify_service_unit() {
  local unit_text
  unit_text="$(systemctl_capture cat "$WEB_SERVICE_NAME" 2>/dev/null || true)"
  if [[ -z "$unit_text" ]]; then
    printf 'Could not inspect %s. Make sure the service is installed before deploying.\n' "$WEB_SERVICE_NAME" >&2
    exit 1
  fi

  if [[ "$unit_text" != *"WorkingDirectory=$CURRENT_WEB_LINK"* ]]; then
    printf '%s is not using WorkingDirectory=%s. Install deploy/ghosted-web.service before using deploy-release.sh.\n' "$WEB_SERVICE_NAME" "$CURRENT_WEB_LINK" >&2
    exit 1
  fi

  if [[ "$unit_text" != *"$CURRENT_WEB_LINK/server.js"* ]]; then
    printf '%s is not launching %s/server.js. Install deploy/ghosted-web.service before using deploy-release.sh.\n' "$WEB_SERVICE_NAME" "$CURRENT_WEB_LINK" >&2
    exit 1
  fi
}

assemble_release() {
  local release_name="$1"
  local release_root="$RELEASES_DIR/$release_name"
  local web_root="$release_root/web"

  run "mkdir -p '$web_root/.next' '$web_root/assets'"
  run "cp -a '$REPO_ROOT/.next/standalone/.' '$web_root/'"
  if [[ -d "$REPO_ROOT/.next/static" ]]; then
    run "cp -a '$REPO_ROOT/.next/static' '$web_root/.next/static'"
  fi
  if [[ -d "$REPO_ROOT/public" ]]; then
    run "cp -a '$REPO_ROOT/public' '$web_root/public'"
  fi
  if [[ -d "$REPO_ROOT/assets/companion" ]]; then
    run "cp -a '$REPO_ROOT/assets/companion' '$web_root/assets/companion'"
  fi
}

deploy_release() {
  require_env
  prepare_directories
  verify_service_unit

  local target_sha release_name lock_hash previous_lock_hash
  local node_fingerprint previous_node_fingerprint previous_release
  run "git -C '$REPO_ROOT' fetch --all --prune"
  target_sha="$(git -C "$REPO_ROOT" rev-parse "$TARGET_REF")"
  run "git -C '$REPO_ROOT' checkout --force '$target_sha'"
  previous_release="$(current_release_name)"

  lock_hash="$(sha256sum "$REPO_ROOT/package-lock.json" | awk '{print \$1}')"
  node_fingerprint="$(node_runtime_fingerprint)"
  previous_lock_hash=''
  previous_node_fingerprint=''
  if [[ -f "$STATE_DIR/package-lock.sha256" ]]; then
    previous_lock_hash="$(cat "$STATE_DIR/package-lock.sha256")"
  fi
  if [[ -f "$STATE_DIR/node-runtime.txt" ]]; then
    previous_node_fingerprint="$(cat "$STATE_DIR/node-runtime.txt")"
  fi

  if [[ ! -d "$REPO_ROOT/node_modules" || "$lock_hash" != "$previous_lock_hash" || "$node_fingerprint" != "$previous_node_fingerprint" ]]; then
    run "cd '$REPO_ROOT' && npm ci"
  else
    printf 'Reusing existing node_modules because package-lock.json and Node runtime are unchanged.\n'
  fi

  run "cd '$REPO_ROOT' && npm run build"

  release_name="$(date +%Y%m%d%H%M%S)-${target_sha:0:12}"
  assemble_release "$release_name"
  run "printf '%s\n' '$target_sha' > '$RELEASES_DIR/$release_name/.git-sha'"
  run "printf '%s\n' '$lock_hash' > '$RELEASES_DIR/$release_name/.package-lock.sha256'"
  run "printf '%s\n' '$node_fingerprint' > '$RELEASES_DIR/$release_name/.node-runtime.txt'"
  run "ln -sfn '$RELEASES_DIR/$release_name/web' '$CURRENT_WEB_LINK'"
  run "printf '%s\n' '$lock_hash' > '$STATE_DIR/package-lock.sha256'"
  run "printf '%s\n' '$node_fingerprint' > '$STATE_DIR/node-runtime.txt'"
  run "printf '%s\n' '$release_name' > '$STATE_DIR/current-release'"

  restart_service
  if ! wait_for_healthcheck; then
    printf 'Health check failed for release %s.\n' "$release_name" >&2
    if [[ -n "$previous_release" && -d "$RELEASES_DIR/$previous_release" ]]; then
      printf 'Rolling back to %s.\n' "$previous_release" >&2
      run "ln -sfn '$RELEASES_DIR/$previous_release/web' '$CURRENT_WEB_LINK'"
      if [[ -f "$RELEASES_DIR/$previous_release/.package-lock.sha256" ]]; then
        run "cp '$RELEASES_DIR/$previous_release/.package-lock.sha256' '$STATE_DIR/package-lock.sha256'"
      fi
      if [[ -f "$RELEASES_DIR/$previous_release/.node-runtime.txt" ]]; then
        run "cp '$RELEASES_DIR/$previous_release/.node-runtime.txt' '$STATE_DIR/node-runtime.txt'"
      fi
      run "printf '%s\n' '$previous_release' > '$STATE_DIR/current-release'"
      restart_service
    fi
    exit 1
  fi
  printf 'Deployed release %s (%s).\n' "$release_name" "$target_sha"
}

rollback_release() {
  prepare_directories
  local release_name
  release_name="$(resolve_rollback_release)"

  run "ln -sfn '$RELEASES_DIR/$release_name/web' '$CURRENT_WEB_LINK'"
  if [[ -f "$RELEASES_DIR/$release_name/.package-lock.sha256" ]]; then
    run "cp '$RELEASES_DIR/$release_name/.package-lock.sha256' '$STATE_DIR/package-lock.sha256'"
  fi
  if [[ -f "$RELEASES_DIR/$release_name/.node-runtime.txt" ]]; then
    run "cp '$RELEASES_DIR/$release_name/.node-runtime.txt' '$STATE_DIR/node-runtime.txt'"
  fi
  run "printf '%s\n' '$release_name' > '$STATE_DIR/current-release'"

  restart_service
  if ! wait_for_healthcheck; then
    printf 'Rollback completed but the service is still failing health checks.\n' >&2
    exit 1
  fi
  printf 'Rolled back to release %s.\n' "$release_name"
}

if [[ "$ACTION" == "deploy" ]]; then
  deploy_release
else
  rollback_release
fi
