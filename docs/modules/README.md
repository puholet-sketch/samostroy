# Модули СамоСтрой

| Модуль | Код | Документ |
|--------|-----|----------|
| Клиенты | `clients` | [crm_client_card_fields.md](../crm_client_card_fields.md) |
| Калькулятор | `calculator` | — |
| Договоры и акты | `documents` | [crm_client_card_fields.md](../crm_client_card_fields.md), `src/lib/generateDocs.ts` |
| Контроль объекта | `object_control` | [object_control.md](object_control.md) |
| Обновления | `updates` | [updates.md](updates.md), `data/changelog.json`, `data/releases/` |
| Настройки (безопасность) | `security` | [security.md](security.md) · `/settings/security` |
| Замечания (Ревизор) | `feedback` | [feedback.md](feedback.md), [процесс](../processes/feedback.md) |

Общая архитектура: [../architecture.md](../architecture.md).

## Релизы и документация

Каждый релиз в `data/changelog.json` может ссылаться на docs (`docs[]`) и иметь бизнес-страницу `data/releases/<id>.md`, открываемую в CRM как `/updates/<id>`. Как добавлять следующий релиз — в [updates.md](updates.md).
