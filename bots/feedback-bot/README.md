# СамоСтрой local API (feedback + object reports)

REST + опциональные уведомления в Telegram. Тот же контракт для CRM (Vite localhost / Pages через туннель).

**Предпочтительно на ПК:** `docker compose up -d` из корня репо (Postgres + этот API).

## Быстрый старт (Docker)

Из корня репозитория:

```bash
docker compose up -d
curl http://127.0.0.1:8787/health
# → { "ok": true, "store": "postgres", "services": [...] }
```

Токен по умолчанию: `local-dev-token` (env `FEEDBACK_TOKEN`).

В корневом `.env` (Vite) или CRM → **Настройки → «Замечания / API»**:

- Base URL: `http://127.0.0.1:8787`
- Token: `local-dev-token`

CORS открыт (`Access-Control-Allow-Origin: *`). Заголовок всех `/api/*`: `X-Feedback-Token`.

GitHub Pages → API на вашем localhost **с интернета не работает**. Нужен `cloudflared tunnel` или хостинг API.

## Запуск API на хосте (без контейнера api)

```bash
docker compose up -d postgres
cd bots/feedback-bot
cp .env.example .env
# DATABASE_URL=postgres://samostroy:samostroy@127.0.0.1:5433/samostroy
npm install
npm start
```

## Существующий Postgres volume без таблиц отчётов

```bash
Get-Content docker/postgres/migrations/002_object_reports.sql | docker compose exec -T postgres psql -U samostroy -d samostroy
```

## Telegram (опционально)

1. `@BotFather` → `TELEGRAM_BOT_TOKEN`
2. `TELEGRAM_CHAT_ID`
3. Webhook (опц.): `…/setWebhook?url=https://YOUR_TUNNEL/telegram/webhook`

Без webhook кнопки в Telegram не обновят API (статус — из инбокса CRM).

## API

| Метод | Путь | Описание |
|-------|------|----------|
| GET | `/health` | без токена; `{ ok, store }` |
| GET | `/api/feedback` | список замечаний |
| POST | `/api/feedback` | multipart `meta` + `image` |
| GET | `/api/feedback/:id` | карточка |
| GET | `/api/feedback/:id/image` | PNG |
| PATCH | `/api/feedback/:id` | `{ "status" }` |
| GET | `/api/object-reports?token=` | дневные отчёты по токену |
| POST | `/api/object-reports` | upsert отчёта (JSON) |
| GET | `/api/control-links/:token` | мета ссылки контроля |
| POST | `/api/control-links` | upsert ссылки |

## Хранение

| Режим | Когда | Где |
|-------|--------|-----|
| JSON | нет `DATABASE_URL` | `data/feedback.json`, `object_reports.json`, `control_links.json` |
| Postgres | задан `DATABASE_URL` | таблицы `feedback_items`, `object_reports`, `control_links` |

Медиа вложений отчётов по объекту пока остаются в IndexedDB браузера; в API — метаданные.

Схемы: `docker/postgres/init/001_feedback.sql`, `002_object_reports.sql`.
