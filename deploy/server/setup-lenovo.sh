#!/usr/bin/env bash
# Bootstrap СамоСтрой API-стека на Ubuntu Server (Lenovo).
# Запуск на сервере из ~/samostroy:  bash deploy/server/setup-lenovo.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

echo "==> Каталог: $ROOT"

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker не найден. Установите Docker Engine + compose plugin."
  exit 1
fi

if [[ ! -f .env ]]; then
  if [[ -f .env.example ]]; then
    cp .env.example .env
    echo "Создан .env из .env.example — проверьте FEEDBACK_TOKEN / TELEGRAM_*"
  else
    cat > .env <<'EOF'
FEEDBACK_TOKEN=local-dev-token
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=
EOF
    echo "Создан минимальный .env"
  fi
fi

echo "==> docker compose up -d"
docker compose up -d --build

echo "==> health"
for i in 1 2 3 4 5 6 7 8 9 10; do
  if curl -sf http://127.0.0.1:8787/health >/dev/null; then
    curl -s http://127.0.0.1:8787/health
    echo
    echo "OK"
    exit 0
  fi
  sleep 2
done
echo "FAIL: /health не ответил"
exit 1
