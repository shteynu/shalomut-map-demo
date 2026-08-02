# Dynamic Questionnaire AI Contract

## Статус

Продуктовое направление утверждено 2026-07-26. Schema review подтвердил
несовместимость с exact-24 contract `2.0`, поэтому новая версия зафиксирована
как breaking contract `3.0` в `contracts/ai-analytics-v3.json`. Contracts
`1.0` и `2.0` остаются immutable. Реализация `3.0` завершена, проверена,
зафиксирована в ordered commits `f1cd906`, `6833cb2` и `3e3f43f` и развёрнута
consumer-first 2026-07-26. Это историческая основа dynamic-questionnaire:
текущий deployed Core формирует `6.0`, а rollback-safe producer value — `5.0`.
Текущий version status находится в `docs/ai-contract-version-matrix.md`.

## Цель

Менеджер может использовать в каждом раунде собственные вопросы о благополучии
команды: с другими ID, формулировками и количеством. AI анализирует точные
вопросы этого раунда и их privacy-safe aggregates, но возвращает стабильный
Dashboard result: восемь canonical stones со status-aware Hebrew insights,
metrics, actions, summary и provenance.

Исходные 24 вопроса остаются default/legacy template. Они не являются
allowlist для новых раундов и не должны молча подставляться вместо фактического
опросника.

## Продуктовый контракт

- Восемь wellbeing dimensions остаются фиксированной Dashboard taxonomy.
- Каждый enabled анализируемый вопрос имеет непустые stable ID и text и явно
  привязан ровно к одной canonical dimension.
- Количество вопросов и количество metrics в dimension динамические.
- Перед активацией раунда questionnaire должен покрывать все восемь dimensions
  хотя бы одним enabled вопросом. Неполное покрытие отклоняется понятной
  validation error, а не компенсируется AI-догадкой.
- `SurveyRound.surveyDefinition` хранит exact snapshot. После принятия первого
  ответа смысл существующих ID/text/dimension нельзя менять; новая формулировка
  требует нового round или явной revision до сбора ответов.
- Вопросы остаются в продуктовой области teacher/staff wellbeing. Явный
  `dimensionId` является проверяемой domain boundary; general-purpose survey
  analysis вне восьми dimensions не входит в этот контракт.

## Input contract `3.0`

Unlocked MCP payload содержит:

- `contractVersion: "3.0"`;
- `roundId` и внутренний `organizationId` без respondent identity;
- deterministic `surveyDefinitionHash`;
- exact eight Core-owned `dimensionScores`;
- dynamic `questionAggregates`, где каждый элемент содержит
  `questionId`, `dimensionId`, exact persisted `questionText`,
  `averageScore` и `responseCount`;
- `calculatedAt`, `totalResponses`, `privacyThreshold`, `isLocked`.

`surveyDefinitionHash` имеет вид `sha256:<64 lowercase hex>`. Core строит
semantic projection всех enabled анализируемых вопросов как compact JSON array
объектов с ключами `questionId`, `dimensionId`, `questionText` в этом порядке,
сортирует элементы по `questionId` по Unicode code point, кодирует UTF-8 без
ASCII escaping и не нормализует whitespace при hashing. Python пересчитывает
тот же hash из unlocked aggregates. Такой hash идентифицирует exact AI-visible
snapshot без новой DB migration и не включает respondent data.

Новая версия валидирует структуру, уникальность ID и map key, supported
dimension, полное покрытие восьми dimensions, числовые границы, snapshot hash,
score/status consistency и privacy counts. Она не сравнивает ID или text с
`src/lib/shalomut-source.ts` или `contracts/ai-analytics-v2.json`.

Core остаётся владельцем score/status facts. Dimension score рассчитывается
только из полного privacy-safe набора фактических вопросов этой dimension. AI
не меняет score, status или dimension mapping.

## Privacy и неполные данные

- Ни один respondent row, answer, token, identity или response-level timestamp
  не пересекает MCP/AI boundary.
- Unlocked analysis разрешён только когда `totalResponses` и
  `responseCount` каждого enabled анализируемого вопроса не ниже
  `privacyThreshold`.
- Partial unlocked analysis запрещён: вопрос ниже threshold не отбрасывается
  из иначе успешного результата, а блокирует весь detailed result.
- При недостигнутом threshold результат целиком `locked_error` с пустыми
  detailed maps/stones.
- Provider не вызывается для locked result.

## AI semantics

- Prompt получает exact question text и aggregate конкретного раунда.
- Interpretation обязана опираться только на same-dimension aggregates.
- Deterministic fallback выбирает фактический strongest/weakest question и
  использует его exact text; canonical/default text запрещён как fallback.
- LLM/retry/fallback provenance содержит exact dynamic
  `sourceQuestionIds` и `surveyDefinitionHash`.
- Provider-invalid, truncated, incomplete, non-Hebrew или
  status-inconsistent output по-прежнему отклоняется.
- Intervention lookup остаётся exact dimension+status без cross-status
  fallback.

## Output contract для Dashboard

Форма результата сохраняет текущую семантику Stone Map:

- exactly eight stones keyed by canonical dimension;
- Core-owned `score` и `status`;
- Hebrew `psychologicalInterpretation`;
- dynamic metrics всех safe вопросов этой dimension, с exact ID/text,
  aggregate score и response count;
- status-scoped interventions;
- generation provenance;
- `overallPsychologicalSummary` ровно один раз на overview;
- green UX: `חוזקה לשימור` и `פעולות לשימור`, без improvement goals.

Persisted `1.0` и `2.0` payloads остаются читаемыми существующим Dashboard.

## Consumer-first rollout

1. Опубликовать immutable manifest новой версии, не меняя `1.0`/`2.0`.
2. Сначала развернуть Python consumer, принимающий `1.0`, `2.0` и dynamic
   version, при этом Core продолжает отправлять `2.0`.
3. Обновить Core callback/TypeScript validators и Dashboard reader на все три
   версии.
4. Только после consumer compatibility переключить Core aggregation/MCP на
   exact persisted round questionnaire.
5. Сохранить rollback path на producer `2.0`.

Историческая реализация была разделена на Python consumer `f1cd906`, Core
consumers `6833cb2` и producer/survey UX `3e3f43f` и развёрнута именно в этом
порядке. Тот же consumer-first порядок обязателен для следующей версии; эти
старые commits не являются текущим deployment checklist.

## Acceptance criteria

- Два раунда с разными question IDs, text и counts проходят полный local
  Core → MCP → Python → callback → Dashboard путь.
- Ни один custom/supplemental вопрос не теряется и не заменяется default text.
- Custom question с ID, отсутствующим в canonical 24, принимается при валидной
  dimension mapping и safe aggregate.
- Изменённый текст при прежнем ID до начала сбора доходит до prompt, fallback,
  persisted metrics и UI без canonical подмены.
- Output обоих раундов содержит ровно восемь stones, но variable metric counts
  соответствуют их фактическим questionnaire snapshots.
- Prompt/fallback/provenance используют только source questions своей
  dimension и exact snapshot revision/hash.
- Missing dimension coverage отклоняет activation; missing safe coverage в
  analytics возвращает locked/validation result без fabricated stones.
- Below-threshold aggregate блокирует весь detailed result и не появляется в
  MCP, AI result или UI.
- Hebrew/completeness/status validation, bounded retry, deterministic fallback,
  exact-status interventions, green semantics и single summary остаются GREEN.
- Legacy `1.0`/`2.0` validation и persisted Dashboard rendering остаются GREEN.
- Empty persistence остаётся пустой; round и organization isolation сохранены.

## Verification

- RED-first TypeScript tests для survey snapshot, aggregation, MCP, callback и
  Dashboard variable metrics.
- RED-first Python schema/provider/workflow/provenance tests с минимум двумя
  различными questionnaire fixtures.
- OpenAPI JSON/YAML parse и synchronization tests.
- Full `npm test`, full Python pytest, dependency-light Python suite, lint и
  build.
- Local real-runtime boundary без внешних writes.
- Local Playwright для двух разных questionnaires, locked privacy и `/setup/`.
- `git diff --check`.

## Non-goals и stop-lines

- Не менять taxonomy восьми dimensions, scoring thresholds или Dashboard
  visual language в этом slice.
- Не превращать сервис в general-purpose survey analyzer вне продуктовой
  wellbeing domain.
- Не запускать real webhook/callback, migration, production/staging data write,
  deploy, alias или secret/provider mutation без отдельного bounded approval.
- Остановиться за продуктовым решением, если реализация требует dimension без
  safe evidence, automatic cross-dimension classification вместо persisted
  mapping или изменения privacy semantics.
