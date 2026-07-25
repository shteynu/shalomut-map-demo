# PROJECT CONTEXT: Shalomut Map (מפת שלומות)

## 📌 Описание проекта
"Shalomut Map" (מפת שלומות) — веб-платформа для визиуализации благополучия педагогического состава в израильских школах. Визуализируется в виде интерактивной карты органических "камней" (stones) — по одному на каждое измерение благополучия (самовыражение, компетентность, микроклимат и т.д.).

## 🛠 Технический стек
- **Фреймворк**: Next.js 16 (App Router), React 19, TypeScript 6.
- **Стилизация**: Tailwind CSS v4, PostCSS, CSS variables для цветовой палитры.
- **Иконки**: Lucide React.
- **Локализация и макет**: RTL-first (`dir="rtl"`), поддержка иврита как основного языка.
- **Определения дизайна**:
  - Ивритский типографический стек: `"Arial", "Noto Sans Hebrew", system-ui, sans-serif`.
  - Цветовая палитра: теплый бумажный фон (`#fbf4dd`), чернильный текст (`--ink: #383838`), органические скругления.
  - Стандарты доступности: WCAG AA compliance (минимальный контраст 4.5:1, доступные интерактивные камни).

## 📁 Ключевые файлы документации
- [docs/data-layer-and-backend-plan.md](file:///Users/maxim.berenshtein/WebstormProjects/shalomut-map-demo/docs/data-layer-and-backend-plan.md) — **Бэкенд и Data Layer**: ERD, спецификация сервисов и API.
- [PRODUCT.md](file:///Users/maxim.berenshtein/WebstormProjects/shalomut-map-demo/PRODUCT.md) — Потребности пользователей, бренд, принципы дизайна и анонимность.
- [design.md](file:///Users/maxim.berenshtein/WebstormProjects/shalomut-map-demo/design.md) — Полный гайд по дизайн-системе, цветам и компонентам.
- [ROADMAP.md](file:///Users/maxim.berenshtein/WebstormProjects/shalomut-map-demo/ROADMAP.md) — Завершенные типографические оптимизации и WCAG AA адаптация.
- [PROGRESS.md](file:///Users/maxim.berenshtein/WebstormProjects/shalomut-map-demo/PROGRESS.md) — **Память сессий**: текущий статус и следующие шаги.
- [docs/shalomut-tracker-handoff.md](file:///Users/maxim.berenshtein/WebstormProjects/shalomut-map-demo/docs/shalomut-tracker-handoff.md) — актуальный operational handoff: database-backed manager UI, staging blockers, доказательства и approval gates.
- [docs/ai-analytics-handoff.md](file:///Users/maxim.berenshtein/WebstormProjects/shalomut-map-demo/docs/ai-analytics-handoff.md) — handoff: сделано, подтверждено, осталось и approval gates.
- [contracts/ai-analytics-v1.json](file:///Users/maxim.berenshtein/WebstormProjects/shalomut-map-demo/contracts/ai-analytics-v1.json) — immutable deployed structural contract `1.0`.
- [contracts/ai-analytics-v2.json](file:///Users/maxim.berenshtein/WebstormProjects/shalomut-map-demo/contracts/ai-analytics-v2.json) — breaking semantic contract `2.0`: те же восемь измерений, 24 canonical questions, status-scoped output и provenance.
- [ai-analytics-service/README.md](file:///Users/maxim.berenshtein/WebstormProjects/shalomut-map-demo/ai-analytics-service/README.md) — локальный запуск, границы runtime и переменные AI-сервиса.


## 📐 Архитектурные Решения (Architectural Decision Records - ADR)

### ADR-001: Строгое разделение Data Layer (Core App) и AI-Сервиса Аналитики
- **Решение**: Вся аналитическая логика высокого уровня, инсайты, выводы и генерация рекомендаций **полностью вынесены во внешний AI-сервис** (отдельный микросервис / AI-агент).
- **Границы ответственности данного репозитория (`shalomut-map`)**:
  1. **Чистый Data Layer**: Репозитории (`IRoundRepository`, `ISurveyRepository`), модели Prisma (`schema.prisma`), сбор и анонимное сохранение ответов.
  2. **Core App & API**: Создание раундов опросов (`SHALOM-XXXX`), выдача вопросов анкеты, анонимная отправка ответов, базовая агрегация баллов 8 измерений и контроль порога анонимности (`privacyThreshold >= 10`).
  3. **Запрет внутренней аналитики**: Внутри данного приложения **ЗАПРЕЩЕНО** строить внутренние экспертные движки рекомендаций или тяжёлый бизнес-анализ. Приложение выполняет роль надёжного источника и хранилища сырых данных (*Single Source of Raw Data*).

### ADR-002: Versioned AI Analytics Contract и fail-closed transport
- **Решение**: `contracts/ai-analytics-v1.json` остаётся immutable deployed structural contract. Breaking semantic requirements опубликованы отдельно в `contracts/ai-analytics-v2.json`; они сохраняют 8×24 methodology и добавляют privacy-safe question aggregates, strict Hebrew/status validation, canonical metrics и persisted provenance. Callback имеет отдельные validator-ветки для `1.0` и `2.0`, поэтому семантика `1.0` не ужесточается молча.
- **Rollout**: consumer-first. Python сначала принимает legacy/`1.0` и `2.0`, возвращая effective input version; затем Core callback принимает обе версии; только после этого Core MCP producer начинает отправлять explicit `2.0`. Во время rollback window `1.0` продолжает приниматься.
- **Персистентность**: В production-режиме результат хранится в `SurveyRound.aiInsights`; migration `20260724170000_add_ai_insights` применена к текущей настроенной Supabase-цели. Для других окружений миграция запускается отдельно после подтверждения target.
- **Транспорт**: MCP, webhook и callback поддерживают независимые Bearer secrets. При недоступности удалённого MCP/AI-сервиса обработка завершается ошибкой; mock data разрешены только при явном `USE_MOCK_MCP=true`.
- **UI**: Dashboard читает AI-insights по `roundId`, валидирует контракт на клиентской границе и отдельно отображает loading, privacy-locked, not-found и error состояния.

### ADR-003: Empty persistence must remain empty
- **Решение**: отсутствие `DATABASE_URL`, недоступный Prisma client или пустая БД не должны автоматически создавать школу, раунд или ответы. Default in-memory repositories стартуют пустыми.
- **Demo boundary**: `DEMO_ORGANIZATION`, `DEMO_ROUND`, `SHALOM-DEMO` и `src/lib/demo-data.ts` разрешены только как явные test/demo fixtures и визуальные mock metadata, но не как скрытый production fallback.
- **UI**: manager routes получают organization/current round/counts/analytics через `ManagerContextService`. Если организации или раунда нет, показывается явный onboarding state. `src/lib/demo-data.ts` не является источником runtime records.

### ADR-004: Manager UI требует server runtime и persisted configuration
- **Решение**: Home, setup, round tracking, survey builder, dashboard и respondent survey используют request-time Data Layer. Setup и definition сохраняются через manager API; текущий раунд выбирается по явному приоритету статуса и времени создания.
- **Хранилище**: `SurveyRound.backgroundContext` и `SurveyRound.surveyDefinition` хранятся как JSON. Миграция `20260724180000_add_round_configuration` должна применяться отдельно к каждому подтверждённому окружению.
- **Deployment**: `output: "export"`, GitHub Pages workflow и demo `generateStaticParams` несовместимы с database-backed route handlers и удалены. Поддерживаемая модель — Next.js server runtime (Vercel или эквивалент).
- **Security boundary**: shared `BASIC_AUTH_USER`/`BASIC_AUTH_PASSWORD` вместе
  с `MANAGER_ORGANIZATION_ID` закрывают manager UI/API и привязывают один
  deployment credential ровно к одной организации. Middleware всегда удаляет
  клиентский scope header и добавляет server-owned organization ID; manager
  routes повторно проверяют принадлежность раунда и скрывают чужие ресурсы как
  `404`. Вне local development отсутствие любого из трёх значений fail-closed
  отвечает `503`. Respondent routes и machine-to-machine MCP/callback
  endpoints остаются вне browser challenge и используют свои boundaries. Это
  всё ещё временный deployment gate, а не manager identity, role model или
  полноценная multi-tenant authorization.
- **Fail-closed persistence**: deployed runtime (`NODE_ENV=production` или Vercel) без `DATABASE_URL` может показывать пустой onboarding, но отклоняет data writes с `503`. Локальный development fallback хранится в общем `globalThis` state между server bundles.

### ADR-005: AI analytics service поставляется как контейнер, а не как Vercel-функция
- **Решение**: изолированный FastAPI-сервис собирается корневым `Dockerfile` в отдельный образ. Build context — корень репозитория, потому что `src/contracts.py` читает общий `contracts/ai-analytics-v1.json`; образ сохраняет ту же относительную раскладку. Целевая площадка — Google Cloud Run (scale-to-zero, free tier); `render.yaml` описывает тот же образ для Render.
- **Почему не Vercel**: пакет не содержит Python entrypoint в `api/`, а секция `[tool.vercel]` в `pyproject.toml` не была конвенцией Vercel и удалена как вводящая в заблуждение.
- **Fail-closed environment**: если не заданы ни `ENV`, ни `VERCEL_ENV`, сервис считает окружение production и требует `AI_WEBHOOK_SECRET`. Локальный запуск без секретов требует явного `ENV=development`.
- **Production readiness**: вне development сервис требует все три shared secrets, non-local `DATA_LAYER_MCP_URL`/`DATA_LAYER_CALLBACK_URL` и `USE_MOCK_MCP=false`. Невалидная конфигурация блокирует startup; webhook credentials проверяются до раскрытия transport-readiness details.
- **Callback boundary**: callback destination строится только из доверенного `DATA_LAYER_CALLBACK_URL` и URL-encoded `roundId`. Поле `callbackUrl` входного webhook принимается для обратной совместимости, но не управляет transport. Direct `POST /api/v1/analyze` доступен только в `ENV=development`.
- **Транспорт**: интерпретации всех измерений выполняются параллельно в worker threads, MCP-запрос и доставка callback не блокируют event loop. Core app ограничивает ожидание вебхука `AI_SERVICE_TIMEOUT_MS` (30s по умолчанию) и отвечает `504` вместо бесконечного ожидания.

---

## 🌐 Окружения и Деплой (Environments & Deployment)
- **Staging (`stg`)**:
  - **URL**: `https://shalomut-map-demo-ui-redesign.vercel.app/`
  - **Текущее состояние**: database-backed slice из PR #6 смержен в `main` (`043f54d`), но alias пока остаётся на проверенном empty-runtime preview `dpl_35S9VvwN8V9Bq7da3iP2SJwT4349`, commit `a20ac66`.
  - **Проверка**: `/` → `0/0`, `/api/rounds/` → `{"round":null}`, HTTP 200.
  - **Обнаруженная конфигурация**: Preview использует отдельную staging Supabase и Vercel Authentication; AI-service project ещё не создан. Production env vars отсутствуют.
  - **Целевое правило**: обновлять alias только после application-level manager authorization и полного smoke/E2E.
- **Production (`prod`)**:
  - **URL**: `https://shalomut-map-demo.vercel.app/`
  - **Состояние**: в рамках database-backed manager slice не изменялся.
  - **Новый deployment gate**: перед следующим core deploy нужно подтвердить
    organization ID для staging target и отдельно добавить
    `MANAGER_ORGANIZATION_ID`; текущий снимок deployed env этой переменной не
    содержит.
  - **Правило**: Мануальный деплой только по прямому указанию (через Vercel Dashboard *Promote to Production* или GitHub Actions `workflow_dispatch`).

### Переменные AI-интеграции
- Core app: `AI_SERVICE_URL`, `AI_SERVICE_TIMEOUT_MS`, `MCP_SHARED_SECRET`,
  `AI_WEBHOOK_SECRET`, `AI_CALLBACK_SECRET`, а также временные manager-gate
  настройки `BASIC_AUTH_USER`, `BASIC_AUTH_PASSWORD` и
  `MANAGER_ORGANIZATION_ID`.
- AI service: `ENV`, `DATA_LAYER_MCP_URL`, `DATA_LAYER_CALLBACK_URL`, те же три shared secrets и `USE_MOCK_MCP`.
- Безопасные шаблоны находятся в `.env.example` и `ai-analytics-service/.env.example`; реальные значения не коммитятся.

## ⚠️ Правила разработки
1. RTL-first: все макеты создаются с учетом чтения справа налево.
2. Никаких холодных корпоративных серок: всегда используем теплые токены бренда.
3. WCAG AA: текст внутри цветных камней должен быть читаемым (`#383838`).
4. Соблюдение ADR-001: Data Layer только формирует и хранит данные; вся аналитическая рефлексия — задача внешнего AI-сервиса.
