# Samostroy — INDEX

| path | purpose |
|------|---------|
| `data/users.json` | пользователи и роли (seed) |
| `data/permissions.json` | матрица role×module×rw |
| `data/objects.json` | объекты CRM + pipeline stages |
| `data/stage_template.json` | канон 14 этапов |
| `data/tasks.json` | задачи mini-board |
| `data/checklists.json` | шаблон и ответы чек-листа продаж |
| `data/daily_reports.json` | ежедневные отчёты + дедлайн 21:00 |
| `data/funnel_events.json` | события воронки продаж |
| `media/` | медиафайлы (пути в JSON) |
| `src/services/types/` | доменные типы |
| `src/services/repository/` | IRepository + JsonRepository |
| `src/services/api/` | фасады API над репозиторием |
| `src/contexts/AuthContext.tsx` | сессия / JWT-like token |
| `src/components/layout/` | shell, nav, guards |
| `src/components/security/` | UI матрицы прав (owner) |
| `src/components/objects/` | список/карточка объекта |
| `src/components/pipeline/` | 14-этапный pipeline |
| `src/components/map/` | Leaflet Москва+МО |
| `src/components/tasks/` | kanban статусов |
| `src/components/checklist/` | чек-лист продаж |
| `src/components/reports/` | ops + sales stubs |
| `README.md` | запуск и демо-логины |
