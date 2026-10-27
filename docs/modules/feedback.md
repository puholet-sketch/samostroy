# Модуль «Замечания» (Ревизор)

Встроенный сбор замечаний по UI: скрин → разметка → короткая тема → очередь в CRM + опционально API / email.

Диаграмма процесса: [../processes/feedback.md](../processes/feedback.md). Бизнес-страница релиза: `/updates/2026-10-24-a`.

## Права

- `ModuleKey`: `feedback`
- Назначается в «Настройки» → «Учётки» → чекбокс «Замечания»
- С модулем: FAB «Замечание», раздел «Замечания», смена статусов
- «Скопировать постановку»: роли `owner`, `developer`, либо `security` write
- Роль `developer`: feedback full + updates read (+ object_control read по умолчанию), без clients PII
- Публичный `/report/:token` — без Ревизора

## UX

1. FAB / пункт сайдбара → мастер (снимок → метки → тема/описание/тип)
2. Снимок: полный scrollHeight страницы (`#root` / document), UI замечаний скрыт на время захвата; позиция скролла восстанавливается
3. Метки: прямоугольник, пин, стрелка, текст (координаты в % кадра)
4. Автомета: route, pageTitle, user, role, buildStamp, timestamps
5. После отправки: явный статус «Отправлено на почту» или «Ошибка: письмо не доставлено» (мастер не закрывается при ошибке email)
6. Инбокс: фильтр статусов; постановка — у владельца и разработчика

**Права:** без модуля `feedback` у учётки FAB и инбокс не видны — это отдельная настройка в «Безопасности», не баг доставки email.

## Статусы

`new` → `in_progress` → `done`

## Данные CRM

- Мета: `localStorage` ключ `samostroy:feedback_v1`
- PNG: IndexedDB (`mediaStore`, id `fbimg-*`)
- Поля: см. `FeedbackItem` в `src/lib/feedbackStore.ts`

## GitHub Pages → разработчик (важно)

На **GitHub Pages** у заказчика нет вашего Feedback API. Если URL API пустой или указывает на `localhost`, замечания остаются **только в браузере заказчика** — разработчик их не видит.

**Email-канал (Web3Forms):** браузер заказчика делает POST на `https://api.web3forms.com/submit` с публичным Access Key. **Доставка всегда на email, с которым ключ создан и подтверждён** (alias ключа). Поле `email` в API — reply-to отправителя, не «Кому». `ccemail` / вложения — PRO. Смена ящика без PRO: **новый Access Key** на нужный адрес → пересобрать `VITE_WEB3FORMS_ACCESS_KEY`.

| Шаг | Действие |
|-----|----------|
| 1 | Открыть [web3forms.com](https://web3forms.com), указать **тот** email, куда нужны письма (напр. `sorvanvon@yandex.ru`) |
| 2 | Подтвердить ящик по письму активации |
| 3 | Скопировать Access Key |
| 4 | Либо `VITE_WEB3FORMS_ACCESS_KEY` в `.env` перед сборкой Pages, либо в CRM → **Настройки** → «Замечания / API» → «Feedback email» (сохраняется в localStorage этого браузера) |
| 5 | `VITE_FEEDBACK_EMAIL_TO` / «метка команды» — только текст в письме; **не** перенаправляет free-тариф |

В письме: тема, описание, автор, route, buildStamp, метки + явная строка про инбокс ключа. Скриншот: сжимаем PNG→JPEG (~1280px, ≤~900 КБ) и пробуем `attachment`; на **бесплатном** Web3Forms вложения — PRO → при reject повтор без файла + пометка «смотрите локальный инбокс CRM». SMTP-пароли в репозиторий не кладём.

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
# поднимает postgres (:5433) + api (:8787) с DATABASE_URL внутри сети compose
# FEEDBACK_TOKEN по умолчанию local-dev-token (переопределить в .env корня)
```

Схема: `docker/postgres/init/001_feedback.sql` (+ `002_object_reports.sql` для дневных отчётов).  
CRM: `VITE_FEEDBACK_API_URL=http://127.0.0.1:8787` и тот же token (или Настройки → Замечания / API).

Альтернатива без контейнера API: `cd bots/feedback-bot && npm start` с `DATABASE_URL=…@127.0.0.1:5433/…`.

Termux-бот может остаться как Telegram-notify **или** полным API (JSON без Postgres). Предпочтение: **API+DB на ПК**, телефон — опционально.

При недоступности API замечание остаётся локально; email при настроенном ключе всё равно уходит.

**Важно:** GitHub Pages не достучится до `127.0.0.1` на вашем ПК — для удалённых заказчиков нужен туннель/сервер или Web3Forms.

## Бриф для исполнителя

Кнопка «Скопировать постановку» копирует текст: id, тема, route, build, маркеры, описание.
