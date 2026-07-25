---
name: shalomut-verification
description: Проверяй изменения и runtime-поведение проекта shalomut-map-demo. Используй, когда нужно доказать корректность bugfix или feature, выбрать tests по diff, проверить готовность к merge, выполнить lint/build/Prisma/Python/OpenAPI/AI E2E/browser smoke, проверить preview или зафиксировать verification evidence без неподтверждённых claims.
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
5. Зафиксируй environment проверки: local, test, preview или staging. Не
   смешивай evidence из разных environments без явного обозначения.

## Матрица выбора

| Изменённая область | Обязательный минимум |
| --- | --- |
| Только Markdown, instructions или skills | Frontmatter/links, `git diff --check`, релевантная structural validation |
| `src/components`, page TSX, CSS | Targeted tests, `npm run lint`, `npm run build`; browser smoke для user-visible flow |
| `src/app/api`, services, hooks, utilities | Ближайшие API/unit tests, затем `npm test` и `npm run build` |
| Repositories или server guards | Repository/API regression tests, `npm test`, `npm run lint`, `npm run build` |
| `prisma/schema.prisma` или migrations | `npx prisma validate`, `npx prisma generate`, repository tests; status/migration только по правилам ниже |
| Survey source, scoring или privacy | Survey-definition/math/API tests, `npm test`, respondent и locked/ready browser states |
| OpenAPI JSON/YAML или API contract | OpenAPI integrity tests, parse обеих specs, проверить синхронность route/schema changes |
| `contracts/ai-analytics-v1.json` или AI TypeScript | Contract/client/view-model tests, `npm test`, Python tests и local boundary E2E |
| `ai-analytics-service` | `python3 ai-analytics-service/run_tests.py`; full pytest при доступных dependencies |
| Auth, secrets или authorization | Unauthorized/missing-secret/organization-isolation tests и security-focused diff review |
| Deploy, env или runtime config | Полный local suite, preview build/status/logs и безопасный browser smoke |

Если diff затрагивает несколько строк таблицы, объедини проверки и устрани
дубликаты.

## Команды проекта

### TypeScript и Next.js

- Запускай ближайший test напрямую через `npx tsx --test <test-file>`.
- Запускай полный TypeScript suite через `npm test`.
- Проверяй lint через `npm run lint`.
- Проверяй production compilation и App Router boundaries через
  `npm run build`.

`npm run dev` запускает runtime, но сам по себе не является evidence.

### Prisma и persistence

- Проверяй schema через `npx prisma validate`.
- Проверяй client generation через `npx prisma generate`.
- Запускай repository и API tests после schema/repository changes.
- Выполняй `npm run db:status` только после подтверждения точного database
  environment и target.
- Не запускай `db:migrate:*`, `db:clear` или другие writes без явного
  ограниченного подтверждения, backup/rollback boundary и проверки target.

### Python и AI boundary

- Запускай dependency-light suite из корня:
  `python3 ai-analytics-service/run_tests.py`.
- При установленном dev environment запускай из `ai-analytics-service`:
  `python3 -m pytest`.
- После contract, MCP, webhook или callback changes запускай соответствующие
  TypeScript tests и local Next.js → Python → callback boundary test через
  `npm test`.
- Не считай mock MCP доказательством реального staging transport.

### OpenAPI

- Запускай `src/app/api/__tests__/openapi.test.ts` после route/schema changes.
- Валидируй `public/openapi.json` и `docs/openapi.yaml`.
- Проверяй совпадение status codes, authentication requirements, payload
  schemas и versioned contract semantics с реальными handlers.

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
доступны. Для preview/staging используй read-only smoke по умолчанию. Не создавай
данные, не вызывай webhook и не меняй alias без разрешения, соответствующего
environment.

## Обработка результатов

- Считай проверку прошедшей только при фактическом exit code `0` или
  подтверждённом ожидаемом runtime результате.
- Разделяй `passed`, `failed`, `blocked` и `not run`.
- При failure сохрани точную команду и полезный фрагмент ошибки; не маскируй
  проблему fallback-успехом.
- Не исправляй unrelated failure без расширения scope. Определи, существовал ли
  он до текущего diff, если это можно проверить безопасно.
- После исправления повтори сначала упавшую проверку, затем затронутый suite.

## Формат evidence

Перед завершением сообщи:

```text
Verification:
- Passed: <command or smoke and result>
- Failed: <command and concise cause>
- Blocked/not run: <check and reason>
- Environment: <local/test/preview/staging>
- Residual risk: <what remains unverified>
```

Не записывай в handoff или `PROGRESS.md` проверки, которые не выполнялись.
