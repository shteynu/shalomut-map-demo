---
name: shalomut-map
description: Работай с продуктом и кодом Shalomut Map в репозитории shalomut-map-demo. Используй при изменении UI/UX, RTL Hebrew, опроса и методологии, wellbeing dimensions, scoring, privacy threshold, manager flows, dashboard stone map, persistence, API, AI analytics integration, product docs и source-of-truth файлов.
---

# Shalomut Map

## Назначение

Используй этот скилл для предметной и продуктовой реализации. Для продолжения
сессии, определения текущего статуса и подготовки handoff используй соседний
`../shalomut-tracker/SKILL.md`.

## Старт работы

1. Определи корень репозитория через `git rev-parse --show-toplevel`.
2. Прочитай `docs/source-of-truth.md` и релевантный код.
3. Загрузи дополнительный контекст по типу задачи:
   - UI/UX: `PRODUCT.md` и `design.md`;
   - runtime, API и persistence: `PROJECT_CONTEXT.md` и
     `docs/shalomut-tracker-handoff.md`;
   - AI analytics: `docs/ai-analytics-handoff.md`,
     `contracts/ai-analytics-v1.json` и `ai-analytics-service/README.md`;
   - survey methodology: `src/lib/shalomut-source.ts`.
4. Проверь существующие компоненты, тесты и patterns до добавления новых
   abstractions.

## Канонические границы

- Используй `src/lib/shalomut-source.ts` как runtime-источник методологии.
- Считай Google Form upstream-источником v1 questionnaire, а Adobe XD —
  визуальной reference, согласно `docs/source-of-truth.md`.
- Не используй `src/lib/demo-data.ts`, `DEMO_ORGANIZATION`, `DEMO_ROUND` или
  `SHALOM-DEMO` как скрытый runtime fallback. Demo data допустимы только как
  явные fixtures или визуальные mock metadata.
- Оставляй пустую или недоступную persistence пустой; deployed writes без
  `DATABASE_URL` должны завершаться fail-closed.
- Сохраняй восемь wellbeing dimensions и 24 обязательных вопроса, пока
  пользователь явно не запросил новую versioned methodology.
- Сохраняй configurable scoring thresholds: green `>=75`, yellow `50–74`, red
  `<50`.
- Применяй настроенный privacy threshold, по умолчанию 10. Не раскрывай
  respondent identity, индивидуальные ответы или detailed results ниже порога.
- Сохраняй границу между Core Data Layer и внешним AI analytics service.
  Проверяй versioned contract и используй fail-closed transport.

## Product и UI

- Проектируй Hebrew RTL как основной experience, включая reading order,
  navigation arrows и responsive layout.
- Соблюдай WCAG AA и не передавай статус только цветом.
- Не используй white text на ярких green/yellow status surfaces.
- Сохраняй warm organic stone-map language из `design.md`; избегай cold
  corporate dashboard aesthetics.
- Предпочитай существующие компоненты и tokens.
- Сохраняй first-class empty, loading, error и privacy-locked states.

## Безопасность изменений

- Не изменяй production data, secrets, aliases, deployments или shared
  databases без явного ограниченного подтверждения.
- Не применяй migration без подтверждённых environment, target и
  rollback/PITR path.
- Не подключай публичные manager writes к реальным данным без authentication,
  authorization или подтверждённой deployment protection.

## Проверка

- Начинай с targeted tests для изменённого поведения.
- По релевантности запускай `npm test`, `npm run lint`, `npm run build`, Prisma
  validation и Python tests.
- После изменения survey source проверяй respondent и dashboard flows.
- После изменения API синхронизируй и проверяй OpenAPI JSON/YAML и contract
  tests.
- Сообщай только о проверках, которые действительно были выполнены.
