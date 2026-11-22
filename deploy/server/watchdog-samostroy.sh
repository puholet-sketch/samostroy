#!/usr/bin/env bash
# Host-side health for СамоСтрой on Lenovo: Docker API + LHR tunnel.
# Intended for systemd --user timer (every few minutes). Do not run from Pages.
set -euo pipefail

ROOT="${SAMOSTROY_ROOT:-$HOME/samostroy}"
STATE_DIR="${SAMOSTROY_STATE_DIR:-$HOME/.config/samostroy}"
URL_FILE="$STATE_DIR/public_api_url"
LOG_FILE="${SAMOSTROY_WATCHDOG_LOG:-$HOME/samostroy-watchdog.log}"
LOG_MAX_BYTES="${SAMOSTROY_WATCHDOG_LOG_MAX:-524288}" # 512 KiB
LOCAL_HEALTH="http://127.0.0.1:8787/health"
COMPOSE_FILE="$ROOT/docker-compose.yml"
LHR_UNIT="samostroy-lhr"

mkdir -p "$STATE_DIR"
touch "$LOG_FILE"

log() {
  local line
  line="$(date -Iseconds) $*"
  printf '%s\n' "$line" >>"$LOG_FILE"
  printf '%s\n' "$line"
}

rotate_log() {
  local size
  size="$(wc -c <"$LOG_FILE" 2>/dev/null || echo 0)"
  if [[ "$size" -gt "$LOG_MAX_BYTES" ]]; then
    tail -c "$((LOG_MAX_BYTES / 2))" "$LOG_FILE" >"${LOG_FILE}.tmp" || true
    mv -f "${LOG_FILE}.tmp" "$LOG_FILE"
    log "log truncated (was ${size} bytes)"
  fi
}

notify_telegram() {
  local text="$1"
  local token chat
  if [[ ! -f "$ROOT/.env" ]]; then
    return 0
  fi
  # shellcheck disable=SC1091
  token="$(grep -E '^TELEGRAM_BOT_TOKEN=' "$ROOT/.env" | head -1 | cut -d= -f2- | tr -d '\r' || true)"
  chat="$(grep -E '^TELEGRAM_CHAT_ID=' "$ROOT/.env" | head -1 | cut -d= -f2- | tr -d '\r' || true)"
  if [[ -z "${token:-}" || -z "${chat:-}" ]]; then
    return 0
  fi
  curl -sf --max-time 15 \
    -X POST "https://api.telegram.org/bot${token}/sendMessage" \
    -d "chat_id=${chat}" \
    --data-urlencode "text=${text}" >/dev/null || log "WARN telegram notify failed"
}

extract_lhr_url() {
  # Prefer recent journal; both *.lhr.life and *.app.lhr.life
  local raw
  raw="$(journalctl --user -u "$LHR_UNIT" -n 120 --no-pager 2>/dev/null || true)"
  # Full https://… first; fallback bare hostname from “X.app.lhr.life tunneled…”
  printf '%s\n' "$raw" \
    | grep -oE 'https://[a-z0-9]+\.(app\.)?lhr\.life' \
    | tail -1 \
    || printf '%s\n' "$raw" \
      | grep -oE '[a-z0-9]+\.(app\.)?lhr\.life' \
      | tail -1 \
      | sed 's|^|https://|' \
    || true
}

read_saved_url() {
  if [[ -f "$URL_FILE" ]]; then
    tr -d '[:space:]' <"$URL_FILE"
  fi
}

save_url() {
  local url="$1"
  printf '%s\n' "$url" >"$URL_FILE"
  log "saved public URL → $URL_FILE : $url"
}

# Publish URL to GitHub Pages api-config.json (no Vite rebuild).
# Needs GITHUB_TOKEN in ~/.config/samostroy/github.env or ~/samostroy/.env
# → repository_dispatch samostroy_api_url. Else ASUS: deploy/sync-api-config.ps1
publish_api_config() {
  local url="$1"
  local script="$ROOT/deploy/server/publish-api-config.sh"
  if [[ ! -x "$script" && -f "$script" ]]; then
    chmod +x "$script" || true
  fi
  if [[ -f "$script" ]]; then
    if bash "$script" "$url" >>"$LOG_FILE" 2>&1; then
      log "published api-config via dispatch: $url"
    else
      log "WARN publish-api-config failed (token?); use ASUS sync-api-config.ps1"
    fi
  else
    log "WARN missing $script — copy from repo"
  fi
}

curl_ok() {
  local url="$1"
  curl -sf --max-time 12 -o /dev/null "$url"
}

docker_api_ok() {
  docker inspect -f '{{.State.Status}}' samostroy-api 2>/dev/null | grep -qx running \
    && docker inspect -f '{{.State.Health.Status}}' samostroy-postgres 2>/dev/null | grep -qx healthy \
    && curl_ok "$LOCAL_HEALTH"
}

ensure_docker() {
  if docker_api_ok; then
    return 0
  fi
  log "REPAIR docker: api/postgres/local health failed → compose up -d"
  if [[ ! -f "$COMPOSE_FILE" ]]; then
    log "ERROR missing $COMPOSE_FILE"
    return 1
  fi
  (cd "$ROOT" && docker compose up -d) || {
    log "ERROR docker compose up -d failed"
    return 1
  }
  local i
  for i in 1 2 3 4 5 6 7 8 9 10; do
    if docker_api_ok; then
      log "docker OK after repair"
      return 0
    fi
    sleep 2
  done
  log "ERROR docker still unhealthy after compose up"
  return 1
}

public_health_ok() {
  local base="$1"
  [[ -n "$base" ]] && curl_ok "${base%/}/health"
}

capture_and_persist_url() {
  local url old hostname_changed=0
  sleep 6
  url="$(extract_lhr_url)"
  if [[ -z "$url" ]]; then
    log "WARN no LHR URL in journal yet"
    return 1
  fi
  old="$(read_saved_url || true)"
  if [[ "$url" != "$old" ]]; then
    hostname_changed=1
  fi
  save_url "$url"
  if [[ "$hostname_changed" -eq 1 ]]; then
    log "hostname changed: ${old:-<none>} → $url"
    publish_api_config "$url"
    notify_telegram "СамоСтрой watchdog: новый public API URL
$url
api-config.json на Pages обновляется через GitHub dispatch (если есть GITHUB_TOKEN) или ASUS sync.
Стабильный вариант: named CF tunnel + DNS."
  fi
  if public_health_ok "$url"; then
    log "public health OK $url"
    return 0
  fi
  log "WARN public /health still failing for $url"
  return 1
}

ensure_lhr() {
  local url
  url="$(read_saved_url || true)"
  if [[ -z "$url" ]]; then
    url="$(extract_lhr_url)"
    if [[ -n "$url" ]]; then
      save_url "$url"
    fi
  fi

  if public_health_ok "$url"; then
    # Refresh file if journal shows a newer working hostname without restart
    local journal_url
    journal_url="$(extract_lhr_url)"
    if [[ -n "$journal_url" && "$journal_url" != "$url" ]]; then
      if public_health_ok "$journal_url"; then
        log "journal has newer live URL (no restart): $url → $journal_url"
        save_url "$journal_url"
        publish_api_config "$journal_url"
        notify_telegram "СамоСтрой watchdog: LHR hostname сменился без рестарта
$journal_url
api-config на Pages: dispatch/ASUS sync (полный Vite rebuild не обязателен)."
      fi
    fi
    return 0
  fi

  log "REPAIR tunnel: public health fail (${url:-no-url}) → systemctl --user restart $LHR_UNIT"
  systemctl --user restart "$LHR_UNIT" || {
    log "ERROR restart $LHR_UNIT failed"
    return 1
  }
  capture_and_persist_url || true
}

main() {
  rotate_log
  log "check start"
  if ! ensure_docker; then
    notify_telegram "СамоСтрой watchdog: Docker API/Postgres на Lenovo не поднялись. Смотри ~/samostroy-watchdog.log"
    log "check end FAIL docker"
    exit 1
  fi
  ensure_lhr || true
  log "check end ok=$(public_health_ok "$(read_saved_url)" && echo yes || echo no) url=$(read_saved_url || echo none)"
}

main "$@"
