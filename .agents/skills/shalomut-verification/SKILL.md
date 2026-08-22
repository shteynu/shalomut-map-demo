---
name: shalomut-verification
description: Проверяй изменения и runtime-поведение проекта shalomut-map-demo. Используй, когда нужно доказать корректность bugfix или feature, выбрать tests по diff, проверить готовность к merge, выполнить lint/build/Prisma/Python/OpenAPI/AI E2E/browser smoke, проверить deployed environment или зафиксировать verification evidence без неподтверждённых claims.
---

# Shalomut Verification

## Как читать этот скилл

Всегда в силе: `Назначение` — пропорциональность риску; `Preflight` — без него
нельзя определить строки матрицы; `Матрица выбора` — обязательный минимум по
затронутой области; `Обработка результатов` и `Формат evidence` — что считается
пройденной проверкой и как о ней отчитаться.

По условию, после того как матрица выбрала строки: `Команды проекта` — подраздел
под каждую выбранную строку, а не весь раздел; `Browser и runtime scenarios` —
diff меняет user-visible flow;
[references/mutation-testing.md](references/mutation-testing.md) — сработала
строка про mutation config или мутируемые файлы либо нужно доказать силу тестов.

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
6. Против deployed по умолчанию действует read-only smoke: не создавай данные,
   не вызывай webhook и не меняй alias без разрешения, соответствующего
   environment. Правило стоит здесь, а не среди сценариев, потому что проверка
   callback или AI boundary тоже уходит в deployed, не будучи user-visible flow.
7. `npm run dev` запускает runtime, но сам по себе не является evidence.

## Матрица выбора

| Изменённая область | Обязательный минимум |
| --- | --- |
| Только Markdown, instructions или skills | Frontmatter/links, `git diff --check`, релевантная structural validation; для `AGENTS.md`, клиентских адаптеров и `.agents/skills/**` — `npm run lint:skills` |
| Мутируемые файлы (`src/lib/ai-contract.ts`, `src/lib/scoring-bands.ts`), их tests или mutation config | `npm run lint:mutation-config`, Stryker dry run; полный mutation run, если задача меняет mutation evidence или просит оценить test strength. Детали — [references/mutation-testing.md](references/mutation-testing.md) |
| `src/components`, page TSX, CSS | Targeted tests, `npm run lint`, `npm run build`; browser smoke для user-visible flow |
| Шрифты: `src/app/fonts/**`, `next/font` или font stack в `globals.css` | `npm run lint:fonts`, `npm run build` и browser smoke с `document.fonts` — сравни `.next/static/media/*.woff2` с файлом в репозитории и убедись, что ни один resource entry не уходит на Google |
| `src/app/api`, services, hooks, utilities | Ближайшие API/unit tests, затем `npm test` и `npm run build` |
| Repositories или server guards | Repository/API regression tests, `npm test`, `npm run lint`, `npm run build` |
| `prisma/schema.prisma` или migrations | `npx prisma validate`, `npx prisma generate`, repository tests; status/migration только по правилам ниже |
| Survey source, scoring или privacy | Survey-definition/math/API tests, `npm test`, respondent и locked/ready browser states |
| `docs/openapi.yaml` или API contract | `npm run openapi:generate`, OpenAPI integrity tests, сверка route/schema changes с реальными handlers |
| Versioned AI manifest, `contracts/capabilities.json` или AI TypeScript | `npm run lint:contract-refusals` — новая версия обязана получить suite отрицательных тестов; contract/registry/client/view-model tests, `npm test`, Python tests и local boundary E2E |
| `ai-analytics-service` | `.venv/bin/python -m pytest` из `ai-analytics-service` — полный набор, включая contract suites |
| Python-зависимости: `pyproject.toml`, `requirements*.txt`, `Dockerfile`, python-шаги в workflows | `npm run lint:python-deps`; локи регенерируются командами из `ai-analytics-service/README.md`, а не правятся руками. Развёрнутый интерпретатор — 3.11, и на машине разработки его обычно нет, поэтому доказательство одно: `docker build` и прогон набора в этом образе. Команда — в разделе `Local container check` того же README |
| Auth, secrets или authorization | Unauthorized/missing-secret/organization-isolation tests и security-focused diff review |
| Deploy, env или runtime config | Полный local suite, deployed source/build/health/status/logs и безопасный read-only browser smoke |

Если diff затрагивает несколько строк таблицы, объедини проверки и устрани
дубликаты.

Одна проверка не привязана к строке: `npm run typecheck` — обязательный минимум
для любого изменения `.ts`/`.tsx`. `npm run build` типизирует только граф
приложения и не видит ошибки в `__tests__`, а `npm run lint` типы не проверяет
вообще, поэтому ни одна строка выше его не заменяет.

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
- `npm run lint:fonts`, входящий в `verify:core`, не даёт шрифту вернуться в
  сеть: gate падает на `next/font/google`, на Google font host в коде или CSS и
  на `next/font/local` источнике, которого нет на диске. Правило не
  декоративное: до 2026-08-12 `next build` качал пять `.woff2` с
  `fonts.gstatic.com`, и 12 августа раннеру достался устаревший stylesheet — все
  пять ответили 404, Turbopack записал это как warning и уронил build
  сообщением, в котором нет ни слова про шрифт или сеть. Тот же коммит собрался
  в соседней job, так что gate был не красным, а случайным.

### Mutation testing

Правила, команды и история этого слоя вынесены в
[references/mutation-testing.md](references/mutation-testing.md). Открывай файл,
когда сработала строка матрицы про mutation config или мутируемые файлы, либо
когда пользователь просит доказать силу тестов.

Обе связанные проверки уже названы в матрице, потому что входят в `verify:core`
и роняют CI: `npm run lint:mutation-config` выводит `tap.testFiles` заново из
репозитория, а `npm run lint:contract-refusals` требует, чтобы каждый путь
валидации камня был упомянут в каком-нибудь `*-refusals.test.ts`. Не правь
`stryker.config.mjs` и не добавляй версию контракта, не прогнав их.

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
  создай его по `docs/local-environment.md` — с extra `[dev]`, иначе pytest в
  venv не появится.
- То же правило для Node-вызовов проверяет `npm run lint:interpreter`, входящий
  в `verify:core`. Интерпретатор резолвит `scripts/ai-service-python.mjs`; gate
  падает на `python3` в позиции команды в `scripts/`, `src/`, `e2e/`,
  `package.json` и `.github/workflows/`. Разрешён только `python3 -m venv`.
  Правило не декоративное: `npm test` поднимает реальный Python pipeline, и до
  2026-08-12 он брал `python3` из PATH — на macOS это 3.9, который не проходит
  `requires-python = ">=3.11"` и роняет три cross-service теста ImportError'ом
  из середины сервиса, а вместе с ними и весь `verify:core`.
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

Один путь из этого списка автоматизирован: `npm run test:e2e` собирает проект и
прогоняет `e2e/smoke.spec.ts` — вход менеджера, экран сбора, ссылка для
респондента и дашборд. Playwright сам поднимает сервер на порту 3100 и сам
выдаёт ему `SESSION_SECRET`, `MANAGER_ADMIN_PASSWORD` и
`MANAGER_ORGANIZATION_ID`, поэтому реальные секреты не нужны ни локально, ни в
CI. Нужна база с раундом: локально это dev-база, в CI шаг сам применяет
миграции и сид. Smoke отвечает на вопрос «приложение стоит?», а не «правила
верны» — остальные проверки не заменяет.

Для local UI используй `playwright` или `playwright-interactive`, если они
доступны. Для deployed environment действует read-only правило из `Preflight`.

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
