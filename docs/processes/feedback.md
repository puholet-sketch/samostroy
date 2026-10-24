# Процесс: замечание (Ревизор)

Схема фазы A (локальная очередь + опциональный Termux API / Telegram).

```mermaid
flowchart TD
  A[Пользователь на экране CRM] --> B[FAB / меню Замечание]
  B --> C[Снимок экрана]
  C --> D[Метки на скрине]
  D --> E[Тема, описание, тип]
  E --> F[Очередь в браузере\nfeedbackStore + IDB]
  F --> G{Feedback API\nнастроен и доступен?}
  G -->|да| H[POST /api/feedback]
  H --> I[Telegram уведомление]
  H --> J[Инбокс /feedback]
  G -->|нет| K[syncStatus: pending]
  K --> J
  J --> L[Статус: new → in_progress → done]
  J --> M[Постановка для Cursor]
```

## Статусы

`new` → `in_progress` → `done`

## Документация модуля

Полное описание API, полей и бота: [modules/feedback.md](../modules/feedback.md).
