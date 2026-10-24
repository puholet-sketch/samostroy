---
project: samostroy
v: 6
---

# СамоСтрой

MVP: КК → документы/калькулятор → контроль объекта → **Замечания (Ревизор)**.
Один CRM; роль `developer` для внутренних инструментов (не отдельный SPA).

## Факты

- Права: `allowedModules`; роли owner / developer / foreman
- Ревизор: localStorage/IDB + Feedback API (`bots/feedback-bot`, JSON или Docker Postgres)
- Документы: `docs/architecture.md`, `docs/modules/*`
- Деплой Pages: changelog + `BUILD_STAMP`

## Документы (SSOT)

- Генерация: `src/lib/generateDocs.ts`
- Образцы: `docs/preview/*.docx`, эталоны `docs/templates/`
- Прайс: `docs/templates/price_list_march.pdf`

## Prod CRM (read-only)

- URL: http://crm.1-remont.com — только смотреть, не писать
