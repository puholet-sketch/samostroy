# Модуль «Безопасность» (UI: Настройки)

Учётки, роли и видимость разделов CRM (`allowedModules`); настройка Feedback API / email.

## Права

- `ModuleKey`: `security` (права не переименовывали)
- UI: `/settings/security` (редирект с `/settings` и старого `/security`)
- Вкладки: «Учётки» | «Замечания / API»
- Обычно только роль владельца
- Пункт сайдбара: «Настройки»

## Роли

| Роль | Смысл |
|------|--------|
| `owner` | Полный контур: клиенты, договоры, безопасность, замечания… |
| `developer` | Внутренние инструменты в том же CRM: замечания (full), обновления (read), опц. контроль объекта (read); без PII клиентов |
| `foreman` | Упор на контроль объекта / отчёты; стартовый путь `/control` |

Модули назначаются чекбоксами на учётку (`ModuleKey` в `services/types`).

Демо: `developer` / `developer123`.

## Данные

| Что | Где |
|-----|-----|
| Пользователи (seed) | `data/users.json` |
| Права / шаблоны | `data/permissions.json` |
| Сессия | localStorage `samostroy:session` |
| Feedback API URL/token | localStorage / env (см. feedback.md) |

## Связанный код

- `src/components/security/SecurityPage.tsx`
- `src/contexts/AuthContext.tsx`
