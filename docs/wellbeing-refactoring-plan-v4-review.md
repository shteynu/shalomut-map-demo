# Ревью планов архитектурного рефакторинга v3 и v4

Дата ревью: 2026-07-30. Baseline проверки: `cb8bed3` (== `origin/main`, == baseline
документа v4). Локальный `main` при этом стоит на `f3dbce4` — два документационных
коммита позади, как и написано в v4.

Дополнено 2026-08-02: §6 содержит аудит фактической реализации v3 против
`origin/main` @ `ae3c3c4`. Разделы 1–5 остались такими, какими были написаны
2026-07-30, и читать их нужно как состояние на ту дату.

Входные документы:

- `wellbeing_architecture_refactoring_plan_ru_v3.pdf` — срез на `01fd852`.
- `wellbeing_architecture_refactoring_plan_ru_v4.pdf` — срез на `cb8bed3`.

Между baseline v3 и baseline v4 в ветке 14 коммитов.

## Решения владельца (2026-07-30)

Три открытых вопроса ревью закрыты, все три — по рекомендации:

1. **Порядок из §4 принят**, включая выделение отдельного PR 2.5 про
   fail-closed producer version.
2. **`anonymousTokenHash` остаётся необязательным.** В PR 2 идёт обычный
   `@@unique([roundId, anonymousTokenHash])`; ответы без токена остаются без
   защиты от гонки ровно как сегодня. Обязательным токен не делаем — настоящий
   путь респондента его шлёт всегда, а строгий вариант ломает seed.
3. **Health/capability endpoint заводим**, в составе PR 2.5.

## Вердикт

**Работаем по v4.** Он не просто новее — он исправляет главную ошибку v3 в порядке
работ: v3 требовал сначала построить полный Regression Safety Net и Contract
Registry, v4 ставит первыми четыре конкретных correctness/reliability дефекта.
Для проекта, где уже есть обязательный CI-gate и boundary E2E, это правильнее.

Архитектурное направление в обоих документах одинаковое и, на мой взгляд,
верное: модульный монолит Core + отдельный Python-воркер, build-time Contract
Registry вместо сетевого Contract Service, canonical models, ports/adapters,
persistent job state machine. Возражений по направлению нет.

Ниже — что подтвердилось, что нужно исправить в самом плане и что в нём
отсутствует.

## 1. Что проверено по коду и подтвердилось

Все фактические утверждения v4, которые я проверял, оказались точными, включая
номера строк.

| Утверждение v4 | Подтверждение |
| --- | --- |
| v5 теряет `backgroundContext` в parser | `ai-analytics-service/src/schemas/mcp_types.py:357-360` — точное сравнение с `AI_ANALYTICS_V4_CONTRACT_VERSION` |
| Нет `AiAnalysisRun`, нет unique constraints, один timestamp | `prisma/schema.prisma` — 68 строк, ни одного `@@unique`, только `aiInsightsUpdatedAt:37` |
| Unknown producer version молча даёт `3.0` | `src/lib/services/analytics.service.ts:33-38` |
| MCP route ветвится по `['4.0','5.0']` | `src/app/api/mcp/route.ts:103` |
| Callback route выбирает validation по версии | `src/app/api/rounds/[roundId]/ai-insights/route.ts:121`, `:231-237` |
| `ai-contract.ts` совмещает manifests, types и semantic validation | 847 строк, version literals на `:630`, `:689`, `:748`, `:792`, `:817` |
| Submission — check-then-create | `src/lib/services/survey.service.ts:160` |
| Repository auth branch пропускает без пароля | `src/lib/auth/manager-auth-service.ts:232-250` — `return { ok: true }` сразу после membership check |
| `BackgroundTasks` после 202 | `ai-analytics-service/src/main.py:72`, `:111` |
| `AnalyticsState` — широкий TypedDict; nodes большой | `agents/state.py` 20 строк на 14 полей, `agents/nodes.py` 864 строки |
| Двойной разбор JSON в MCP-клиенте | `ai-analytics-service/src/mcp_client/client.py:58`, `:64` |
| OpenAPI — два редактируемых артефакта | `docs/openapi.yaml` (56 KB) и `public/openapi.json` (80 KB) |
| `docs/source-of-truth.md` устарел | `:6` говорит deployed `3.0`, `:73` — `backgroundContext` только на `4.0`; в Vercel с 2026-07-29 стоит `5.0` |
| CI-gate `npm run verify` обязателен | `.github/workflows/deploy-vercel.yml`, job `validate` на push и PR в `main` |

Ошибка в путях одна и косметическая: v4 называет файл `mcp_types.py` в контексте
`mcp_client`, фактически он лежит в `ai-analytics-service/src/schemas/`.

## 2. Правки к плану

### C1. Partial unique index не нужен

v4 §10.2 пишет, что nullable `anonymousTokenHash` требует «либо обязательного
токена, либо partial unique index». В PostgreSQL уникальный индекс по умолчанию
`NULLS DISTINCT`, поэтому обычный `@@unique([roundId, anonymousTokenHash])` уже
разрешает сколько угодно строк с `NULL`. Отдельный partial index нужен только
если мы захотим схлопывать ещё и пустую строку.

Реальное решение сводится к одному продуктовому вопросу: допускаем ли мы
submission без токена вообще. Сейчас `survey.service.ts:159` вызывает
`hasTokenSubmitted` только `if (input.anonymousTokenHash)`, то есть безтокенные
ответы уже проходят мимо любой защиты. Это сокращает PR 2.

**Решено:** токен остаётся необязательным, ставим обычный `@@unique`. Сам токен
по `src/lib/survey-attempt-token.ts:18` — случайный UUID на одну сессию
заполнения, а не идентификация респондента или устройства; его единственная
задача — не засчитать двойной клик и повтор после сбоя. Настоящий UI
(`survey-flow.tsx:99`) шлёт его всегда, а `scripts/seed-local.ts:113` создаёт
ответы без него, поэтому обязательный токен сломал бы seed, ничего не добавив к
защите живого пути.

### C2. Транзакционность записи уже есть

PR 2 в v4 требует «Transactional save + unique error mapping». Транзакция уже
есть: `prisma/prisma-survey.repository.ts:28-46` делает вложенный
`create` с `answers.create`, а вложенную запись Prisma выполняет в неявной
транзакции. Не хватает только самих constraints и маппинга `P2002` в стабильный
«already submitted». Переписывать сам write не нужно.

### C3. «Startup-validated config» нужно сформулировать под serverless

v4 §12 требует «Unknown producer version останавливает startup/deployment». В
Core нет startup: `getProducedAnalyticsContractVersion()` вызывается на каждом
запросе в свежей lambda. Реализуемая форма:

1. валидация на module-init, которая бросает на неизвестном значении;
2. отдельная проверка в `npm run verify` / `next build`, чтобы деплой падал
   раньше первого запроса.

Отдельно: и v3, и v4 упоминают «health/capability endpoint» как место, где
`contractVersion` остаётся легитимным. Такого endpoint в Core нет — в
`src/app/api` только `auth`, `mcp`, `manager`, `rounds`, `survey`.

**Решено:** заводим его в составе PR 2.5. Он отвечает на тот же вопрос, что и
сама правка — какая версия контракта реально работает на деплое, — и снимает
необходимость смотреть переменные в Vercel, чтобы это узнать. Endpoint не должен
раскрывать секреты и значения переменных, только версию контракта и список
поддерживаемых версий.

### C4. `structuredContent` — двусторонняя правка, а не уборка в Python

v4 §10 даёт для двойного разбора JSON решение «structuredContent + typed source
adapter». Но Core в `src/app/api/mcp/route.ts:126-129` отдаёт только
`content[0].text`. Python не может просто начать читать `structuredContent` —
сначала Core должен его отдавать вместе с `outputSchema`, а Python обязан
сохранить fallback на текст на время выката.

Значит, это такое же consumer-first изменение контракта, как все остальные в
этом репозитории, и его место — этап C/D, а не отдельный P1-cleanup.

### C5. Auth оценён неточно в обе стороны

Занижено: активный путь `/api/auth/login` действительно проверяет пароль, но
хеширует его через SHA-256 со статическим перцем
(`manager-auth-service.ts:102-108`). Для одного admin-секрета без пользовательской
таблицы риск ограничен, но это ровно тот же пункт этапа E, что и «перевести
persistent identity на password hash», и в плане он должен быть назван, иначе
его починят наполовину.

Завышено как «единственный auth-риск»: у проекта уже есть открытый пункт крупнее
— `docs/shalomut-tracker-handoff.md`, «Рекомендуемый порядок продолжения» №2:
заменить organization-scoped shared Basic gate на application-level manager
identity/roles и настоящую tenant authorization. План v4 его не упоминал.
**Решено (2026-07-30):** план рефакторинга его не отменяет и не заменяет; пункт
этапа E официально поглощает эту задачу (tenant authorization) и становится
единственным треком для её выполнения. Устаревшие ветки, пытавшиеся решать
эту задачу ранее, закрыты.

### C6. У обязательного PostgreSQL-suite нет CI, где его запускать

v4 §13.3 объявляет «PostgreSQL integration suite обязателен в pull request».
Единственный PR-gate — `.github/workflows/deploy-vercel.yml` → `npm run verify`.
Там нет ни service-контейнера Postgres, ни `DATABASE_URL`, а `verify` состоит из
`typecheck`, `test`, `lint`, `build` и pytest.

Поэтому PR 2 обязан дополнительно поставить:

- `services: postgres` в job `validate`;
- `DATABASE_URL` для CI;
- `prisma migrate deploy` перед тестами;
- новый скрипт (например `verify:db`), включённый в `verify`.

Без этого constraint уедет вместе с тестами, которые в CI никогда не выполняются.
Это отдельная поставка, а не деталь.

### C7. Дрейф документации — это две разные строки

v4 (этап A шаг 2 и PR 1) говорит про синхронизацию `docs/source-of-truth.md` в
общем виде. Устарели две независимые фразы, и после парсерной правки они станут
неверными по-разному:

- `:6` — «Deployed contract `3.0`»; фактически с 2026-07-29 в Vercel `5.0`;
- `:73` — «Remaining `backgroundContext` fields … reach the AI prompt on
  contract `4.0` only»; после PR 1 это будет `4.0` и `5.0`.

Обе нужно назвать в плане поимённо.

### C8. Миграция unique constraint упадёт на непустой БД

`prisma/migrations` — настоящая история (`0_init` + четыре миграции), проект
использует `migrate deploy`. Добавление `@@unique` к таблице с уже существующими
дубликатами уронит `migrate deploy`. Данные расходные, так что решение простое —
`db:clear`/reseed перед выкатом, — но в плане это должно быть написано, а не
обнаружено при деплое.

## 3. Чего в v4 не хватает

### A1. Не сверено с продуктовым backlog

`docs/product-behaviour-backlog.md` держит семь открытых продуктовых пунктов
(draft persistence, clipboard failure states, builder efficiency, map a11y,
action follow-through, privacy threshold states, demo data boundaries). План
рефакторинга — параллельный трек, и он с ними пересекается: этап B меняет
источник AI-статуса для UI, а это ровно пункты 5 и 6 backlog.

Предложение: PR 1 и PR 2 изолированы и не конфликтуют — делаем их первыми. PR 3
(durable jobs) трогает UI-статус, поэтому он должен идти отдельной веткой и не
одновременно с пунктами 5–6 backlog.

### A2. Потерян rollback-план из v3

В v3 §11.7 была таблица «шаг → совместимость → rollback» («читать legacy field»,
«вернуть dispatcher flag», «сохранить старый endpoint»). В v4 от неё остался
только «dual-write/dual-read рядом с legacy timestamp». Одно окружение и
расходные данные — достаточное основание упростить rollback, но это должно быть
сознательным решением в тексте, а не молчаливой потерей. Таблицу v3 стоит
приложить к v4 как приложение.

### A3. Потеряны метрики из v3

v3 §12.6 давал конкретный список: `ai_jobs_queued/running/succeeded/failed/
stalled/retry_count`, queue wait, processing duration, callback delivery latency,
contract validation failures по version и violation code, partial-map rate,
duplicate submission conflicts. В v4 от этого осталась одна строка этапа E «job
metrics и correlation IDs». Список из v3 — это и есть проверяемый DoD для
observability джобов; возвращаем его.

### A4. Потеряна CI execution model из v3

v3 §9.4 отвечал на вопрос «какой suite когда запускается» (unit — каждый commit,
characterization/contract — каждый PR, PostgreSQL concurrency — каждый PR,
полный E2E — PR в main и nightly, real-provider smoke — отдельно). С учётом C6
это самая практичная таблица из v3, и в v4 её нет.

### A5. Этап D больше, чем выглядит

«Pipeline перестаёт получать version как policy selector» неявно требует
разобрать `nodes.py` (864 строки), `hebrew_validation.py` (710) и
`hebrew_prompts.py` (477). В v4 этап D читается как один PR. Нужно либо явно
разбить его, либо записать, что это 4–6 PR.

### A6. Базовое evidence нужно переснять

v4 честно пишет, что suite ради документа не перезапускался и что 274 TS / 269
Python — унаследованная запись. Перед PR 1 нужно один раз выполнить
`npm run verify` локально, чтобы baseline принадлежал нам, а не документу.

## 4. Предлагаемый порядок работ

Порядок v4 сохраняется, добавлены недостающие поставки.

**Состояние на 2026-07-30:** пункты 1–4 выполнены, каждый своей веткой от
`cb8bed3`; ни одна не запушена. Ветки и их HEAD перечислены в
`docs/shalomut-tracker-handoff.md`, раздел «Архитектурный рефакторинг: четыре
ветки на руках». Следующий невыполненный пункт — 5 (PR 3).

1. **Baseline — выполнено 2026-07-30.** `npm run verify` на `cb8bed3` прошёл
   целиком: typecheck, 274/274 TypeScript-теста, ESLint, production build и
   269/269 Python-тестов. Числа совпали с унаследованной записью, но теперь это
   собственное evidence, а не цитата.
2. **PR 1 — `fix(ai-contract): preserve v5 background context`.** Выполнено,
   `fix/v5-background-context` @ `1b76bac`. Red-тест через
   настоящий `RoundAnalyticsResult.from_dict`, узкая правка `mcp_types.py`
   на множество `{4.0, 5.0}`, locked-регрессия, плюс обе строки
   `docs/source-of-truth.md` (C7). Размер S.
3. **PR 2 — `fix(persistence): enforce response idempotency in postgres`.**
   Выполнено, `fix/response-idempotency` @ `92cf626`.
   Обычный `@@unique([roundId, anonymousTokenHash])` и
   `@@unique([responseId, questionId])` (C1), маппинг `P2002` (C2), миграция с
   учётом C8, **и Postgres в CI (C6)**. Размер M.
4. **PR 2.5 — `feat(config): fail closed on unknown producer contract version`.**
   Выполнено, `feat/fail-closed-contract-version` @ `0c90c1b`.
   Выделен из этапа A: module-init валидация плюс проверка в `verify` (C3), и
   здесь же новый health/capability endpoint. Размер S.
5. **PR 3 — `feat(ai-jobs): persist analysis run lifecycle`.** Не начат — это
   следующий шаг. Отдельная ветка,
   не параллельно с продуктовыми пунктами 5–6 backlog (A1). Метрики из A3 входят
   в DoD. Размер L, 2–3 коммита.
6. **Auth — организационная часть выполнена (2026-07-30), код не трогали.**
   Устаревшие ветки `agent/database-backed-manager-ui` и
   `agent/empty-runtime-repositories` удалены локально. В план этапа E явно включена работа
   над application-level manager identity/roles и tenant authorization, как указано в C5.
   **Формулировка «выполнено» здесь относилась только к веткам и планированию.**
   Сам dormant bypass в `authenticateCredentials` остался в коде и был закрыт
   лишь 2026-08-02 — см. §6.
7. Дальше — этапы C и D по v4, с оговоркой A5 и с `structuredContent` как
   consumer-first изменением (C4).

## 5. Что остаётся вне плана

Ни один из документов этого не меняет, и это правильно:

- ротация четырёх засвеченных credentials до первых настоящих респондентов;
- разделение staging/production aliases и env;
- продуктовый backlog из `docs/product-behaviour-backlog.md`.

План рефакторинга не должен их поглощать и не должен ими блокироваться.

## 6. Статус реализации v3 на 2026-08-02

Аудит начинался как статическая сверка `origin/main` @ `ae3c3c4` с roadmap и
Definition of Done документа v3. Всё, что он нашёл открытым и что можно было
закрыть сразу, сделано; раздел переписан под состояние `origin/main` @
`956daf5`. Ниже «закрыто» означает, что работа написана и проверена, а не что
она влита: состояние веток живёт ровно в одном месте — в таблице «Чем закрыто» в
конце раздела.

Раздел правился дважды, и оба раза стоит оставить на виду. Первый раз — потому
что утверждение про этап 4 не подтвердилось при чтении кода вплотную (см. этап
4). Второй раз — вот этот проход, после merge.

Порядок работ шёл по v4, поэтому «не сделано» ниже означает «до этого этапа v3
не дошли», а не срыв. Исключение — три P1-дефекта, которые сама
последовательность обязана была закрыть и которые её пережили.

| Этап v3 | Статус |
| --- | --- |
| 0. Regression Safety Net | В основном выполнен; направление callback закрыто после аудита |
| 1. Correctness и reliability | 6 пунктов из 6 |
| 2. Contract Registry | Capabilities выполнены, strategy/adapter — нет |
| 3. Canonical internal models | Не начат |
| 4. Application layer и ports | Частично |
| 5. Presentation и hardening | Частично |

### Этап 0

Есть: characterization-покрытие расчётов, общий golden corpus, прогоняемый
обоими рантаймами, PostgreSQL concurrency suite на настоящей базе,
детерминированный Core → AI → callback E2E и обязательный CI-gate с postgres
service.

Аудит нашёл здесь дыру, из-за которой сеть три дня не ловила разошедшееся
правило: `golden_corpus.json` покрывал только направление input (Core → AI), по
одному positive и negative payload на версию, а направления callback в нём не
было вовсе. Ни один общий случай не просил оба рантайма вынести вердикт по
одному и тому же Stone Map, поэтому Hebrew-only дрейф жил при полностью зелёных
прогонах.

Закрыто после аудита: `contracts/fixtures/hebrew_text_corpus.json` покрывает
одно семантическое правило в обоих рантаймах, а `callback_corpus.json` — само
направление callback: шесть принимаемых payload'ов `1.0`–`6.0` и пятнадцать
отказов по десяти именованным правилам. Отвергаемый случай записан как мутация
принимаемого payload'а, а не его копия, и каждый называет правило, которое его
отвергает, — совпадения одного вердикта мало, иначе правило, реализованное
только одной стороной, выглядит покрытым. Заодно у сервиса впервые появился
валидатор собственного исходящего payload'а (`stone_map_refusal`); в pipeline он
не подключён, это отдельный слайс.

Нет: contract-test suite для адаптеров `AnalyticsSource` невозможен, пока нет
самого порта. CI execution model §9.4 сведена к одному job: nightly и отдельного
real-provider smoke по расписанию нет. Mutation testing есть, но пилотом —
opt-in и неблокирующий Stryker по одному файлу `src/lib/ai-contract.ts` плюс
boundary-тесты к нему; это первый шаг к «сеть ловит регрессии, а не только
компиляцию», а не покрытие этапа.

### Этап 1

Есть: capability-driven `backgroundContext` для v5, unique constraints на
`(roundId, anonymousTokenHash)` и `(responseId, questionId)`, `AiAnalysisRun`
со state machine, lease и heartbeat, идемпотентный callback, polling worker в
`lifespan`. Legacy webhook с `BackgroundTasks` сохранён намеренно как rollback
boundary.

Пункт 6, dormant auth bypass, пережил всю последовательность: ветка `repository`
в `authenticateCredentials` возвращала `ok: true` после проверки membership и
без единого обращения к паролю. Путь удалён вместе с параметром, сигнатура
сужена до `(email, password)`. Manager не носит credential вообще — перевод
identity на Argon2 или managed IdP остаётся этапом E и в этапе 1 не считается.

### Этап 2

Есть: общий манифест `contracts/capabilities.json` c именованными
capabilities, загружаемый обоими рантаймами; producer-версия в одном месте с
fail-closed на неизвестном значении; MCP route, callback route и Python parser
ветвятся по capabilities; fitness-функция на литералы версий в обоих языках.

Нет: интерфейса `AiContractDefinition` из §4.2 с `decodeAnalyticsInput` и
`encodeStoneMap`, а также отдельных адаптеров `versions/vN`. Валидаторы
`isValidV2Stone`…`isValidV6Stone` лежат вручную в одном файле `ai-contract.ts`,
поэтому критерий расширяемости из §3.2 не достигнут: v6 добавлялся правкой
существующих валидаторов, а не одним адаптером.

Закрыто после аудита: allowlist fitness-функции разрешал литералы версий в
`src/lib/services/analytics.service.ts`, то есть в доменном сервисе, тогда как
DoD §12.2 допускает их только внутри contract package, схем и тестов. Литералы
`'2.0'` ушли за именованную константу, allowlist сокращён до contract package.

### Этап 3

Не начат. Доменный расчёт сам формирует wire-форму
(`if (getCapabilities(producedVersion).supportsScoreDistribution)`), то есть
находится на среднем варианте из §3.2, а не на целевом
`contract.encodeAnalyticsInput(canonical)`. `CanonicalRoundAnalytics`,
`CanonicalAnalysisInput`, encoder и output adapter отсутствуют в обоих
рантаймах; pipeline по-прежнему получает версию как управляющий параметр, хотя
ветвление внутри него идёт через capabilities.

### Этап 4

Есть: `IAiAnalysisRunRepository` выделен из `IRoundRepository`; двойной разбор
JSON в MCP-клиенте закрыт через `structuredContent` и `outputSchema`;
`USE_MOCK_MCP` фейлится вне development, то есть production-fallback на mock
запрещён и без самого порта.

Нет: `AiInsightsRepository` (AI-результаты остались на `IRoundRepository`),
тонких routes (callback route — 427 строк оркестрации), composition root вместо
`getRepositories()`, constructor injection в Python вместо глобальных
`mcp_client_manager` и `analytics_graph`, портов `AnalyticsSource`,
`ResultSink`, `TextGenerator`, `JobStore` — ни одного.

Адресный safety repair из §6.4 был сделан наполовину, и первая версия этого
раздела описывала его неверно. Выборочный replay по измерениям на `ae3c3c4`
уже существовал: `ReplayPlan` в `node_support.py` вместе с
`retry_interpretation_dimensions`, `retry_recommendation_dimensions` и
`retry_overall_summary` перезаписывал только отвергнутые части раунда, и это
покрыто `tests/test_replay_targets.py`. Утверждение «цикл повторяет весь
pipeline до трёх раз» было ошибкой аудита. Не хватало ровно одного: critique не
доходил до prompt — `safety_feedback` записывался и не читался никем, поэтому
отвергнутое измерение переспрашивалось байт-в-байт тем же prompt на более
дорогой модели.

Закрыто после аудита: каждый отказ валидатора кодируется, и код превращается в
одну ивритскую строку, которую несёт repair-prompt. Английское предложение
валидатора осталось строкой лога — отдавать его модели значит поставить
операторский текст в шаг от ивритской копии для директора. Три кода в таблицу
намеренно не попали: `provenance_invalid` и `unavailable_not_empty` описывают
собственную бухгалтерию сервиса, `v6_intervention_count` — каталог; любой из них
просил бы модель починить шаг, которого она не делала. Выборочный replay не
менялся.

### Этап 5

Есть: observability джобов почти по всему списку §12.6 и CHECK-констрейнты с
индексами для `ai_analysis_runs`; UI фактически не знает версий контракта, хотя
именованного стабильного DTO нет.

Нет: `DashboardInsightsDto` как явного контракта представления, выноса
production-типов из `demo-data.ts` (их импортируют 17 файлов), генерации
OpenAPI из одного источника (по-прежнему два редактируемых артефакта с
integrity-тестом), enum/CHECK-констрейнтов на остальных таблицах и перевода
identity на Argon2 или managed IdP — пароль всё ещё хешируется SHA-256 со
статическим перцем.

### Дефекты §8

| Дефект | Статус |
| --- | --- |
| P0 `backgroundContext` теряется для v5 | Исправлен |
| P0 `BackgroundTasks` после 202 | Исправлен; legacy webhook оставлен как rollback boundary |
| P0 один timestamp для job и result | Исправлен |
| P0 check-then-create submission | Исправлен |
| P1 MCP double JSON parsing | Исправлен |
| P1 TS/Python Hebrew-only drift | Пережил последовательность; закрыт 2026-08-02 |
| P1 dormant DB-auth password bypass | Пережил последовательность; закрыт 2026-08-02 |
| P1 safety retry без critique | Пережил последовательность; закрыт 2026-08-02 |

Про Hebrew-only drift стоит сказать отдельно: он не просто не был закрыт, а
успел разойтись сильнее. Python ужесточил правило 2026-07-30, Core остался на
«запрещена только латиница», и до 2026-08-02 Core принимал кириллический или
арабский текст, который сам генерирующий сервис отверг бы. Общий corpus этого
не ловил, потому что не покрывал направление callback, — и это единственный из
трёх дефектов, для которого чинить пришлось не только правило, но и сеть.

### Чем закрыто

Единственное место в разделе, где говорится о состоянии веток. Всё ниже — в
`origin/main` @ `956daf5`:

| Коммит | Что закрывает |
| --- | --- |
| `a6599d3` | dormant auth bypass: параметр `repository` и его ветка удалены, регрессия «manager record — не credential» |
| `48d6f5d` | Hebrew-only parity: правило Core приведено к правилу Python, добавлен общий `hebrew_text_corpus.json` и регрессии на уровне callback |
| `1bca033` | version-literal allowlist: литералы убраны из `analytics.service.ts`, allowlist сокращён до contract package |
| `f86acf8` | safety repair: отказы валидатора кодируются и доходят до prompt одной ивритской строкой |
| `6d42f4c`, `8debfc7` | mutation testing pilot по `src/lib/ai-contract.ts` |

Не влито на момент правки: `test/callback-corpus-parity` (`fa0bd1e`) —
направление callback в общем корпусе и `stone_map_refusal` на стороне сервиса;
и ветка, несущая сам этот раздел. Порядок: сначала первая, потом вторая.

Остальное из списков «Нет» выше — открытая работа: этап 3 целиком, порты и
composition root этапа 4, DTO представления и identity этапа 5.
