# Модуль «Обновления»

Краткая история релизов в CRM + **страница каждого релиза** с бизнес-описанием и ссылками на системную документацию.

## Права

- `ModuleKey`: `updates`
- Маршруты: `/updates` (список), `/updates/:releaseId` (деталь)
- Пункт сайдбара: «Обновления» (без вложенного меню)

## Данные

| Что | Где |
|-----|-----|
| Список релизов (id, дата, title, краткие items, docs[]) | `data/changelog.json` |
| Бизнес-нарратив релиза (markdown) | `data/releases/<id>.md` |
| Типы / загрузка | `src/lib/changelog.ts`, `src/lib/releaseNarratives.ts` |
| UI | `src/components/updates/UpdatesPage.tsx`, `ReleaseDetailPage.tsx` |
| Маркер сборки | `src/lib/buildStamp.ts` (`BUILD_STAMP`) |

`id` релиза = slug URL и имя файла нарратива (`2026-10-24-b` → `/updates/2026-10-24-b` + `data/releases/2026-10-24-b.md`).

## Поле `docs` в changelog

```json
"docs": [
  { "label": "Модуль Замечания", "href": "docs/modules/feedback.md", "kind": "repo" },
  { "label": "Инбокс", "href": "/feedback", "kind": "app" }
]
```

- `kind: "repo"` — путь в репозитории (архитектура, API, поля, процессы); в UI показывается как путь.
- `kind: "app"` — маршрут CRM (`Link`).

## Как добавить следующий релиз

1. В **начало** `data/changelog.json` — объект с новым `id` (`YYYY-MM-DD-буква`), `at` (+03:00), `title`, `items[]`, при необходимости `docs[]`.
2. Создать `data/releases/<id>.md` — бизнес-описание возможностей (не копипаста items).
3. При необходимости расширить/создать файлы в `docs/modules/`, `docs/processes/` и добавить их в `docs`.
4. При **деплое**: обновить `BUILD_STAMP`; правило `.cursor/rules/deploy-changelog.mdc`.

Без пункта в changelog **не деплоить**.

## Связанные docs

- [Архитектура](../architecture.md) — раздел «Обновления / релизы»
- [Индекс модулей](README.md)
