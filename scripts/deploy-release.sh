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
  run "systemctl restart $WEB_SERVICE_NAME"
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

  local target_sha release_name lock_hash previous_lock_hash
  run "git -C '$REPO_ROOT' fetch --all --prune"
  target_sha="$(git -C "$REPO_ROOT" rev-parse "$TARGET_REF")"
  run "git -C '$REPO_ROOT' checkout --force '$target_sha'"

  lock_hash="$(sha256sum "$REPO_ROOT/package-lock.json" | awk '{print \$1}')"
  previous_lock_hash=''
  if [[ -f "$STATE_DIR/package-lock.sha256" ]]; then
    previous_lock_hash="$(cat "$STATE_DIR/package-lock.sha256")"
  fi

  if [[ ! -d "$REPO_ROOT/node_modules" || "$lock_hash" != "$previous_lock_hash" ]]; then
    run "cd '$REPO_ROOT' && npm ci"
  else
    printf 'Reusing existing node_modules because package-lock.json is unchanged.\n'
  fi

  run "cd '$REPO_ROOT' && npm run build"

  release_name="$(date +%Y%m%d%H%M%S)-${target_sha:0:12}"
  assemble_release "$release_name"
  run "printf '%s\n' '$target_sha' > '$RELEASES_DIR/$release_name/.git-sha'"
  run "printf '%s\n' '$lock_hash' > '$RELEASES_DIR/$release_name/.package-lock.sha256'"
  run "ln -sfn '$RELEASES_DIR/$release_name/web' '$CURRENT_WEB_LINK'"
  run "printf '%s\n' '$lock_hash' > '$STATE_DIR/package-lock.sha256'"
  run "printf '%s\n' '$release_name' > '$STATE_DIR/current-release'"

  restart_service
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
  run "printf '%s\n' '$release_name' > '$STATE_DIR/current-release'"

  restart_service
  printf 'Rolled back to release %s.\n' "$release_name"
}

if [[ "$ACTION" == "deploy" ]]; then
  deploy_release
else
  rollback_release
fi
