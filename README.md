# Самострой

CRM и операционная платформа для ремонтной компании: продажи (дизайн → ремонт) и производство.

Стек: React 18, Vite, TypeScript, Tailwind CSS (primary blue как iFrontIngos), React Router, Leaflet, Recharts, Headless UI / Heroicons.

## Быстрый старт

```bash
cd D:\projects\samostroy
npm install
npm run dev
```

Откройте http://localhost:5174

Сборка:

```bash
npm run build
npm run preview
```

## Демо-логины (fake seed, без реального PII)

| Логин | Пароль | Роль |
|-------|--------|------|
| `owner` | `owner123` | Директор (все модули + безопасность) |
| `seller` | `seller123` | Продавец |
| `foreman` | `foreman123` | Прораб |
| `builder` | `builder123` | Строитель |
| `supervisor` | `super123` | Надзор |
| `client` | `client123` | Клиент (только свой объект, этапы с `clientVisible`) |

Пользователи: `data/users.json`. Права: `data/permissions.json`.

## Архитектура данных (фаза 1)

- `data/*.json` — источник истины (коммитится).
- `media/` — фото/видео как файлы; в JSON только пути, **не** base64.
- `IRepository` / `JsonRepository` — адаптер; мутации в браузере пишутся в `localStorage` поверх seed.
- Позже можно заменить реализацию на Postgres / MariaDB / Supabase.

Сброс локальных правок: в DevTools → Application → Local Storage → удалить ключи `samostroy:v1:*` и `samostroy:session`.

## Модули MVP

| Модуль | Статус |
|--------|--------|
| Login + сессия | работает |
| Безопасность (матрица прав) | работает (owner) |
| Дашборд | работает (overview) |
| Объекты CRM | работает |
| Pipeline 14 этапов | работает (суммы per object) |
| Карта Москва+МО + Nominatim | работает |
| Задачи (mini-board) | работает |
| Ежедневные отчёты + дедлайн 21:00 | stub UI + концепт дедлайна |
| Чек-лист продаж (шаблон editable) | работает |
| Отчёты ops / воронка | stubs на seed-данных |

## Публичный репозиторий

Проект готовится к **публичному** GitHub:

- в seed только вымышленные демо-данные;
- `.gitignore` исключает `.env`, секреты и загруженные `media/**`;
- не коммитьте реальные телефоны/адреса клиентов.

Git уже инициализирован локально. Push на GitHub — только по явной команде владельца.

## Этапы работ

Канон 14 этапов скопирован из REMONT (Светланова) в `data/stage_template.json`. Плановые суммы задаются **на каждом объекте** отдельно.
