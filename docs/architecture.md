# СамоСтрой — архитектура

Живой документ. При росте модулей обновлять этот файл и `docs/modules/`.

## Назначение

MVP CRM для ремонта: карточка клиента → договоры/акты → калькулятор → контроль объекта → замечания (Ревизор). Один SPA; внутренние инструменты — через роли (`owner` / `developer`), не отдельное приложение.

## Слои

| Слой | Где | Что |
|------|-----|-----|
| UI | `src/components/*` | React + Tailwind + Tremor |
| Домен | `src/lib/*` | клиенты, документы, отчёты, feedback |
| Auth / права | `src/contexts/AuthContext.tsx`, `data/users.json`, `data/permissions.json` | сессия в localStorage; модули в `allowedModules` |
| Seed / демо-данные | `data/*.json` | без PII заказчика в git |
| Медиа | IndexedDB (`src/lib/mediaStore.ts`) | фото/видео отчётов и скрины замечаний |
| Local API | `bots/feedback-bot/` (+ Docker `api`) | REST: feedback + object reports + control links; Telegram notify |
| СУБД (local) | `docker-compose.yml` → Postgres 16 `:5433` | durable store замечаний и дневных отчётов |
| Деплой | GitHub Pages (`gh-pages`) | статика; `GITHUB_PAGES=1` → base `/samostroy/` |

## Роли (MVP UI)

| Роль | Смысл |
|------|--------|
| `owner` | Полный контур, включая Безопасность и PII клиентов |
| `developer` | Замечания (full), Обновления (read), опц. контроль объекта (read); без clients |
| `foreman` | Контроль объекта / отчёты |

## Обновления / релизы

Раздел CRM **Обновления** (`/updates`):

| Артефакт | Назначение |
|----------|------------|
| `data/changelog.json` | id (= slug), дата, title, краткие `items`, опционально `docs[]` |
| `data/releases/<id>.md` | бизнес-описание возможностей релиза |
| `/updates/<id>` | страница релиза в приложении |
| `docs/modules/*`, `docs/processes/*` | системная документация (API, поля, БД/хранилище, процессы) |

Паттерн для следующего релиза: [modules/updates.md](modules/updates.md).

## Деплой

1. Запись в `data/changelog.json` (+ при необходимости `data/releases/<id>.md` и ссылки `docs`) + `BUILD_STAMP` в `src/lib/buildStamp.ts`.
2. Commit → push `master`.
3. `GITHUB_PAGES=1` build → publish `dist` на ветку `gh-pages`.

Правило: `.cursor/rules/deploy-changelog.mdc`.

## Хранение данных

- **Локально в браузере:** клиенты (v4 + `createdAt`, `amo_link`), медиа отчётов (IndexedDB), очередь замечаний (мета + PNG).
- **Local pro-stack (этот ПК):** `docker compose up -d` → Postgres `:5433` + API `:8787`. CRM: `VITE_FEEDBACK_API_URL` / `VITE_API_URL` + token → общий store feedback и дневных отчётов.
- **Без API:** отчёты/замечания остаются в localStorage отправителя.
- **Telegram / Web3Forms:** опциональный notify; primary store при pro-stack = Postgres + API.
- **Pages → localhost:** с интернета не достучится; нужен туннель или серверный API.
- **Цель дальше:** тот же REST на сервер / репликация; Supabase не обязателен для MVP.

PII локальной CRM не коммитить (`clients` seed публичный отдельно).

### Быстрый старт local pro-stack

```bash
docker compose up -d
# скопировать .env.example → .env (URL + token local-dev-token)
npm run dev
# CRM → Настройки → Замечания / API: http://127.0.0.1:8787 + тот же token
curl http://127.0.0.1:8787/health
```

Подробнее: [bots/feedback-bot/README.md](../bots/feedback-bot/README.md), [modules/object_control.md](modules/object_control.md).

## Модули MVP (`ModuleKey`)

Назначаются в «Настройки» → «Учётки» (`allowedModules`; модуль прав `security`):

- `clients`, `calculator`, `documents`, `object_control`, `updates`, `security`, `feedback`

Индекс описаний: [docs/modules/README.md](modules/README.md).

Процессы (диаграммы): [docs/processes/](processes/) — например [feedback.md](processes/feedback.md).

## AI-контекст

Краткий resume: `.ai/CONTEXT.md`, `.ai/state.json`, `.ai/INDEX.md` (см. правило `ai-project-context-structure`).
