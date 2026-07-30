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
- [contracts/ai-analytics-v3.json](file:///Users/maxim.berenshtein/WebstormProjects/shalomut-map-demo/contracts/ai-analytics-v3.json) — deployed breaking contract `3.0`: dynamic exact round questions при фиксированном eight-stone output.
- [docs/dynamic-questionnaire-ai-contract.md](file:///Users/maxim.berenshtein/WebstormProjects/shalomut-map-demo/docs/dynamic-questionnaire-ai-contract.md) — реализованный contract и завершённый consumer-first rollout для динамических round-scoped вопросов.
- [ai-analytics-service/README.md](file:///Users/maxim.berenshtein/WebstormProjects/shalomut-map-demo/ai-analytics-service/README.md) — локальный запуск, границы runtime и переменные AI-сервиса.


## 📐 Архитектурные Решения (Architectural Decision Records - ADR)

### ADR-001: Строгое разделение Data Layer (Core App) и AI-Сервиса Аналитики
- **Решение**: Вся аналитическая логика высокого уровня, инсайты, выводы и генерация рекомендаций **полностью вынесены во внешний AI-сервис** (отдельный микросервис / AI-агент).
- **Границы ответственности данного репозитория (`shalomut-map`)**:
  1. **Чистый Data Layer**: Репозитории (`IRoundRepository`, `ISurveyRepository`), модели Prisma (`schema.prisma`), сбор и анонимное сохранение ответов.
  2. **Core App & API**: Создание раундов опросов (`SHALOM-XXXX`), выдача вопросов анкеты, анонимная отправка ответов, базовая агрегация баллов 8 измерений и контроль порога анонимности (`privacyThreshold`, десять респондентов — это и дефолт, и минимум, с которым можно завести раунд; настраивается только вверх).
  3. **Запрет внутренней аналитики**: Внутри данного приложения **ЗАПРЕЩЕНО** строить внутренние экспертные движки рекомендаций или тяжёлый бизнес-анализ. Приложение выполняет роль надёжного источника и хранилища сырых данных (*Single Source of Raw Data*).

### ADR-002: Versioned AI Analytics Contract и fail-closed transport
- **Решение**: `contracts/ai-analytics-v1.json` и `contracts/ai-analytics-v2.json` остаются immutable deployed contracts. Breaking dynamic requirements опубликованы отдельно в `contracts/ai-analytics-v3.json`; они заменяют exact-24 allowlist на exact persisted round questions, сохраняя восемь dimensions, strict Hebrew/status validation, metrics и provenance. Callback имеет отдельные validator-ветки для `1.0`, `2.0` и `3.0`, поэтому legacy semantics не ужесточаются молча.
- **Rollout**: consumer-first rollout `3.0` завершён 2026-07-26: Python сначала принял все три версии, затем Core callback и Dashboard readers, после чего Core MCP producer начал отправлять `3.0`. Producer `2.0` остаётся rollback boundary.
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
- **Security boundary**: manager UI/API закрыты application-level сессией
  (cookie или Bearer JWT); browser Basic Auth challenge не выдаётся,
  неаутентифицированные page requests уходят на `/login`, API отвечает `401`.
  `MANAGER_ORGANIZATION_ID` привязывает выданную сессию ровно к одной
  организации. Middleware всегда удаляет клиентский scope header и добавляет
  server-owned organization ID; manager routes повторно проверяют
  принадлежность раунда и скрывают чужие ресурсы как `404`. На deployed runtime
  (`NODE_ENV=production` или Vercel, кроме фазы production build) обязательны
  три значения — `SESSION_SECRET`, `MANAGER_ADMIN_PASSWORD` и
  `MANAGER_ORGANIZATION_ID`; отсутствие любого из них fail-closed отвечает
  `503 UNCONFIGURED` на `POST /api/auth/login`, вместо выдачи сессии с
  фолбэком. Хардкод-фолбэков организации в коде нет: вне deployed runtime
  используется явный local-development fallback. Respondent routes и
  machine-to-machine MCP/callback endpoints остаются вне browser challenge и
  используют свои boundaries. Это по-прежнему single-organization deployment
  gate, а не полноценная multi-tenant authorization.
- **Fail-closed persistence**: deployed runtime (`NODE_ENV=production` или Vercel) без `DATABASE_URL` может показывать пустой onboarding, но отклоняет data writes с `503`. Локальный development fallback хранится в общем `globalThis` state между server bundles.

### ADR-005: AI analytics service поставляется как контейнер, а не как Vercel-функция
- **Решение**: изолированный FastAPI-сервис собирается корневым `Dockerfile` в отдельный образ. Build context — корень репозитория, потому что `src/contracts.py` читает общий `contracts/ai-analytics-v1.json`; образ сохраняет ту же относительную раскладку. Целевая площадка — Google Cloud Run (scale-to-zero, free tier); `render.yaml` описывает тот же образ для Render.
- **Почему не Vercel**: пакет не содержит Python entrypoint в `api/`, а секция `[tool.vercel]` в `pyproject.toml` не была конвенцией Vercel и удалена как вводящая в заблуждение.
- **Fail-closed environment**: если не заданы ни `ENV`, ни `VERCEL_ENV`, сервис считает окружение production и требует `AI_WEBHOOK_SECRET`. Локальный запуск без секретов требует явного `ENV=development`.
- **Production readiness**: вне development сервис требует все три shared secrets, non-local `DATA_LAYER_MCP_URL`/`DATA_LAYER_CALLBACK_URL` и `USE_MOCK_MCP=false`. Невалидная конфигурация блокирует startup; webhook credentials проверяются до раскрытия transport-readiness details.
- **Callback boundary**: callback destination строится только из доверенного `DATA_LAYER_CALLBACK_URL` и URL-encoded `roundId`. Поле `callbackUrl` входного webhook принимается для обратной совместимости, но не управляет transport. Direct `POST /api/v1/analyze` доступен только в `ENV=development`.
- **Транспорт**: интерпретации всех измерений выполняются параллельно в worker threads, MCP-запрос и доставка callback не блокируют event loop. Core app ограничивает ожидание вебхука `AI_SERVICE_TIMEOUT_MS` (30s по умолчанию) и отвечает `504` вместо бесконечного ожидания.

### ADR-006: Dynamic questionnaire input, fixed Dashboard output
- **Решение**: вопросы являются persisted содержимым конкретного
  `SurveyRound.surveyDefinition`, а не глобальным AI allowlist. Исходные 24
  вопроса остаются default/legacy template. Новый раунд может использовать
  другие ID, формулировки и количество продуктовых wellbeing-вопросов.
- **Стабильная taxonomy**: восемь wellbeing dimensions, scoring thresholds и
  восьмикаменная Dashboard result shape остаются фиксированными. Каждый
  анализируемый вопрос явно привязан к одной dimension; AI не выдумывает
  отсутствующие dimension data.
- **Reproducibility**: Core агрегирует ответы по exact persisted round snapshot
  и передаёт AI фактические question ID/text/dimension/score/count плюс
  проверяемую revision/hash. После начала сбора ответов изменение snapshot
  требует нового round/revision, чтобы старые ответы не сменили смысл.
- **Compatibility**: deployed contracts `1.0` и `2.0` immutable. Переход от
  exact 24 canonical questions к dynamic aggregates является breaking change;
  contract `3.0` опубликован отдельно и развёрнут consumer-first. Deployed Core
  producer теперь формирует `3.0`; rollback на producer `2.0` остаётся валидным.
- **Privacy**: partial unlocked analysis запрещён. AI получает полный набор
  aggregates только когда total и каждый анализируемый вопрос достигли
  threshold. Иначе весь detailed result остаётся locked, provider не
  вызывается и missing stones не синтезируются.

### ADR-007: Недоступный провайдер — это отказ, а не текст сервиса
- **Решение (2026-07-28)**: если провайдер не выдал приемлемый ответ —
  отсутствует ключ, `429`, таймаут, битый ответ, вывод отвергнут валидаторами на
  всех попытках — сервис **не** подставляет собственную копию. Раунд целиком
  завершается `status: "validation_failed"` с `failureReason:
  "provider_unavailable"` и иврит-сообщением, а UI говорит, что сервис анализа
  временно недоступен.
- **Почему**: подставленный текст неотличим на дашборде от настоящего анализа.
  Школа не может понять, что действует по выдуманному выводу, а сбой квоты
  выглядит как готовый результат. Отказ — единственная честная форма.
- **Границы**: детерминированная копия остаётся у зелёного измерения и у текста
  каталога, написанного человеком, при неудачной адаптации рекомендации на
  `5.0`. Ни то ни другое не прикрывает упавший вызов. У зелёного к ней две
  дороги, и провенанс их различает: `ONLY_LLM_FOR_PROBLEMATIC` не делает вызова
  вовсе (`deterministic_fallback`/`attempts=0`), а с выключенным флагом —
  значение по умолчанию с 2026-07-30 — зелёное спрашивают наравне с остальными и
  при отказе оно получает ту же фразу с числом реально потраченных попыток. Это
  не исключение из fail-closed, а его граница: фраза выведена из агрегатов, ярлык
  `llm` на неё не ставится, и жёлтому с красным она недоступна — там подстановка
  была бы догадкой о проблеме.
- **Совместимость**: статус остаётся внутри версионированного набора
  (`success`/`locked_error`/`validation_failed`), а `failureReason` — additive
  optional поле, которое существующий callback-валидатор принимает на
  не-успешном payload. Контракты `1.0`–`5.0` не меняются, consumer-first порядок
  выката не требуется.
- **Наблюдаемость состояния запуска**: пустой результат в Core различает
  `idle`, `running` и `stalled` по времени последней диспетчеризации
  (`AI_RUN_EXPECTED_COMPLETION_MS`), поэтому запуск, умерший до колбэка, не
  выглядит как «анализ не запускали».

---

## 🌐 Окружения и Деплой (Environments & Deployment)

С 2026-07-26 у продукта **одно развёрнутое окружение**. Прежний второй адрес
`shalomut-map-demo-ui-redesign.vercel.app` снят по указанию пользователя: alias
удалён, URL отвечает `404`, сам preview-деплой не удалялся. GitHub Pages снят с
публикации в тот же день.

- **Staging (единственное окружение)**:
  - **URL**: `https://shalomut-map-demo.vercel.app/`
  - **Vercel target**: `production` — Git-интеграция автоматически собирает
    каждый push в `main` и переназначает на него этот alias. В терминах Vercel
    это production target, в терминах продукта — staging.
  - **Данные**: единственная база проекта — Supabase `tpfzhyalaftotljmlont`
    (`aws-1-ap-northeast-2`, Сеул). На неё указывают и deployed runtime, и
    локальный `.env`, из которого `prisma.config.ts` берёт цель миграций.
    Второй проект `fvnulyirrqjrnjbahmsn` выведен из обращения 2026-07-27: он
    содержал одну пустую организацию и ноль раундов, ни один рантайм на него
    больше не ссылался, и 2026-07-27 он удалён владельцем.
  - **Правило одной базы**: не заводи второй `DATABASE_URL` в `.env.local` —
    Next.js отдаёт ему приоритет над `.env`, а миграции читают `.env`, и эти два
    пути расходятся молча. Именно так миграции 2026-07-27 ушли в базу, которую
    приложение не обслуживает. Перед `prisma migrate` сверяй хост в выводе Prisma.
  - **Доступ**: менеджерская сессия (`/login`); Basic Auth приложения снят —
    `BASIC_AUTH_USER`/`BASIC_AUTH_PASSWORD` удалены из Vercel 2026-07-27 и не
    читаются кодом. Vercel SSO на этом адресе не включён.
  - **Обязательная конфигурация рантайма**: `SESSION_SECRET`,
    `MANAGER_ADMIN_PASSWORD` и `MANAGER_ORGANIZATION_ID`. Без любого из них
    `POST /api/auth/login` отвечает `503 UNCONFIGURED` и сессия не выдаётся.
- **Production**: отдельное окружение будет создано позднее по необходимости —
  с собственным alias, собственной БД и явным решением о деплой-гейтах.

### Переменные AI-интеграции
- Core app: `AI_SERVICE_URL`, `AI_SERVICE_TIMEOUT_MS`, `MCP_SHARED_SECRET`,
  `AI_WEBHOOK_SECRET`, `AI_CALLBACK_SECRET`, а также manager-gate настройки
  `SESSION_SECRET`, `MANAGER_ADMIN_EMAIL`, `MANAGER_ADMIN_PASSWORD` и
  `MANAGER_ORGANIZATION_ID`.
- AI service: `ENV`, `DATA_LAYER_MCP_URL`, `DATA_LAYER_CALLBACK_URL`, те же три shared secrets и `USE_MOCK_MCP`.
- Безопасные шаблоны находятся в `.env.example` и `ai-analytics-service/.env.example`; реальные значения не коммитятся.

## ⚠️ Правила разработки
1. RTL-first: все макеты создаются с учетом чтения справа налево.
2. Никаких холодных корпоративных серок: всегда используем теплые токены бренда.
3. WCAG AA: текст внутри цветных камней должен быть читаемым (`#383838`).
4. Соблюдение ADR-001: Data Layer только формирует и хранит данные; вся аналитическая рефлексия — задача внешнего AI-сервиса.
