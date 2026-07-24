# План стабилизации AI Analytics интеграции

## Целевой результат

Школьный dashboard получает только валидированные и privacy-safe AI-инсайты,
сгенерированные внешним Python-сервисом, а полный локальный путь
`MCP → Python → callback → persistence → UI` воспроизводится без скрытых
fallback-данных.

## Текущее состояние

Локальная реализация готова и проверена. Migration применена к текущей
настроенной Supabase-цели; AI-сервис и секреты не деплоились.

## Work packet

### 1. Контракт и source of truth — Done

- Канонический manifest: `contracts/ai-analytics-v1.json`.
- Version `1.0`, ровно 8 dimension IDs, единые Hebrew labels.
- TypeScript callback и Python pipeline валидируют одну и ту же форму Stone Map.

Проверка: `src/lib/__tests__/ai-contract.test.ts`, OpenAPI schema checks,
Python pipeline tests.

### 2. Python pipeline и catalog — Done

- Privacy gate блокирует раунды ниже `privacyThreshold`.
- Async graph-style workflow выполняет interpretation → intervention catalog →
  safety validation → formatter.
- Рекомендации выбираются только внутри исходного измерения.
- `USE_MOCK_MCP=true` — явный local/test режим; remote MCP errors fail closed.

Проверка: `cd ai-analytics-service && python3 run_tests.py` (7/7).

### 3. Persistence — Done for the configured Supabase target

- `SurveyRound.aiInsights` и `aiInsightsUpdatedAt` добавлены в Prisma.
- Migration: `prisma/migrations/20260724170000_add_ai_insights/migration.sql`.
- In-memory и Prisma repositories используют одинаковый контракт.
- `npx prisma migrate deploy` выполнен успешно; `npx prisma migrate status`
  reports the database is up to date.

Для другого staging/production target миграцию нужно запускать отдельно после
подтверждения окружения и backup/status check.

### 4. Transport hardening — Done locally / deployment pending

- Независимые secrets: `MCP_SHARED_SECRET`, `AI_WEBHOOK_SECRET`,
  `AI_CALLBACK_SECRET`.
- MCP, callback и webhook имеют явные unauthorized/upstream/unavailable ответы.
- Callback проверяет version, route round ID, lock semantics и 8 stones до save.

### 5. Dashboard integration — Done locally

- Detail, metrics и recommendations читают `/api/rounds/[roundId]/ai-insights`.
- Состояния: loading, ready, locked, not-found, error.
- Навигация сохраняет `roundId`.

Проверка: headed browser scenarios для ready, missing и privacy-locked rounds.

### 6. Documentation and verification — Done locally

- OpenAPI JSON/YAML расширены MCP, trigger, callback/read и Stone Map schemas.
- `ai-analytics-service/README.md`, `.env.example`, `PROJECT_CONTEXT.md` и
  `PROGRESS.md` синхронизированы с фактическим runtime.
- Handoff зафиксирован в `docs/ai-analytics-handoff.md`.

## Dependency map

```text
Contract → Python/catalog → persistence → transport → dashboard
                                      ↘ tests/docs → staging handoff
```

## Definition of Done

- [x] `npm test` — 51 tests pass.
- [x] `npx tsc --noEmit` — pass.
- [x] `npm run lint` — pass.
- [x] `npm run build` — pass.
- [x] `npx prisma validate` — pass.
- [x] Python `run_tests.py` — 7/7 pass.
- [x] Local boundary E2E and browser state checks — pass.
- [x] No real secrets committed.
- [ ] Staging secrets configured and webhook smoke-test completed.
- [x] Migration applied to the configured external database after explicit approval.
- [x] Status documentation updated after migration and push.

## Stop-lines and handoff

Pause before any of the following:

- setting or rotating shared secrets in Vercel/AI runtime;
- invoking a real staging webhook;
- merging/pushing this work to `main`.

Required handoff inputs: target environment, migration approval, secret owner,
AI service deployment URL, and rollback contact.
