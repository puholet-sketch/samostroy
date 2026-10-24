# Модуль «Безопасность»

Учётки, роли и видимость разделов CRM (`allowedModules`).

## Права

- `ModuleKey`: `security`
- UI: `/security`
- Обычно только роль владельца

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
