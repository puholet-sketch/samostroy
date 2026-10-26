# Feedback bot

REST API + уведомления в Telegram. Тот же контракт для CRM (GitHub Pages / localhost).

**Предпочтительно на ПК:** Docker Postgres + этот процесс на localhost. Телефон / Termux — опционально (туннель или только Telegram).

## Быстрый старт (ПК + Docker)

Из корня репозитория:

```bash
docker compose up -d
cd bots/feedback-bot
cp .env.example .env
# FEEDBACK_TOKEN, опционально TELEGRAM_*;
# DATABASE_URL → порт 5433 (см. docker-compose.yml)
npm install
npm start
```

В CRM → **Настройки → «Замечания / API» → Feedback API**:

- Base URL: `http://127.0.0.1:8787` (локальная разработка)
- Token: тот же `FEEDBACK_TOKEN`

Для доступа с GitHub Pages к API на ПК нужен туннель (`cloudflared tunnel --url http://127.0.0.1:8787`) и публичный URL в настройках.

## Termux (телефон, опционально)

```bash
pkg install nodejs git cloudflared
cd ~/samostroy/bots/feedback-bot
cp .env.example .env
nano .env
npm install
npm start
```

В другом сеансе:

```bash
cloudflared tunnel --url http://127.0.0.1:8787
```

**VPN на телефоне** может ломать или менять маршруты cloudflared — если туннель не поднимается, отключите VPN на время туннеля или гоняйте API на ПК.

Без `DATABASE_URL` данные в `data/feedback.json` + `data/images/` (удобно на Termux без Postgres).

## Telegram

1. `@BotFather` → бот → `TELEGRAM_BOT_TOKEN`.
2. Написать боту / группа → `TELEGRAM_CHAT_ID`.
3. Опционально webhook:  
   `https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://YOUR_TUNNEL/telegram/webhook`

Без webhook кнопки в Telegram не обновят API (статус меняется из инбокса CRM).

## API

Заголовок всех `/api/*`: `X-Feedback-Token: <FEEDBACK_TOKEN>`.

| Метод | Путь | Описание |
|-------|------|----------|
| GET | `/health` | без токена; `{ ok, store: "json"\|"postgres" }` |
| GET | `/api/feedback` | список |
| POST | `/api/feedback` | multipart `meta` + `image` |
| GET | `/api/feedback/:id` | карточка |
| GET | `/api/feedback/:id/image` | PNG |
| PATCH | `/api/feedback/:id` | `{ "status": "new\|in_progress\|done" }` |

## Хранение

| Режим | Когда | Где |
|-------|--------|-----|
| JSON | нет `DATABASE_URL` | `data/feedback.json`, PNG в `data/images/` |
| Postgres | задан `DATABASE_URL` | таблица `feedback_items` (см. `docker/postgres/`), PNG на диске |

Схема: `docker/postgres/init/001_feedback.sql`. CRM всегда бьёт в тот же REST.

## Фаза B / дальше

Supabase не обязателен: Docker Postgres + этот REST достаточно. Telegram остаётся notify.
