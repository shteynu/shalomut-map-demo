# PR 2.5 — fail-closed на версии контракта + health endpoint

## Metadata

- Branch: `feat/fail-closed-contract-version`
- Base branch: `main`
- Base commit: `cb8bed3`
- Merged as: PR #17, squash commit `5ba62ce`
- Status: закрыто и заархивировано
- Last updated: 2026-08-01
- Last agent/tool: Claude Code (Opus 5)

## Objective

Закрыть P1 из плана v4 и правку C3 ревью: неизвестное значение
`AI_ANALYTICS_CONTRACT_VERSION` молча превращалось в `3.0`, а health/capability
endpoint, на который ссылаются оба плана, в коде отсутствовал.

## User-visible outcome

Опечатка в переменной больше не даёт тихий откат аналитики на самый старый
контракт: сборка и загрузка падают с внятным сообщением. `GET /api/health`
отвечает, какая версия реально работает и выбрана ли она конфигурацией или
унаследована по умолчанию.

## Context

- Дефект: `analytics.service.ts:33-38` на `cb8bed3` — два сравнения и `return '3.0'`.
- Правка C3 ревью: в Core нет startup, поэтому проверка ставится на module-init
  плюс сборку; отдельно отмечено, что health endpoint в коде отсутствует.

## Scope

- Резолвер и валидация версии продюсера.
- Module-init fail-closed в `analytics.service.ts`.
- `GET /api/health`.
- Тесты, OpenAPI (оба артефакта), `.env.example`.

## Non-goals

- Contract Registry и capabilities — этап C.
- Durable AI jobs — PR 3.
- Не менять значение по умолчанию и не трогать deployed конфигурацию.

## Acceptance criteria

- Неизвестное значение останавливает сборку/загрузку, а не возвращает `3.0`. ✅
- Пустое значение остаётся документированным default. ✅
- Health отвечает даже при плохой конфигурации и называет проблему. ✅
- Health не раскрывает значения переменных и состояние секретов. ✅

## Decisions made

- **Unset ≠ unknown.** Незаданная переменная остаётся документированным
  default `3.0`: это уже принятое проектом решение, его печатает баннер
  `npm run local` и описывает `.env.example`. Дефект — именно тихий откат при
  *заданном, но нераспознанном* значении, и падает теперь только он. Иначе
  правка ломала бы каждое окружение, которое переменную осознанно не ставит.
- **Резолвер вынесен из `analytics.service.ts`** в `src/lib/ai-contract-version.ts`.
  Сервис бросает на плохом значении при импорте, поэтому health, который
  обязан эту поломку *сообщать*, не может его импортировать — иначе падал бы
  вместе с ней.
- **Продюсируемые версии — только `3.0`/`4.0`/`5.0`.** `1.0` и `2.0` Core
  по-прежнему принимает на callback, но выпускать не может; разрешить их здесь
  значило бы предложить откат, который калькулятор не выполнит. Поэтому в health
  два разных списка.
- **Сообщение об ошибке не повторяет значение переменной**: оно уходит в
  публичный endpoint, а эхо произвольного содержимого переменной — это способ
  опубликовать случайно попавший туда секрет. В брошенной ошибке, которая
  остаётся в логах, значение есть.
- **Health не сообщает состояние БД, провайдера и секретов.** Endpoint,
  который говорит, задан ли секрет, подсказывает анонимному вызывающему, куда
  давить.

## Assumptions

- Значение по умолчанию `3.0` менять не нужно. Замечание: если переменная
  где-то не задана, деплой тихо производит `3.0` — это уже не молчаливый сбой,
  но и не то, что видно без запроса к health. Решение о смене default за
  владельцем.

## Completed

- `src/lib/ai-contract-version.ts`: `resolveProducedAnalyticsContractVersion`
  (не бросает), `getProducedAnalyticsContractVersion` (бросает),
  `UnsupportedProducerContractVersionError`, список продюсируемых версий
  выведен из манифестов, а не из литералов.
- `analytics.service.ts` реэкспортирует геттер и проверяет конфигурацию один
  раз при импорте.
- `src/app/api/health/route.ts` — 200 с capability, 503 при плохой конфигурации.
- Девять тестов резолвера и пять тестов endpoint.
- OpenAPI: путь и тег `Health` добавлены в `docs/openapi.yaml` и
  `public/openapi.json`; JSON синхронизирован из YAML, чтобы артефакты сошлись.
- `openapi.test.ts` требует наличия `/api/health`.
- `.env.example` описывает fail-closed поведение.

## In progress

Ничего.

## Remaining

- Push — действие владельца.
- Затем PR 3 (durable AI jobs) отдельной веткой.

## Changed files

Всё unstaged. Изменены: `.env.example`, `docs/openapi.yaml`,
`public/openapi.json`, `src/app/api/__tests__/openapi.test.ts`,
`src/lib/services/analytics.service.ts`. Новые:
`src/app/api/health/route.ts`, `src/app/api/__tests__/health.test.ts`,
`src/lib/ai-contract-version.ts`, `src/lib/__tests__/ai-contract-version.test.ts`.

Не мой контент: `next-env.d.ts` — генерируемая churn.

## Verification evidence

### Passed

- `npm run verify`, реальный exit 0 (без пайпа): typecheck, 288/288 TypeScript,
  ESLint, production build, 269/269 Python.
- `src/lib/__tests__/ai-contract-version.test.ts` — 9/9.
- `src/app/api/__tests__/health.test.ts` — 5/5.
- **Fail-closed доказан исполняемо:** `AI_ANALYTICS_CONTRACT_VERSION=6.0
  npm run build` → exit 1 с `UnsupportedProducerContractVersionError` и текстом,
  называющим переменную и допустимые значения;
  `AI_ANALYTICS_CONTRACT_VERSION=5.0 npm run build` → exit 0.

### Failed

- Первая версия не проходила typecheck: тип продюсируемой версии выводился из
  манифестов, а `version` из импортированного JSON расширяется до `string`, что
  ломало union `'3.0' | '4.0' | '5.0'` в `RoundAnalyticsV3Result`. Исправлено —
  см. Failed approaches.

### Blocked or not run

- Endpoint на деплое не проверялся: деплой — bounded approval владельца.

### Environment

Локальный worktree. БД, Vercel и провайдеры не задействованы.

### Residual risk

- Module-init проверка срабатывает при импорте `analytics.service.ts`. Модуль
  тянут routes, поэтому сборка его импортирует; путь, который его не импортирует
  вообще, проверку не выполнит. Health при этом остаётся честным, потому что
  читает конфигурацию сам.

## Failed approaches

- **Выводить тип продюсируемых версий из манифестов.**
  `(typeof PRODUCIBLE_...)[number]` давал `string`, потому что `version` в
  импортированном JSON расширяется до `string`. Это ломало присваивание в
  `analytics.service.ts:281`, где `RoundAnalyticsV3Result.contractVersion`
  требует union литералов. Тип теперь записан литералами, значения по-прежнему
  сверяются с манифестами, и расхождение роняет импорт.
- **`as NodeJS.ProcessEnv` в тестах** не проходит `tsc`: типы недостаточно
  пересекаются. Геттер принимает `Record<string, string | undefined>`.
- **Читать exit code команды через пайп.** `npm run verify 2>&1 | tail -N`
  возвращает код `tail`, а не `npm`, поэтому упавший verify выглядел успешным.
  Именно так ошибка типов дожила до ручной проверки сборки. Все прогоны в этой
  задаче перезапущены без пайпа, с записью вывода в файл.

## Known risks

- Деплой с уже выставленным неверным значением перестанет собираться. Для этого
  проекта это и есть цель, но эффект заметен сразу.

## Approval gates

Изменения слиты в `main` как PR #17; deployed переменные эта задача не меняла.

## Questions requiring an owner decision

Нет в рамках этой задачи. Документированный default `3.0` сохранён; его смена
будет отдельным контрактным решением.

## Next concrete step

Нет: задача завершена и заархивирована. Актуальная точка входа находится в
`docs/shalomut-tracker-handoff.md`.
