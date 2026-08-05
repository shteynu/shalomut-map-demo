---
name: shalomut-verification
description: Проверяй изменения и runtime-поведение проекта shalomut-map-demo. Используй, когда нужно доказать корректность bugfix или feature, выбрать tests по diff, проверить готовность к merge, выполнить lint/build/Prisma/Python/OpenAPI/AI E2E/browser smoke, проверить deployed environment или зафиксировать verification evidence без неподтверждённых claims.
---

# Shalomut Verification

## Назначение

Выбирай минимальный набор проверок, который доказывает изменённое поведение, а
затем расширяй его пропорционально риску. Не запускай полный suite механически
для docs-only изменений и не ограничивайся одним targeted test для изменений
privacy, auth, persistence, contracts или deployment.

## Preflight

1. Определи корень репозитория через `git rev-parse --show-toplevel`.
2. Прочитай `AGENTS.md`, `package.json`, релевантный source и ближайшие tests.
3. Проверь `git status --short`, staged/unstaged diff и список изменённых файлов.
4. Определи затронутые слои: UI, API, services, persistence, Prisma, survey
   methodology, OpenAPI, AI contract, Python service, auth/security или deploy.
5. Зафиксируй контекст evidence: local, test или deployed. `test` обозначает
   изолированную проверку, а не третье продуктовое окружение. Не
   смешивай evidence из разных environments без явного обозначения.

## Матрица выбора

| Изменённая область | Обязательный минимум |
| --- | --- |
| Только Markdown, instructions или skills | Frontmatter/links, `git diff --check`, релевантная structural validation |
| Mutation config или tests для мутируемых файлов (`src/lib/ai-contract.ts`, `src/lib/scoring-bands.ts`) | Stryker dry run; полный mutation run, если задача меняет mutation evidence или просит оценить test strength |
| `src/components`, page TSX, CSS | Targeted tests, `npm run lint`, `npm run build`; browser smoke для user-visible flow |
| `src/app/api`, services, hooks, utilities | Ближайшие API/unit tests, затем `npm test` и `npm run build` |
| Repositories или server guards | Repository/API regression tests, `npm test`, `npm run lint`, `npm run build` |
| `prisma/schema.prisma` или migrations | `npx prisma validate`, `npx prisma generate`, repository tests; status/migration только по правилам ниже |
| Survey source, scoring или privacy | Survey-definition/math/API tests, `npm test`, respondent и locked/ready browser states |
| `docs/openapi.yaml` или API contract | `npm run openapi:generate`, OpenAPI integrity tests, сверка route/schema changes с реальными handlers |
| Versioned AI manifest, `contracts/capabilities.json` или AI TypeScript | Contract/registry/client/view-model tests, `npm test`, Python tests и local boundary E2E |
| `ai-analytics-service` | `.venv/bin/python -m pytest` из `ai-analytics-service` — полный набор, включая contract suites |
| Auth, secrets или authorization | Unauthorized/missing-secret/organization-isolation tests и security-focused diff review |
| Deploy, env или runtime config | Полный local suite, deployed source/build/health/status/logs и безопасный read-only browser smoke |

Если diff затрагивает несколько строк таблицы, объедини проверки и устрани
дубликаты.

## Команды проекта

### TypeScript и Next.js

- Запускай ближайший test напрямую через `npx tsx --test <test-file>`.
- Запускай полный TypeScript suite через `npm test`. `tsx` стирает типы и не
  проверяет их, поэтому зелёный `npm test` ничего не говорит о типах.
- Проверяй типы всего проекта, включая tests, через `npm run typecheck`
  (`next typegen && tsc --noEmit`). Это обязательный минимум для любого
  изменения `.ts`/`.tsx`: `npm run build` типизирует только граф приложения и
  не видит ошибки в `__tests__`, а `npm run lint` типы не проверяет вообще.
- Проверяй lint через `npm run lint`.
- Проверяй production compilation и App Router boundaries через
  `npm run build`.

### Mutation testing

- Текущий mutation scope — opt-in pilot для `src/lib/ai-contract.ts` и
  `src/lib/scoring-bands.ts`, куда переехало правило валидатора «score и status
  обязаны сходиться»; конфигурация находится в `stryker.config.mjs`.
- Если продуктовое правило уезжает из мутируемого файла в новый модуль, веди
  `mutate` за ним в том же изменении. Рефакторинг не должен молча выносить
  правило из измерения.
- `tap.testFiles` должен содержать каждый test-файл, предметом которого является
  мутируемый файл, включая тесты вне `src/lib/__tests__`. Пропущенный файл не
  занижает score честно: он показывает как survivor мутант, который реальный
  тест убил бы. Так до 2026-08-03 правило Hebrew-only выглядело непокрытым при
  существующем `hebrew-only-corpus.test.ts`.
- Список больше не ведётся вручную: `npm run lint:mutation-config` выводит его
  заново из репозитория и падает в обе стороны — на пропущенном файле и на
  оставшемся в списке файле, который больше ничего не вызывает. Проверка входит
  в `verify:core`, поэтому CI выполняет её на каждом pull request. Не правь
  `tap.testFiles`, не прогнав её.
- Проверяй wiring без полного прогона через
  `npm run test:mutation:ai-contract -- --dryRunOnly`. То же самое CI выполняет
  отдельным шагом после `npm run verify`.
- Полный `npm run test:mutation:ai-contract` запускай, когда изменён сам
  validator, mutation config/набор тестов либо пользователь просит доказать
  силу тестов. Он не входит в `npm run verify` и не является blocking CI gate:
  score двигают перенос функции между файлами и появление test-файла в списке,
  то есть изменения, не относящиеся к силе тестов.
- Не обещай repository-wide mutation coverage. Разделяй killed, survived,
  no-coverage и runtime-error mutants; HTML/JSON reports под
  `reports/mutation/` являются локальным ignored evidence.

`npm run dev` запускает runtime, но сам по себе не является evidence.

### Prisma и persistence

- Проверяй schema через `npx prisma validate`.
- Проверяй client generation через `npx prisma generate`.
- Запускай repository и API tests после schema/repository changes.
- Перед `npm run db:status`, `db:migrate:*`, `db:clear` и другими writes
  проверяй, на какой database environment они уйдут. Данные расходные, поэтому
  backup/rollback boundary и отдельное подтверждение не требуются — важна
  только правильность target.

### Python и AI boundary

- Запускай полный suite из `ai-analytics-service`: `.venv/bin/python -m pytest`.
  Это единственная команда, покрывающая и contract suites в `tests/`. Именно
  интерпретатор из `.venv`, а не `python3`: зависимости стоят только в venv, а
  оболочка агента не сохраняет `source .venv/bin/activate` между вызовами, так
  что `python3 -m pytest` отвечает `No module named pytest`. Если `.venv` нет,
  создай его по `docs/local-environment.md`.
- `run_tests.py` — только совместимость: он делегирует в ту же команду. Не
  ссылайся на него как на отдельное evidence.
- После contract, MCP, webhook или callback changes запускай соответствующие
  TypeScript tests и local Next.js → Python → callback boundary test через
  `npm test`.
- Не считай mock MCP доказательством реального deployed transport.

### OpenAPI

- `docs/openapi.yaml` — единственный редактируемый источник. После правки
  запускай `npm run openapi:generate` и коммить сгенерированный
  `public/openapi.json`. Ручная правка JSON — не изменение, а drift.
- Запускай `src/app/api/__tests__/openapi.test.ts` после route/schema changes.
  Он включает `npm run openapi:check`, который сравнивает весь документ.
- Проверяй совпадение status codes, authentication requirements, payload
  schemas и versioned contract semantics с реальными handlers. Это то, чего
  генератор проверить не может: он гарантирует идентичность артефактов, а не
  их правдивость.

## Browser и runtime scenarios

Проверяй только релевантные сценарию states:

- пустая persistence: нет выдуманной школы или раунда;
- manager onboarding и round setup;
- respondent flow по реальному share code;
- below-threshold privacy lock;
- ready analytics и восемь canonical dimensions;
- loading, not-found, upstream error и unauthorized;
- RTL reading order, keyboard access, responsive layout и reduced motion для UI
  changes.

Для local UI используй `playwright` или `playwright-interactive`, если они
доступны. Для deployed environment используй read-only smoke по умолчанию. Не
создавай данные, не вызывай webhook и не меняй alias без разрешения,
соответствующего environment.

## Обработка результатов

- Считай проверку прошедшей только при фактическом exit code `0` или
  подтверждённом ожидаемом runtime результате.
- Разделяй `passed`, `failed`, `blocked` и `not run`.
- При failure сохрани точную команду и полезный фрагмент ошибки; не маскируй
  проблему fallback-успехом.
- Не исправляй unrelated failure без расширения scope. Определи, существовал ли
  он до текущего diff, если это можно проверить безопасно.
- После исправления повтори сначала упавшую проверку, затем затронутый suite.
- Если diff затрагивает privacy, authentication, authorization, contracts,
  deployment или границу Core/AI и остаточный риск требует независимого review,
  верни tracker короткий сигнал `Independent review recommended.`; итоговую
  model recommendation формирует tracker.

## Формат evidence

Перед завершением сообщи:

```text
Verification:
- Passed: <command or smoke and result>
- Failed: <command and concise cause>
- Blocked/not run: <check and reason>
- Environment: <local/test/deployed>
- Residual risk: <what remains unverified>
```

Если существует активный branch task document и готовится handoff, до передачи
обнови в нём `Verification evidence`: `Passed`, `Failed`, `Blocked or not run`,
`Environment` и `Residual risk`. Не записывай проверки, которые не выполнялись,
и не копируй обычное task evidence в `PROGRESS.md` или global operational
handoff, если оно не меняет project-wide или deployed state.
