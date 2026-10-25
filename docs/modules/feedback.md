# Модуль «Замечания» (Ревизор)

Встроенный сбор замечаний по UI: скрин → разметка → короткая тема → очередь в CRM + опционально API / email.

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

## GitHub Pages → разработчик (важно)

На **GitHub Pages** у заказчика нет вашего Feedback API. Если URL API пустой или указывает на `localhost`, замечания остаются **только в браузере заказчика** — разработчик их не видит.

**Email-канал (Web3Forms):** браузер заказчика делает POST на `https://api.web3forms.com/submit` с публичным Access Key. Письмо уходит на ящик, привязанный к ключу (по умолчанию `sorvanvon@yandex.ru`).

| Шаг | Действие |
|-----|----------|
| 1 | Открыть [web3forms.com](https://web3forms.com), указать email разработчика |
| 2 | Подтвердить ящик по письму активации |
| 3 | Скопировать Access Key |
| 4 | Либо `VITE_WEB3FORMS_ACCESS_KEY` в `.env` перед сборкой Pages, либо в CRM → **Безопасность** → «Feedback email» (сохраняется в localStorage этого браузера) |
| 5 | `VITE_FEEDBACK_EMAIL_TO` / поле «Кому» — целевой адрес (ключ должен быть создан на него) |

В письме: тема, описание, автор, route, buildStamp, метки. Скриншот: пробуем сжатый JPEG; на **бесплатном** Web3Forms вложения — PRO, поэтому часто уходит только текст + пометка, что картинка в локальном инбоксе CRM. SMTP-пароли в репозиторий не кладём.

После отправки UI сообщает, ушло ли письмо или замечание «только в этом браузере».

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

Порядок при submit: локально → API (если настроен) → email (если Access Key есть).

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

При недоступности API замечание остаётся локально; email при настроенном ключе всё равно уходит.

## Бриф для исполнителя

Кнопка «Скопировать постановку» копирует текст: id, тема, route, build, маркеры, описание.
