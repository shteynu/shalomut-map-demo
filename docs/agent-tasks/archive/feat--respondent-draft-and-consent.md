# Respondent draft recovery and consent step

## Metadata

- Branch: `feat/respondent-draft-and-consent`
- Base branch: `origin/main`
- Base commit: `8f9c29d`
- Current HEAD: `63f668e`
- Status: работа закончена и проверена. Владелец решил 2026-08-03 отправить
  ветку прямо в `main` без отдельного review; push остаётся за владельцем,
  агенту он здесь недоступен
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

- [x] Ответы и текущий вопрос переживают refresh текущей вкладки (browser smoke).
- [x] Consent не спрашивается повторно после refresh той же attempt-сессии.
- [x] Изменившаяся анкета не восстанавливает старые ответы (unit).
- [x] Successful submit очищает draft.
- [x] Lost-response + refresh + retry не создаёт второй response и показывает
      завершённый экран (`resolveSubmissionOutcome`, unit).
- [x] «מילוי שאלון נוסף» создаёт новый token и чистое состояние.
- [x] Storage failure не мешает отправить анкету.
- [x] Ответ, данный за ~100 ms до `pagehide`, переживает refresh (browser smoke).
- [x] Первый вопрос недоступен до явного accept; decline не создаёт request.
- [x] В `sessionStorage` нет PII и нет server response ID (unit: список ключей).
- [x] `docs/openapi.yaml` описывает `409`/`ALREADY_SUBMITTED`,
      `public/openapi.json` перегенерирован (commit 1).
- [x] `npm run verify` завершается с реальным exit code 0 на финальном состоянии
      ветки (`63f668e`).

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
- Task-файл создан (`a09962f`).
- План сверен с кодом: подтверждены анкеры в `survey-flow.tsx`,
  `survey-attempt-token.ts`, `survey.service.ts`, submit route,
  `docs/openapi.yaml`, `answer/[shareCode]/page.tsx`.
- **Commit 1 — draft primitives (`86e0279`), проверен.**
  - Новый `src/lib/survey-draft-storage.ts`: `SurveyDraftV1`, чистый
    `parseSurveyDraft` с типизированными причинами отказа, обёртки
    `loadSurveyDraft`/`writeSurveyDraft`/`clearSurveyDraft`, синхронный
    `questionnaireFingerprint` (FNV-1a), `createSurveyDraft` с инъекцией времени,
    `surveyDraftStorageKey`.
  - `src/lib/survey-attempt-token.ts`: `restore(token)` и общий предикат
    `isAttemptToken`, которым пользуется и разбор draft.
  - `SurveySubmissionErrorCode` из пяти значений и необязательное поле `code` в
    `SubmitSurveyResult` (`src/lib/types/backend.ts`).
  - `SURVEY_SUBMISSION_ERROR_STATUS` в `survey.service.ts` — таблица
    код → HTTP-статус, чтобы route и OpenAPI не разошлись.
  - Submit route: все отказы проходят через `refuse()`; duplicate стал `409`.
  - `docs/openapi.yaml`: схема `SurveySubmissionError`, ответы `400`/`404`/`409`
    у submit; `public/openapi.json` перегенерирован через `npm run openapi:generate`.
  - Тесты: новый `survey-draft-storage.test.ts` (30 кейсов), дополнен
    `survey-attempt-token.test.ts` (3 кейса на restore), обновлён и расширен
    `src/app/api/__tests__/api.test.ts`.

- **Commit 2 — autosave integration (`e6aa04b`), проверен.**
  - `createSurveyDraftStore` и `getSurveyDraftStorage` в
    `src/lib/survey-draft-storage.ts`: источник для `useSyncExternalStore` с
    кэшированным снимком и `getServerSnapshot`, у которого `checked: false`.
  - `survey-flow.tsx`: seeding состояния из снимка происходит в фазе рендера
    (санкционированный React adjust-during-render), а не в эффекте;
    восстанавливаются answers, currentIndex, attempt-token и `consentAcceptedAt`.
  - Debounced save (400 ms) плюс синхронный flush на `pagehide` и на
    `visibilitychange` при `document.visibilityState === 'hidden'`.
  - Новый `src/lib/survey-submission-outcome.ts`: `ALREADY_SUBMITTED`
    трактуется как завершение, каждый остальной код получает ивритский текст,
    неизвестный код — общий retry-текст.
  - Draft удаляется при завершении отправки и при запуске новой попытки,
    которая также сбрасывает токен и время согласия.
  - UI: notice о восстановлении (`role="status"`) и неблокирующее
    предупреждение при недоступном storage; стили `.survey-draft-note` и
    `.survey-draft-note-warning` в `globals.css`.
  - Тесты: `src/lib/__tests__/survey-submission-outcome.test.ts` (6 кейсов) и
    `src/components/survey/__tests__/survey-flow-draft.test.tsx` (3 кейса,
    `renderToStaticMarkup` фиксирует серверный проход).

- **Commit 3 — consent state (`63f668e`), проверен.**
  - Новый `src/components/survey/survey-consent-step.tsx`: объём анкеты
    (число вопросов и `estimatedMinutes`), три обещания, которыми владеет код,
    и менеджерский `anonymityText` отдельным, визуально более лёгким блоком.
  - `SurveyPhase` из четырёх состояний в `SurveyFlow` вместо булева
    `submitted`; `review` и `submitting` остались derived.
  - Восстановленный draft восстанавливает и согласие (`consentAcceptedAt`),
    поэтому после refresh согласие не спрашивается повторно; «מилуй нового
    ответа» на общем компьютере возвращает в `consent`, потому что то согласие
    давал другой человек.
  - Экран отказа: компонент не содержит сетевого кода, поэтому decline
    физически не может ничего отправить.
  - Фокус после accept переносится на заголовок первого вопроса, но только
    когда согласие дал человек, а не когда восстановился draft.
  - `estimatedMinutes` прокинут из `src/app/answer/[shareCode]/page.tsx`.
  - **Удалён `variant="internal"`** по решению владельца: ни один вызывающий
    его не передавал, а его ветка несла второй, более слабый набор
    privacy-утверждений, который никогда не отображался.
  - Тест переименован в `survey-flow-server-render.test.tsx` и расширен до
    6 кейсов: серверный проход показывает согласие и **не** показывает вопрос.

## In progress

Ничего. Все три коммита закрыты и проверены.

## Remaining

Push ветки и review — оба действия владельца. Кода в scope этой задачи не
осталось.

## Changed files

Закоммичено в `63f668e`: `src/components/survey/survey-consent-step.tsx`
(новый), `src/components/survey/survey-flow.tsx`,
`src/components/survey/index.ts`, `src/app/answer/[shareCode]/page.tsx`,
`src/app/globals.css`, переименование
`survey-flow-draft.test.tsx` → `survey-flow-server-render.test.tsx`.

Закоммичено в `e6aa04b`: `src/components/survey/survey-flow.tsx`,
`src/lib/survey-draft-storage.ts`, `src/lib/survey-submission-outcome.ts`,
`src/app/globals.css`, `src/lib/__tests__/survey-submission-outcome.test.ts`,
`src/components/survey/__tests__/survey-flow-draft.test.tsx`.

В worktree присутствуют два **не относящихся к задаче** изменения,
унаследованных от предыдущей сессии и намеренно сохранённых:

- `.idea/shalomut-map-demo.iml` (изменён, не staged)
- `next-env.d.ts` (изменён, не staged)

Их нельзя откатывать и нельзя включать в коммиты этой задачи.

## Verification evidence

Состояние на `63f668e` (commit 3).

### Passed — commit 3

- `npm run verify` на `63f668e` — реальный exit code 0: `lint:literals`
  (5 pass), `lint:composition` (5 pass), `typecheck`, `npm test`
  (**429 pass, 0 fail**), `npm run lint`, `npm run build`
  (compiled successfully, 41 страница), `verify:db` (7 pass),
  `verify:ai` (368 passed).
- Browser smoke, раунд `SHALOM-LOCAL` временно `active`, чистая вкладка:
  - экран согласия показан до первого вопроса; в DOM нет ни одного вопроса;
  - «לא עכשיו» → экран отказа, `read_network_requests` по шаблону `api` —
    **ни одного запроса**, `sessionStorage` без ключа draft;
  - «הבנתי, אפשר להתחיל» → `שאלה 1 מתוך 24`, `document.activeElement` —
    заголовок первого вопроса (`H2`), draft записан с `consentAcceptedAt`
    и новым attempt-token;
  - вкладка с существующим draft открывает `שאלה 3 מתוך 24` с notice о
    восстановлении и **без** экрана согласия;
  - mobile 375×812: обещания читаются, кнопки переносятся в колонку,
    primary первой.
  После smoke раунд возвращён в `status='closed'`, dev-сервер остановлен.

### Passed — commit 2

- `npm run verify` на `e6aa04b` — реальный exit code 0. Внутри:
  `lint:literals` (5 pass), `lint:composition` (5 pass), `typecheck`,
  `npm test` (**426 pass, 0 fail**), `npm run lint`, `npm run build`
  (compiled successfully, 41 статических страниц), `verify:db` (7 pass),
  `verify:ai` (pytest, 368 passed).
- Browser smoke на локальном dev-сервере, раунд `SHALOM-LOCAL` временно
  переведён в `active`:
  - отвечено на два вопроса, затем refresh → страница показала
    `שאלה 3 מתוך 24`, notice
    `ההתקדמות מהטעינה הקודמת שוחזרה. אפשר להמשיך מאותה נקודה.`,
    а `aria-valuenow=8` подтвердил, что оба ответа вернулись в state, а не
    только позиция курсора;
  - ответ, данный непосредственно перед refresh (внутри окна debounce),
    пережил перезагрузку — то есть flush на `pagehide` действительно
    срабатывает;
  - `sessionStorage` содержал только поля `SurveyDraftV1`.
  После smoke раунд возвращён в `status='closed'`, dev-сервер остановлен.

### Passed — commit 1

- `npx tsx --test src/lib/__tests__/survey-draft-storage.test.ts
  src/lib/__tests__/survey-attempt-token.test.ts` — 40 pass, 0 fail.
- `npm run openapi:generate`, затем
  `npx tsx --test src/app/api/__tests__/openapi.test.ts` — 8 pass, 0 fail.
- `npx tsx --test src/app/api/__tests__/api.test.ts
  src/app/api/__tests__/submit-auto-trigger.test.ts` — 23 pass, 0 fail.
- `npm run verify` — реальный exit code 0. Внутри: `lint:literals`,
  `lint:composition` (5 pass), `typecheck`, `npm test` (417 pass, 0 fail),
  `npm run lint`, `npm run build` (compiled successfully), `verify:db`,
  `verify:ai` (pytest, 368 passed).

### Failed

- Первые пробы браузера на commit 3 сообщали, что при существующем draft
  показан экран согласия. Ложная тревога: пробы читали фоновую вкладку
  (`document.visibilityState === 'hidden'`), где клиентский проход ещё не
  отработал. После скриншота, который выводит вкладку на передний план,
  показан вопрос 3 из 24 с notice о восстановлении. Тот же урок о задержке,
  что и на commit 2: состояние страницы нельзя читать раньше, чем клиент
  успел смонтироваться.
- ESLint `react-hooks/refs` на промежуточном состоянии commit 2: чтение
  `attemptTokenRef.current` в фазе рендера. Код был там и раньше, но стал
  ошибкой, как только `attemptToken` попал в зависимости эффекта. Заменено на
  ленивый `useState(createAttemptTokenSource)`.
- ESLint `react-hooks/set-state-in-effect` на промежуточном состоянии commit 2:
  синхронный `setState` внутри hydration-эффекта. Исправлено переходом на
  `useSyncExternalStore` — тот же приём, что уже используется в
  `src/lib/use-share-url.ts`.
- `npx tsx --test src/app/api/__tests__/api.test.ts` на промежуточном состоянии:
  `API Route submit accepts a second attempt from the same device` ожидал `400`,
  получил `409`. Это ожидаемое следствие намеренной смены статуса; тест обновлён
  на новый контракт и дополнен проверкой поля `code`. После правки проходит.
- `npm run typecheck` на промежуточном состоянии: TS2322/TS2345 в новом тесте —
  `'belonging'` не входит в `WellbeingDimensionId`. Исправлено на
  `'social-resource'` и `'balance'`. Показательно, что это поймал именно
  `typecheck`: `npm test` был зелёным, потому что `tsx` стирает типы.

### Blocked or not run

- Browser smoke на commit 1 был бы преждевременен (коммит не менял видимого
  поведения) и выполнен на commit 2 — см. Passed выше.
- Проверка отказа по `fingerprint-mismatch` в браузере — **not run**, и в
  текущем виде невыполнима: правка `sessionStorage` с последующим `reload()`
  перезаписывается flush-обработчиком `pagehide` той же страницы, который
  честно кладёт обратно валидный draft. Попытка проверить это через браузер
  проверяла бы flush, а не fingerprint. Сам путь покрыт unit-тестом
  «refuses a draft written for another questionnaire».
- Проверка на реальном общем устройстве (два человека, одна вкладка) — not run.
- Safari private mode (`sessionStorage` бросает при доступе) — not run;
  покрыто только дублями в unit-тестах.

### Environment

local

### Residual risk

- Поведение `sessionStorage` при недоступном или переполненном хранилище
  проверено только на дублях, не в реальном Safari private mode.
- Коллизия FNV-1a не проверяется тестом на реальном корпусе анкет; принята как
  осознанный остаточный риск (восстановление ответов в анкету того же размера у
  одного респондента).
- Смена `400` → `409` наблюдаема для любого внешнего клиента submit-эндпоинта.
  Известный потребитель один — `SurveyFlow`, и он читает `res.ok`, поэтому
  регрессии нет; внешних интеграций у публичного submit не обнаружено.

## Deviations from the plan

- `restore(token)` возвращает `boolean`, а не `void`, как было в плане. Молча
  проигнорированный невалидный токен оставил бы вызывающего в уверенности, что
  он восстановил попытку, хотя `current()` выдаст новый токен.
- Добавлена причина отказа `absent` — плану она не требовалась, но
  `parseSurveyDraft(null, …)` должна чем-то отвечать, и обёртка не должна
  удалять ключ, которого нет.
- Нецелое значение `currentIndex` отвергается как `malformed`, а не
  нормализуется. План говорил про нормализацию индекса вне диапазона; `'first'`
  или `NaN` — это сломанная форма, а не выход за границы, и приводить их к нулю
  было бы произволом.
- Формат токена проверяет общий предикат `isAttemptToken`, а не UUID-регэксп:
  фабрика токенов инъектируемая, поэтому UUID — не контракт модуля. Строгость
  здесь ничего не защищает — токен лежит в собственном `sessionStorage`
  респондента, и правка даёт ровно то же, что и очистка.

## Failed approaches

Пока нет.

## Known risks

- **Пустой state перезапишет draft при hydration.** Снято: сид происходит в
  фазе рендера из снимка `useSyncExternalStore`, а save-эффект не работает,
  пока `seeded` ложно, поэтому окна для перезаписи не возникает.
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

Открытых нет. `variant="internal"` решено удалить (владелец, 2026-08-03),
удалён в commit 3.

## Next concrete step

Владельцу: `git push origin feat/respondent-draft-and-consent:main`. Это
fast-forward от `8f9c29d`. Локальный `main` живёт в другом worktree и должен
быть подтянут там же. Следующая работа — PR 2 `feat/round-history-selection`
на отдельной ветке от свежего `main`.
