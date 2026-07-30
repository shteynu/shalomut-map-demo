# Ревью и актуализация плана архитектурного рефакторинга

## Metadata

- Branch: `docs/update-wellbeing-refactoring-plan`
- Base branch: `main`
- Base commit: `cb8bed3`
- Current HEAD: `cb8bed3`
- Status: закрыто; работа продолжается на ветках PR 1, PR 2 и PR 2.5
- Last updated: 2026-07-30
- Last agent/tool: Claude Code (Opus 5)

## Objective

Сверить два внешних плана архитектурного рефакторинга (v3 и v4) с фактическим
кодом на `cb8bed3`, выбрать рабочую версию, зафиксировать правки и дополнения и
получить исполнимый порядок работ для следующей серии PR.

## User-visible outcome

Прямого — нет. Это подготовка к последующим изменениям кода, у которых
пользовательский эффект будет (в первую очередь: контракт `5.0` перестанет
терять `backgroundContext` в промпте).

## Context

- Входные PDF лежат вне репозитория: `~/Downloads/wellbeing_architecture_refactoring_plan_ru_v3.pdf`
  и `..._v4.pdf`. В репозиторий не копировались.
- v3 сделан на `01fd852`, v4 — на `cb8bed3`. Между ними 14 коммитов.
- Локальный `main` стоит на `f3dbce4`, на два документационных коммита позади
  `origin/main`; текущий HEAD ветки равен `cb8bed3`.

## Scope

- Ревью обоих планов против кода.
- Документ ревью в `docs/wellbeing-refactoring-plan-v4-review.md`.

## Non-goals

- Никакой реализации самого рефакторинга в этой ветке.
- Не трогать продуктовый backlog, credentials, aliases и deployment.

## Acceptance criteria

- Каждое фактическое утверждение плана, вошедшее в ревью, подкреплено ссылкой
  `файл:строка` на реальный код.
- Названы правки к плану и то, чего в нём нет.
- Есть один порядок работ, по которому можно начинать PR 1.

## Relevant repository instructions

- `AGENTS.md`, `.agents/skills/shalomut-tracker/SKILL.md`,
  `.agents/skills/shalomut-map/SKILL.md`.

## Relevant architecture and contracts

- `contracts/ai-analytics-v1.json` … `v5.json`; `src/lib/ai-contract.ts` (847 строк).
- `ai-analytics-service/src/schemas/mcp_types.py`, `src/contracts.py`.
- `prisma/schema.prisma`, `prisma/migrations/` (`0_init` + 4).
- `.github/workflows/deploy-vercel.yml` — единственный PR-gate, `npm run verify`.

## Decisions made

- Работаем по **v4**; v3 остаётся источником четырёх разделов, которые v4
  потерял: rollback-таблица, CI execution model, список метрик, детализация
  typed pipeline state.
- Порядок первых поставок: baseline → PR 1 (v5 context) → PR 2 (DB idempotency
  + Postgres в CI) → PR 2.5 (fail-closed producer version) → PR 3 (durable jobs).
- **Решения владельца, 2026-07-30** (все три — по рекомендации ревью):
  1. Порядок работ из §4 ревью принят, включая отдельный PR 2.5.
  2. `anonymousTokenHash` остаётся необязательным; в PR 2 идёт обычный
     `@@unique([roundId, anonymousTokenHash])`. Обязательным токен не делаем:
     `scripts/seed-local.ts:113` создаёт ответы без него, а сам токен —
     UUID на одну сессию заполнения, не идентификация респондента.
  3. Health/capability endpoint заводим в составе PR 2.5; он отдаёт версию
     контракта и список поддерживаемых версий, но не значения переменных.

## Assumptions

- Продюсерский контракт в Vercel действительно `5.0` (по `PROGRESS.md:123` и
  `docs/e2-step3-contract-version-rollout.md:14`); я это по факту в Vercel не
  проверял, только по документации репозитория.

## Completed

- Извлечён текст обоих PDF, прочитаны целиком.
- Проверены по коду все ключевые утверждения v4 (таблица в §1 ревью) — все
  подтвердились, включая номера строк `mcp_types.py:357-360`.
- Написан `docs/wellbeing-refactoring-plan-v4-review.md`: 8 правок (C1–C8),
  6 дополнений (A1–A6), порядок работ.
- Получены и записаны три решения владельца (см. Decisions made).
- Переснят baseline пункта A6: `npm run verify` прошёл целиком.

## In progress

Ничего.

## Remaining

- PR 1 (`fix(ai-contract): preserve v5 background context`) в отдельной ветке.
- Затем PR 2, PR 2.5, PR 3 по порядку из §4 ревью.

## Changed files

- `docs/wellbeing-refactoring-plan-v4-review.md` — новый, untracked.
- `docs/agent-tasks/active/docs--update-wellbeing-refactoring-plan.md` — этот
  файл, новый, untracked.

## Verification evidence

### Passed

- `npm run verify` на `cb8bed3`, exit 0. Внутри: `next typegen && tsc --noEmit`,
  274/274 TypeScript-теста (4 suites), ESLint, production build (40/40 static
  pages) и 269/269 Python-тестов через `.venv/bin/python -m pytest`.
- Это закрывает пункт A6 ревью: числа 274/269 больше не унаследованы из
  `docs/shalomut-tracker-handoff.md:8`, а получены в этой сессии.

### Failed

Нет.

### Blocked or not run

- Исполняемый probe v4 (`RoundAnalyticsResult.from_dict` на реальном 5.0
  payload) не повторялся. Дефект подтверждён чтением
  `ai-analytics-service/src/schemas/mcp_types.py:357-360`; red-тест — часть PR 1.
- Продюсерская версия `5.0` в Vercel не проверялась в самом Vercel, только по
  `PROGRESS.md:123` и `docs/e2-step3-contract-version-rollout.md:14`.

### Environment

Локальный worktree, чтение кода и Git, плюс локальный `npm run verify`. К БД,
Vercel и провайдерам не обращался.

### Residual risk

Ревью основано на статическом чтении. Утверждение «v5 теряет backgroundContext»
подтверждено кодом (`mcp_types.py:357-360`), но исполняемый probe из v4 я не
повторял.

## Failed approaches

- `Read` по PDF не работает: нет `pdftoppm`/poppler. Текст извлечён через
  `pypdf` в scratchpad.

## Known risks

- PR 2 без Postgres в CI (правка C6) даст constraint с тестами, которые в CI не
  выполняются.
- PR 3 конфликтует с пунктами 5–6 продуктового backlog, если делать
  одновременно.

## Approval gates

Действующие gates из `docs/shalomut-tracker-handoff.md` не менялись. Ничего не
коммичено и не запушено.

## Questions requiring an owner decision

Открытых нет: все три закрыты 2026-07-30, см. Decisions made.

## Next concrete step

Ревью закрыто, PR 1, 2 и 2.5 выполнены на своих ветках. Следующий шаг —
**PR 3, durable AI jobs**, и он не принадлежит этой ветке.

Замещающему агенту: начать с `docs/shalomut-tracker-handoff.md`, раздел
«Архитектурный рефакторинг: четыре ветки на руках» — там перечислены все ветки,
их HEAD, состояние проверок и открытые вопросы. Оттуда идти в
`docs/wellbeing-refactoring-plan-v4-review.md` §4 за порядком работ, затем
завести ветку под PR 3 от `cb8bed3` и создать
`docs/agent-tasks/active/feat--durable-ai-jobs.md` из
`docs/agent-tasks/TEMPLATE.md`.
