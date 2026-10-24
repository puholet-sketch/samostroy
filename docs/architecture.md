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
| Feedback API | `bots/feedback-bot/` | REST + Telegram; JSON или Postgres |
| СУБД (local) | `docker-compose.yml` → Postgres 16 | durable store замечаний |
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

- **Локально в браузере:** клиенты (v4), ссылки контроля, дневные отчёты, очередь замечаний (мета в localStorage, PNG в IDB).
- **Feedback API:** один REST; на ПК — Docker Postgres (`DATABASE_URL`) или JSON; Termux — JSON + cloudflared при необходимости.
- **Telegram:** notify (и опционально webhook кнопок) — процесс на ПК или телефоне.
- **Цель дальше:** тот же REST → облачная БД при необходимости; Supabase не обязателен для MVP.

PII локальной CRM не коммитить (`clients` seed публичный отдельно).

## Модули MVP (`ModuleKey`)

Назначаются в разделе «Безопасность» на учётку (`allowedModules`):

- `clients`, `calculator`, `documents`, `object_control`, `updates`, `security`, `feedback`

Индекс описаний: [docs/modules/README.md](modules/README.md).

Процессы (диаграммы): [docs/processes/](processes/) — например [feedback.md](processes/feedback.md).

## AI-контекст

Краткий resume: `.ai/CONTEXT.md`, `.ai/state.json`, `.ai/INDEX.md` (см. правило `ai-project-context-structure`).
