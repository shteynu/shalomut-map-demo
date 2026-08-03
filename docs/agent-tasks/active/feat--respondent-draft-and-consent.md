# Respondent draft recovery and consent step

## Metadata

- Branch: `feat/respondent-draft-and-consent`
- Base branch: `origin/main`
- Base commit: `8f9c29d`
- Current HEAD: `8f9c29d` плюс единственный коммит, добавляющий этот файл
- Status: started, no implementation commits yet
- Last updated: 2026-08-03
- Last agent/tool: Claude Code (Opus 5)

## Objective

Дать анонимному респонденту два недостающих качества опроса: незавершённый
опрос переживает refresh вкладки, и до первого вопроса человек проходит явный
шаг информированного согласия.

Оба пункта меняют одну state machine в `src/components/survey/survey-flow.tsx`,
поэтому идут одним PR из трёх коммитов.

## User-visible outcome

- Респондент обновляет страницу и возвращается к тому же вопросу с теми же
  ответами, без повторного согласия.
- Потерянный ответ сервера с последующим retry не создаёт второй response и
  показывает завершённый экран.
- До первого вопроса респондент видит, зачем опрос, что он анонимен и что
  участие добровольно, и явно соглашается либо отказывается.
- Отказ не отправляет ни одного запроса.

## Context

Реализуется по внешнему документу `mvp-items-3-5-implementation-plan.md`
(ревизия 2026-08-03, сверена с кодом на `8f9c29d`), раздел «PR 1 — respondent
recovery and consent». Документ живёт вне репозитория; все решения, нужные для
реализации, продублированы ниже, чтобы задача была самодостаточной.

Текущее состояние кода:

- `SurveyFlow` держит `answers`, `currentIndex`, `submitted` и attempt-token
  только в React state; refresh уничтожает прогресс.
- `createAttemptTokenSource` (`src/lib/survey-attempt-token.ts`) умеет
  `current()` и `reset()`, но не умеет восстановить токен.
- Submit route возвращает duplicate как `400` со строковым английским текстом;
  клиент не может отличить бизнес-состояние от прочих ошибок.
- Идемпотентность на стороне БД уже есть: `@@unique([roundId,
  anonymousTokenHash])` плюс `hasTokenSubmitted` и `DuplicateResponseError` в
  `SurveyService.submitAndSaveResponse`.
- Единственный потребитель `SurveyFlow` — `src/app/answer/[shareCode]/page.tsx`.
  `/survey` — это builder менеджера, не анкета.

## Scope

### Commit 1 — draft primitives

- Новый `src/lib/survey-draft-storage.ts`: `SurveyDraftV1`, чистый
  `parseSurveyDraft`, тонкий `loadSurveyDraft`, `writeSurveyDraft`,
  `clearSurveyDraft`, синхронный `questionnaireFingerprint`.
- `src/lib/survey-attempt-token.ts`: добавить `restore(token)`.
- Типизированный `SurveySubmissionErrorCode` в `src/lib/types/backend.ts`,
  проброс через `src/lib/services/survey.service.ts` и submit route; duplicate
  становится `409`.
- `docs/openapi.yaml` + `npm run openapi:generate`.
- Тесты: новый `src/lib/__tests__/survey-draft-storage.test.ts`, дополнение
  существующего `src/lib/__tests__/survey-attempt-token.test.ts`.

### Commit 2 — autosave integration

- Hydration guard, восстановление answers/currentIndex/token/consent.
- Debounced save плюс обязательный синхронный flush на `pagehide` и
  `visibilitychange: hidden`.
- Очистка draft при успешной отправке и при `ALREADY_SUBMITTED`.
- UI восстановления и неблокирующее предупреждение при недоступном storage.

### Commit 3 — consent state

- Новый `src/components/survey/survey-consent-step.tsx`.
- `SurveyPhase` из четырёх состояний в `SurveyFlow`.
- Проброс `estimatedMinutes` со страницы через `SurveyFlowProps`.
- Решение по мёртвому `variant="internal"`.
- Focus/a11y и Hebrew copy.

## Non-goals

- Server-side drafts и любая новая таблица или миграция.
- Продолжение анкеты после закрытия вкладки или браузера, cross-device resume.
- Consent audit trail, `consentVersion`, `legalText`, persisted
  `consentAcceptedAt`.
- Всё из пунктов 5 и 6 плана: выбор раунда, история раундов, создание раундов.
  Это PR 2 и PR 3, отдельные ветки.

## Acceptance criteria

- [ ] Ответы и текущий вопрос переживают refresh текущей вкладки.
- [ ] Consent не спрашивается повторно после refresh той же attempt-сессии.
- [ ] Изменившаяся анкета не восстанавливает старые ответы.
- [ ] Successful submit очищает draft.
- [ ] Lost-response + refresh + retry не создаёт второй response и показывает
      завершённый экран.
- [ ] «מילוי שאלון נוסף» создаёт новый token и чистое состояние.
- [ ] Storage failure не мешает отправить анкету.
- [ ] Ответ, данный за ~100 ms до `pagehide`, переживает refresh.
- [ ] Первый вопрос недоступен до явного accept; decline не создаёт request.
- [ ] В `sessionStorage` нет PII и нет server response ID.
- [ ] `docs/openapi.yaml` описывает `409`/`ALREADY_SUBMITTED`,
      `public/openapi.json` перегенерирован.
- [ ] `npm run verify` завершается с реальным exit code 0.

## Relevant repository instructions

- `AGENTS.md`: одна задача — одна ветка — один task-файл; сохранять чужие
  изменения в dirty worktree; не раскрывать respondent identity.
- `.agents/skills/shalomut-map/SKILL.md`: RTL-first, WCAG AA, тёплая
  stone-map лексика; предпочитать существующие компоненты; после изменения API
  править только `docs/openapi.yaml` и генерировать JSON.
- `.agents/skills/shalomut-verification/SKILL.md`: `npm run typecheck`
  обязателен для любого `.ts`/`.tsx`, потому что `tsx` стирает типы, а
  `npm run build` не видит `__tests__`.

## Relevant architecture and contracts

- Идемпотентность отправки живёт в БД (`@@unique([roundId,
  anonymousTokenHash])`) и остаётся последней линией защиты. Клиентский draft
  её не заменяет, а лишь позволяет retry попасть в ту же attempt.
- `hashAnonymousToken` использует `crypto.subtle`, доступный только в secure
  context. Поэтому questionnaire fingerprint делается **не** через Web Crypto.
- В API по-прежнему уходит только SHA-256 hash токена, сам токен наружу не
  выходит и не логируется.
- Composition boundary: `resolveCoreRepositories()` вызывают только
  entrypoints; проверяется `npm run lint:composition`.

## Decisions made

1. **`sessionStorage`, не `localStorage`.** Продукт прямо рассчитан на общий
   компьютер (`SurveyFlow` предлагает «מילוי שאלון נוסף» и поясняет, что каждое
   заполнение — отдельная анонимная запись). Долговременное хранение показало бы
   ответы предыдущего человека следующему. Граница MVP: прогресс переживает
   refresh и временную ошибку сети, но не закрытие вкладки.
2. **Attempt-token хранится внутри draft.** Иначе refresh после потерянного
   `200` создаст новый токен, и повторная отправка выглядит для сервера как
   новый ответ.
3. **Fingerprint анкеты — синхронный и не криптографический** (FNV-1a).
   `crypto.subtle` требует secure context и добавил бы `await` в hydration,
   создав окно, в котором write-effect перезапишет draft пустым состоянием.
   Синхронный вариант устраняет гонку, а не охраняет её.
4. **`parseSurveyDraft` — чистая функция без побочных эффектов**, удаление
   ключа делает тонкая обёртка. Так весь fail-closed список тестируется без DOM.
5. **Полный enum кодов ошибок отправки**, а не только duplicate: у route пять
   различимых отказов. 500 остаётся без кода, клиент трактует отсутствие кода
   как неизвестный отказ.
6. **`SurveyPhase` — четыре состояния** (`consent`, `questions`, `complete`,
   `declined`). `review` и `submitting` остаются derived, иначе появится второй
   источник истины рядом с `isReviewStep = currentIndex === total`.
7. **Privacy-обещания фиксированы в коде**, отдельным блоком от менеджерского
   `introText`/`anonymityText`, которые редактируются в builder и могут им
   противоречить.
8. **Debounce обязателен к flush.** `selectAnswer` перелистывает вопрос через
   260 ms; при debounce 300–500 ms ответ перед самым refresh потерялся бы —
   ровно тот случай, ради которого делается автосохранение.
9. **Смена `400` → `409` — изменение публичного API**, поэтому OpenAPI входит
   в scope commit 1, а не «по желанию».

## Assumptions

- Внешний план — источник намерения, но при расхождении с кодом выигрывает код
  (правило приоритетов `shalomut-tracker`).
- Хранение raw attempt-token в `sessionStorage` не является раскрытием
  respondent identity: это случайный UUID одной попытки, не идентификатор
  человека, и он не покидает вкладку.
- Component/browser test harness в проекте нет; клиентская часть проверяется
  ручным smoke, а вся сериализация и переходы состояний выносятся в чистые
  функции.

## Completed

- Ветка `feat/respondent-draft-and-consent` создана от `origin/main` (`8f9c29d`).
- Task-файл создан.
- План сверен с кодом: подтверждены анкеры в `survey-flow.tsx`,
  `survey-attempt-token.ts`, `survey.service.ts`, submit route,
  `docs/openapi.yaml`, `answer/[shareCode]/page.tsx`.

## In progress

Ничего. Реализация не начата.

## Remaining

Commit 1, commit 2, commit 3 из раздела Scope, затем `npm run verify` и
ручной smoke респондентского flow.

## Changed files

Пока нет. В worktree присутствуют два **не относящихся к задаче** изменения,
унаследованных от предыдущей сессии и намеренно сохранённых:

- `.idea/shalomut-map-demo.iml` (изменён, не staged)
- `next-env.d.ts` (изменён, не staged)

Их нельзя откатывать и нельзя включать в коммиты этой задачи.

## Verification evidence

### Passed

Ничего. Кода ещё нет.

### Failed

Ничего.

### Blocked or not run

- `npm run verify` — not run: изменений нет.
- Ручной smoke респондентского flow — not run: изменений нет.

### Environment

local

### Residual risk

Не применимо на этом этапе.

## Failed approaches

Пока нет.

## Known risks

- **Пустой state перезапишет draft при hydration.** Смягчено синхронным
  fingerprint плюс флагом `hydrated` как вторым слоем.
- **Потеря последнего ответа из-за debounce.** Смягчается обязательным flush.
- **Утечка черновика на общем устройстве.** Смягчается `sessionStorage`,
  очисткой после успеха/отказа/новой попытки и тем, что другая вкладка получает
  отдельный draft.
- **Drift OpenAPI.** `npm run verify` включает `openapi:check`, который упадёт,
  если YAML и JSON разойдутся.

## Approval gates

Нет. Задача не трогает secrets, credentials, authentication configuration и
deployment aliases. Миграций и записей в базу нет.

## Questions requiring an owner decision

- Судьба `variant="internal"` в `SurveyFlow`: ни один вызывающий его не
  использует, единственный потребитель передаёт `"public"`. Удалить в commit 3
  или сохранить с обоснованием. Не блокирует commit 1 и commit 2.

## Next concrete step

Реализовать commit 1: создать `src/lib/survey-draft-storage.ts` с
`SurveyDraftV1`, чистым `parseSurveyDraft`, обёрткой `loadSurveyDraft`,
`writeSurveyDraft`, `clearSurveyDraft` и синхронным `questionnaireFingerprint`,
и покрыть его новым `src/lib/__tests__/survey-draft-storage.test.ts`.
