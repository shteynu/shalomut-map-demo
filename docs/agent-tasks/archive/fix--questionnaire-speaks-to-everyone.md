# The questionnaire addresses both genders

## Metadata

- Branch: `fix/questionnaire-speaks-to-everyone`
- Base branch: `test/respondent-path-e2e` (**not** `main` — see Decisions)
- Base commit: `0506169`
- Current HEAD: see `git log -1`
- Landed on `main` as `5cf826e`; contained in `origin/main` `568fbcb`
- Status: **closed** — landed, deployed, archived
- Last updated: 2026-08-10
- Last agent/tool: Claude Code (Opus 5)

## Objective

Close Tier 0 item 3: the three scale anchors and thirteen of the twenty-four
default questions addressed the respondent in the feminine singular.

## User-visible outcome

A man opening the questionnaire is addressed by it. The wording is the slash
form the file already used for `המנהל/ת מעריכ/ה` — `אני מרגיש/ה`, `אני יכול/ה`,
`אני בטוח/ה`.

## Context

The instrument comes from a Google Form and the דרכא deck, both written in the
feminine — defensible for a staffroom that is mostly women, indefensible to
hand a man and call anonymous. The likeliest male response to a questionnaire
not addressed to him is no response; non-response concentrated in one group is
bias in the dimension scores, in the map drawn from them and in the advice a
school acts on. It is the only Tier 0 item that cannot be repaired after
collection starts, because answers never given cannot be collected later.

Sixteen places, not the eight first reported: thirteen questions (including
`professional-competence-1` and `social-resource-1`, missed on the first pass)
and the three anchor descriptions.

## Scope

- `src/lib/shalomut-source.ts` — the sixteen places and a comment saying why.
- The two tests that tied the published `2.0` contract to the live template.
- `PROGRESS.md`, `docs/local-environment.md` (already current), this file.

## Non-goals

- `contracts/ai-analytics-v2.json`. See Decisions.
- The Python service's fixtures and eval corpus, and
  `contracts/fixtures/callback_corpus.json`. They are sample payloads for the
  legacy contracts, not the product's copy; 480 Python tests pass untouched.
- `docs/product-strategy-axes-2026-08-10.md`, a dated plan that says "eleven
  occurrences". Dated plans are preserved as historical evidence
  (`AGENTS.md`), and its count was an undercount.
- Manager-facing and result-screen Hebrew. Nothing there addresses a single
  respondent.

## Acceptance criteria

- No feminine-only form reaches a respondent — verified against the served
  page, not only the source.
- A round already collecting keeps its wording.
- Full TypeScript, Python and browser suites pass.

## Relevant repository instructions

- `.agents/skills/shalomut-map/SKILL.md`: do not silently change the semantics
  of published contracts `1.0`–`6.0`; the round snapshot, not the template, is
  the source of a round's questions.

## Relevant architecture and contracts

`isValidV2Stone` compares a stone's metric labels against
`contracts/ai-analytics-v2.json`. That is the only consumer of the manifest's
question text, and it runs only on the `1.0`/`2.0` branch. The producer makes
`3.0`–`6.0` (`5.0` unset, `6.0` deployed), and `3.0`+ validates against the
round's own `surveyDefinitionHash`.

## Decisions made

- **The published contract keeps its feminine sentences.** `1.0`/`2.0` are
  immutable published contracts (`PROJECT_CONTEXT.md` ADR on contract
  versioning). The rounds that speak `2.0` asked the `2.0` questions and their
  labels still match; no new round is produced below `3.0`. Editing the shipped
  manifest to match new copy would be a consumer-breaking change made to look
  like tidying.
- **So the parity test now compares structure, not text.**
  `ai-contract.test.ts` asserted `AI_ANALYTICS_QUESTIONS` deep-equals the
  template including `textHebrew`. It now compares ids and dimensions — a
  template that adds, drops or re-dimensions a question still fails — and a new
  canary asserts the manifest still carries its own published wording, so
  "fixing" the contract fails loudly.
- **`ai-contract-semantic-quality.test.ts` builds its `2.0` payload from the
  manifest** rather than from the live template. Building it from the template
  was constructing a payload no `2.0` round can produce.
- **Branched off `test/respondent-path-e2e`, not `main`.** That branch is not
  pushed yet, and it holds the only test that walks the questionnaire — the net
  under this change. The two must land in order.

## Assumptions

- No deployed round is stored under contract `1.0` or `2.0`. Not checked
  against the deployed database; if one exists, its stored result still
  validates, because its labels come from its own snapshot and match the
  frozen manifest.

## Completed

- Sixteen strings rewritten to the slash form in `src/lib/shalomut-source.ts`,
  with a block comment above `responseScale` recording why the wording changed,
  why the contract did not, and why rounds in flight are unaffected.
- `src/lib/__tests__/ai-contract.test.ts` — structural parity plus the canary.
- `src/lib/__tests__/ai-contract-semantic-quality.test.ts` — payload built from
  `AI_ANALYTICS_QUESTIONS`.
- `PROGRESS.md` — one line under Survey and manager workflow.

## In progress

Nothing.

## Remaining

Nothing. Landed on `main` on 2026-08-10 and deployed. Items 1 and 2 were closed
the same day.

## Changed files

- `src/lib/shalomut-source.ts`
- `src/lib/__tests__/ai-contract.test.ts`
- `src/lib/__tests__/ai-contract-semantic-quality.test.ts`
- `PROGRESS.md`
- `docs/agent-tasks/archive/fix--questionnaire-speaks-to-everyone.md` (this file)

## Verification evidence

### Passed

- `npm test` — 844 pass, 0 fail. Two tests failed first and are described under
  Decisions; both were the coupling this change had to resolve, not collateral.
- `ai-analytics-service`: `.venv/bin/python -m pytest` — 480 passed. Nothing on
  the Python side reads the template.
- `npm run typecheck`, `npm run lint` — clean.
- `npm run test:e2e` — 13 passed. The respondent spec walks all 24 rewritten
  questions and submits, on `chromium` and on `mobile-chrome`.
- Served page, before reseeding: the round created under the old template still
  showed `אני יכולה להביע`, in the browser at 375px. A round in flight keeps
  its wording — the claim in the source comment, checked rather than asserted.
- Served page, after `npx tsx scripts/seed-local.ts --reset`: zero occurrences
  of `אני מרגישה|אני יכולה|אני מקבלת|אני מצליחה|אני מבינה|אני בטוחה|כשאני חושבת`
  in the HTML the respondent route serves, and `אני יכול/ה להביע` present.
- Phone screenshot (Pixel 5, 393px) of question 1: the slash form renders and
  wraps cleanly, no break at the slash.

### Failed

None outstanding.

### Blocked or not run

- **The deployed wording has not been read, and cannot be yet.** The code is in
  the deployed build — `5cf826e` is an ancestor of `origin/main` `568fbcb`,
  which Vercel shows `Ready` under the Production alias — but the deployed
  database holds no round, so there is no share link to open and no served
  questionnaire to grep. The first deployed round is what will show the slash
  form there; until then this item's deployed evidence is containment only.
- The deployed database may hold rounds whose snapshots carry the old wording;
  that is correct and intended, but it was not verified there.
- `npm run test:mutation:ai-contract`: not run. The mutated files are
  unchanged; `ai-contract.test.ts` is in `tap.testFiles` and its assertions
  changed shape, so the score may move without test strength moving.

### Environment

Local. Database `127.0.0.1:5433`, reseeded twice during verification.

### Residual risk

- The default template and the published `2.0` manifest now say different
  things, on purpose. Anyone reading only the manifest will believe the product
  asks the feminine questions. The canary test and the source comment are what
  point at each other; there is no third place that reconciles them.
- The slash form is the ordinary Israeli convention but it is not the only
  option, and it is not a native speaker's judgement. If the owner prefers
  double forms (`מרגישה/מרגיש`) or a rewrite into neutral phrasing, the change
  is sixteen strings in one file.

## Failed approaches

None.

## Known risks

`Independent review recommended.` — the change touches a published contract
boundary, even though it deliberately leaves the artifact alone.

## Approval gates

None passed through. No secrets, credentials, aliases or deployed state.

## Questions requiring an owner decision

- Is the slash form the wording the owner wants shown to a school? This is
  copy a teacher reads; a native-speaker call outranks the convention argument.

## Next concrete step

None — this task is closed. The one thing still open belongs to the owner and
is carried in `docs/shalomut-tracker-handoff.md`: whether the slash form is the
wording a school should see. Changing it is sixteen strings in one file, and it
must happen before a school starts answering, not after.
