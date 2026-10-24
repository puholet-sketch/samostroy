# Модуль «Замечания» (Ревизор)

Встроенный сбор замечаний по UI: скрин → разметка → короткая тема → очередь в CRM + Telegram.

Диаграмма процесса: [../processes/feedback.md](../processes/feedback.md). Бизнес-страница релиза: `/updates/2026-10-24-a`.

## Права

- `ModuleKey`: `feedback`
- Назначается в «Безопасность» → чекбокс «Замечания»
- С модулем: FAB «Замечание», раздел «Замечания», смена статусов
- «Скопировать постановку»: роли `owner`, `developer`, либо `security` write
- Роль `developer`: feedback full + updates read (+ object_control read по умолчанию), без clients PII
- Публичный `/report/:token` — без Ревизора

## UX

1. FAB / пункт сайдбара → мастер (снимок → метки → тема/описание/тип)
2. Метки: прямоугольник, пин, стрелка, текст (координаты в % кадра)
3. Автомета: route, pageTitle, user, role, buildStamp, timestamps
4. Инбокс: фильтр статусов; постановка — у владельца и разработчика

## Статусы

`new` → `in_progress` → `done`

## Данные CRM

- Мета: `localStorage` ключ `samostroy:feedback_v1`
- PNG: IndexedDB (`mediaStore`, id `fbimg-*`)
- Поля: см. `FeedbackItem` в `src/lib/feedbackStore.ts`

## API (один REST: Docker / Termux / cloud)

База: `VITE_FEEDBACK_API_URL` или настройка в Безопасности (`samostroy:feedback_api`).

Заголовок: `X-Feedback-Token`.

| Метод | Путь | Тело |
|-------|------|------|
| POST | `/api/feedback` | multipart: `meta` (JSON), `image` (PNG) |
| GET | `/api/feedback` | список |
| GET | `/api/feedback/:id` | карточка; картинка `/api/feedback/:id/image` |
| PATCH | `/api/feedback/:id` | `{ "status": "…" }` |

Бот: `bots/feedback-bot/` (README).

### Durable store (фаза B foundation)

| Режим | Условие | Где |
|-------|---------|-----|
| JSON | нет `DATABASE_URL` | `bots/feedback-bot/data/feedback.json` + `images/` |
| Postgres | `DATABASE_URL` | Docker Compose → таблица `feedback_items` |

```bash
docker compose up -d
# bots/feedback-bot/.env → DATABASE_URL=postgres://samostroy:samostroy@127.0.0.1:5433/samostroy
```

Схема: `docker/postgres/init/001_feedback.sql`. CRM по-прежнему бьёт в тот же REST (`http://127.0.0.1:8787` локально или cloudflared).

Termux-бот может остаться как Telegram-notify **или** полным API (JSON без Postgres). Предпочтение: **API+DB на ПК**, телефон — опционально.

При недоступности API замечание остаётся локально со `syncStatus: pending`.

## Бриф для исполнителя

Кнопка «Скопировать постановку» копирует текст: id, тема, route, build, маркеры, описание.
