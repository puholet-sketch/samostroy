---
project: samostroy
v: 8
---

# СамоСтрой

MVP: КК → документы/калькулятор → контроль объекта → **Замечания (Ревизор)**.
Один CRM; роль `developer` для внутренних инструментов (не отдельный SPA).

## Факты

- Права: `allowedModules`; роли owner / developer / foreman
- Ревизор: localStorage/IDB + Feedback API (`bots/feedback-bot`, JSON или Docker Postgres)
- Деплой Pages: changelog + `BUILD_STAMP`

## Документы (guided)

- Хаб `/documents` → мастера design/repair/acts; furniture = stub «скоро»
- Реестр: `src/lib/docRegistry.ts` (localStorage) + сквозной счётчик договоров
- Акты: № этапа 1…N на договор; строки из согласованной сметы, группа по типу
- Дизайн: тарифы `designTariffs.ts` (2000/3900/4700) + исключения 4.1.x/4.4.x
- Генерация: `src/lib/generateDocs.ts`; эталон `docs/templates/ryba_dogovor_design.docx`
- ТЗ ремонта: stub до файла заказчика

## Prod CRM (read-only)

- URL: http://crm.1-remont.com — только смотреть, не писать
