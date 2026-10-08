---
project: samostroy
v: 4
---

# Самострой

CRM/ops для ремонтной компании: продажи (дизайн → ремонт) и производство.

## Стек

React 18 + Vite + TypeScript + Tailwind (primary-600 blue как iFrontIngos) + React Router + Leaflet + Recharts + Headless UI + Heroicons.

## Данные (фаза 1)

- `data/*.json` — источник истины (в репо).
- `media/` — файлы фото/видео; в JSON только пути, не base64.
- `IRepository` / `JsonRepository` — адаптер; позже Postgres/MariaDB/Supabase.
- Мутации в браузере пишутся в `localStorage` поверх seed JSON.

## Роли

owner (директор), seller, foreman, builder, supervisor, client.
Права: `data/permissions.json` (role × module × read/write). Client видит только свои объекты; этапы/отчёты — при `clientVisible=true`.

## Домен

- 14 этапов из REMONT Светланова → `data/stage_template.json`; суммы per object.
- Seller: много объектов (`sellerId`).
- Daily report: write по permission; дедлайн 21:00.
- Карта: Москва + МО, Nominatim autocomplete.
