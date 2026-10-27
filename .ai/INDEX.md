# INDEX

docs/architecture.md | обзор слоёв, деплоя, паттерна релизов
docs/modules/README.md | индекс модулей
docs/modules/updates.md | Обновления: changelog + страницы релизов
docs/modules/feedback.md | Ревизор: UX, API, бот
docs/modules/object_control.md | контроль объекта и отчёты
docs/modules/security.md | роли и модули
docs/processes/feedback.md | схема процесса Ревизора
docs/crm_client_card_fields.md | поля КК с prod CRM
data/changelog.json | релизы UI (id, items, docs)
data/releases/ | бизнес-нарративы релизов (*.md)
src/lib/changelog.ts | типы Release / docs
src/lib/releaseNarratives.ts | загрузка data/releases
src/components/updates/ | список и страница релиза
src/lib/generateDocs.ts | договоры/акты
src/lib/feedbackStore.ts | очередь замечаний
src/lib/feedbackApi.ts | клиент Feedback API
bots/feedback-bot/ | local API: feedback + object reports + Telegram
docker-compose.yml | Postgres :5433 + api :8787
docker/postgres/ | init/migrations feedback + object_reports
src/lib/objectReports.ts | дневные отчёты; sync через API
src/lib/objectReportsApi.ts | REST-клиент отчётов/control links
src/components/feedback/ | capture + inbox
.ai/CONTEXT.md | канон MVP
.ai/state.json | resume
