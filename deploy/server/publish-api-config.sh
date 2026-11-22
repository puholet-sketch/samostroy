#!/usr/bin/env bash
# Push public API base into GitHub Pages api-config.json (no Vite rebuild).
# Sources for token (first wins):
#   ~/.config/samostroy/github.env  (GITHUB_TOKEN / GH_TOKEN, optional GITHUB_REPO)
#   $SAMOSTROY_ROOT/.env
# Event: repository_dispatch type samostroy_api_url → .github/workflows/update-api-config.yml
set -euo pipefail

STATE_DIR="${SAMOSTROY_STATE_DIR:-$HOME/.config/samostroy}"
ROOT="${SAMOSTROY_ROOT:-$HOME/samostroy}"
URL_FILE="$STATE_DIR/public_api_url"
REPO="${GITHUB_REPO:-puholet-sketch/samostroy}"

load_token() {
  if [[ -f "$STATE_DIR/github.env" ]]; then
    # shellcheck disable=SC1090
    set -a
    # shellcheck disable=SC1091
    source "$STATE_DIR/github.env"
    set +a
  fi
  if [[ -z "${GITHUB_TOKEN:-}${GH_TOKEN:-}" && -f "$ROOT/.env" ]]; then
    # shellcheck disable=SC1091
    set -a
    # shellcheck disable=SC1091
    source "$ROOT/.env"
    set +a
  fi
  TOKEN="${GITHUB_TOKEN:-${GH_TOKEN:-}}"
}

usage() {
  echo "Usage: $0 [https://api-host]" >&2
  echo "  If no arg: read $URL_FILE" >&2
}

main() {
  local url="${1:-}"
  if [[ -z "$url" ]]; then
    if [[ -f "$URL_FILE" ]]; then
      url="$(tr -d '[:space:]' <"$URL_FILE")"
    fi
  fi
  url="${url%/}"
  if [[ -z "$url" || "$url" != https://* ]]; then
    usage
    echo "ERROR: need https:// URL" >&2
    exit 1
  fi

  load_token
  if [[ -z "${TOKEN:-}" ]]; then
    echo "WARN: no GITHUB_TOKEN/GH_TOKEN — skip publish ($url)" >&2
    echo "  Put token in $STATE_DIR/github.env or run ASUS deploy/sync-api-config.ps1" >&2
    exit 0
  fi

  local payload
  payload="$(printf '{"event_type":"samostroy_api_url","client_payload":{"api_base":"%s"}}' "$url")"
  curl -sfS --max-time 30 \
    -X POST \
    -H "Authorization: Bearer ${TOKEN}" \
    -H "Accept: application/vnd.github+json" \
    -H "X-GitHub-Api-Version: 2022-11-28" \
    -H "Content-Type: application/json" \
    "https://api.github.com/repos/${REPO}/dispatches" \
    -d "$payload"
  echo "dispatched samostroy_api_url → ${REPO} api_base=${url}"
}

main "$@"
