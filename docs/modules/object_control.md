# Модуль «Контроль объекта»

Календарь дневных отчётов по объекту клиента и публичная ссылка для заполнения с телефона на стройке.

## Права

- `ModuleKey`: `object_control`
- UI: `/control`
- Публичная форма без логина: `/report/:token`

## Бизнес-поток

1. Владелец/менеджер выбирает клиента → объект/адрес.
2. Создаёт или копирует ссылку отчёта.
3. Специалист на объекте открывает ссылку, заполняет дату, работы, проблемы, вложения.
4. Отчёты видны в календаре года (12 месяцев; год ≤ текущему).

## Ограничения формы отчёта

- Дата отчёта не позже сегодняшней.
- Суммарный размер вложений ≤ 5 МБ на отчёт.

## Данные

| Что | Где |
|-----|-----|
| Ссылки контроля | localStorage + при API → таблица `control_links` |
| Дневные отчёты (мета) | localStorage + при API → `object_reports` |
| Медиа вложений | IndexedDB + при API → `POST/GET /api/object-report-media` |
| Seed (демо pipeline) | `data/daily_reports.json` (отдельный stub UI) |
| KPI недели | сб–пт, все объекты (`src/lib/weekRange.ts`) — в шапке `/control` |

### Local pro-stack

При `VITE_FEEDBACK_API_URL` / `VITE_API_URL` + token (тот же REST, что feedback):

| Метод | Путь |
|-------|------|
| GET | `/api/object-reports?token=` |
| POST | `/api/object-reports` |
| POST | `/api/object-report-media` (multipart: id, file, mime…) |
| GET | `/api/object-report-media/:id` |
| GET | `/api/control-links/:token` |
| POST | `/api/control-links` |

Сохранение отчёта: **сначала localStorage** (календарь сразу зелёный), затем API с таймаутом ~12–15 с; при ошибке сети форма пишет «сохранено локально».

Заголовок: `X-Feedback-Token`. Схема: `docker/postgres/init/002_object_reports.sql`.

```bash
docker compose up -d
# если volume уже был без 002_*:
Get-Content docker/postgres/migrations/002_object_reports.sql | docker compose exec -T postgres psql -U samostroy -d samostroy
```

Без API отчёт остаётся в браузере отправителя. Pages → localhost API с интернета не работает.

## Связанный код

- `src/components/control/ObjectControlPage.tsx`
- `src/components/control/PublicReportPage.tsx`
- `src/lib/objectReports.ts`, `src/lib/objectReportsApi.ts`
