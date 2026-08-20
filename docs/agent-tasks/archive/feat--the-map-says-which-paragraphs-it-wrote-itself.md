# The map says which paragraphs it wrote itself

## Metadata

- Branch: `feat/the-map-says-which-paragraphs-it-wrote-itself`
- Base branch: `main`
- Base commit: `2b59526` (rebased onto it on 2026-08-19, when the sibling
  `fix/the-service-proves-its-commit-the-way-core-does` landed on `main`; the
  original base was `e752081` and the rebase was conflict-free, that branch
  having touched a different part of the handoff)
- Current HEAD: `68fd473`. The file was written at `f9b036a`, two commits
  above the base; more landed after it and it was never updated again.
- Status: complete, landed on `main` as `68fd473`, archived
- Last updated: 2026-08-20
- Last agent/tool: Claude Code (Opus 5)

## Objective

Option 2 of the fallback-disclosure research, requested on 2026-08-19: make the
map's own notice cover `deterministic_fallback`, not only `unavailable`.

## User-visible outcome

On `/dashboard`, the sidebar notice now also names the dimensions whose summary
paragraphs the service composed from the round's numbers. When nothing is
missing it is headed `פסקאות שנגזרו מהנתונים`; when something is missing it
keeps `ניתוח חלקי` and says both things in one box.

## Context

`DashboardPartialMapNotice` fired only for stones with `outcome: "unavailable"`.
Contract 6.0 does not raise per dimension: a provider that answers nothing
produces a full map whose paragraphs the service composed, tagged
`deterministic_fallback`. So on the deployed contract the banner fired for the
rare case and stayed silent for the common one, and the disclosure lived only on
the dimension and metric screens — the screens a manager who trusts the map
never opens, which is the exact problem this component was built for.

## Scope

- `src/lib/dashboard/dashboard-insights.ts` — a new DTO field.
- `src/lib/ai-insights-view-model.ts` — derive it from the stones.
- `src/components/dashboard/dashboard-partial-map-notice.tsx` — the sentence,
  the conditional heading, and an all-dimensions shortcut in `subject`.
- `src/components/dashboard/dashboard-map-page.tsx` — pass it.
- Tests for all three, plus the two DTO literals that gained a field.
- `PROJECT_CONTEXT.md` ADR-007 and `docs/shalomut-tracker-handoff.md`.

## Non-goals

- **Metric narratives stay off the map.** They fall back separately and are
  disclosed where their sentences are. `dashboard-metrics-page.tsx` states the
  reason and it still holds: a manager who read a real interpretation has no
  reason to suspect the readings underneath it.
- **The round-level summary note is untouched.** It already sits directly under
  the sentence it is about, which is better placement than a banner.
- **Not per-dimension re-run.** That is option 3 and is not this branch's.
- Not changing when `unavailable` fires, or anything in the Python service.

## Acceptance criteria

- A map with no gaps and some derived paragraphs renders the notice, headed so
  that it does not call a complete map partial.
- A map with both says both, in one box, under `ניתוח חלקי`.
- A map the model wrote whole still renders nothing.
- The gap sentences and their closing sentence are unchanged.

## Relevant repository instructions

- `.agents/skills/shalomut-verification/SKILL.md`: `src/components` and page TSX
  require targeted tests, `npm run lint`, `npm run build` and a browser smoke
  for a user-visible flow; `src/lib` adds `npm test`; any `.ts`/`.tsx` change
  adds `npm run typecheck`.

## Relevant architecture and contracts

- `PROJECT_CONTEXT.md` ADR-007 owns provider-failure disclosure; the new
  paragraph is under that heading rather than a new one.
- No wire contract, schema or manifest changes. The field is derived in the
  view model from `generationProvenance.outcome`, which contract 6.0 already
  carries.

## Decisions made

- **A separate DTO list, not a fourth `gapsByReason` group.** `gapsByReason`
  means "dimensions with no interpretation", and these have one. Adding them
  there would have made `dimensionsWithoutInterpretation` false.
- **One box, two headings.** The manager's question is the same both times —
  how much of this did a model write — so two adjacent boxes would read as two
  problems. But calling a complete map `ניתוח חלקי` is an overstatement, and an
  overstated banner is one people learn to ignore, so the heading changes when
  nothing is actually missing.
- **The closing "the scores are complete" sentence stays with the gaps.** It is
  about them; following a sentence about dimensions that have everything with
  it would attach it to the wrong subject.
- **Every dimension at once is counted, not listed.** `subject` returns
  `כל הממדים` when the list covers all of them — that is exactly what a silent
  provider looks like on 6.0, and eight captions in one sentence is a paragraph
  nobody reads.
- **The sentence reuses the dimension screen's wording**, so a manager who
  follows the link recognises it rather than reading it as a second problem.

## Assumptions

- A stone's `generationProvenance.outcome` is one value, so the derived list and
  the gap lists are disjoint. Asserted in the view-model test rather than left
  as an assumption.

## Completed

Everything in Scope.

## In progress

Nothing.

## Remaining

None. Both happened: the work was committed and `68fd473` is in `main`'s
history.

Archived 2026-08-20, when the file was found still sitting in `active/`
asking for a commit that had already been made. Nothing above this line was
rewritten — only the metadata and this section, which were describing a state
that had stopped being true.

## Changed files

- `src/lib/dashboard/dashboard-insights.ts`
- `src/lib/ai-insights-view-model.ts`
- `src/components/dashboard/dashboard-partial-map-notice.tsx`
- `src/components/dashboard/dashboard-map-page.tsx`
- `src/components/dashboard/__tests__/dashboard-partial-map-notice.test.tsx`
- `src/lib/__tests__/ai-insights-view-model.test.ts`
- `src/components/dashboard/__tests__/dashboard-semantic-quality.test.tsx`
- `src/components/round/__tests__/round-threshold-next-step.test.tsx`
- `PROJECT_CONTEXT.md`
- `docs/shalomut-tracker-handoff.md`
- this file

`next-env.d.ts` is modified in the worktree and is not part of this task. It is
a Next.js-generated file that was already dirty at session start; left alone.

## Verification evidence

### Passed

- `npm test` — **1208 passed**, including the four new component tests and the
  three new view-model tests.
- `npm run typecheck` — clean.
- `npm run lint` — clean.
- `npm run build` — clean, all routes compiled.
- **A browser walk of the real screen, local, both branches of the heading.**
  A production build was served on `:3210` with a throwaway manager password
  generated for the run — the same approach `playwright.config.ts` takes, so no
  repository secret was read or typed. A Contract 6.0 callback built from the
  round's own analytics was POSTed to
  `/api/rounds/round_local_1786790341143/ai-insights`, which accepted it only
  after it matched the questionnaire hash, every dimension score and status, and
  every question's aggregate — so what rendered is a map Core would really have
  stored.
  - Two dimensions `deterministic_fallback`, nothing missing: the sidebar shows
    `פסקאות שנגזרו מהנתונים` and *"הפסקאות של 2 ממדים — איזון, ודאות — נגזרו מן
    הנתונים המצרפיים של הסבב ולא נכתבו על ידי המודל…"*, right to left, in the
    box below the organizational summary.
  - The same two plus `meaning` as `provider_unavailable`: one box, headed
    `ניתוח חלקי`, carrying the gap sentence, the "scores are complete" sentence
    and the derived-paragraph sentence in that order.
  - The local database was restored to exactly what it held before: the round's
    `aiInsights` back to `null`, its analysis run back to `queued` with no
    result. The server was stopped and the scratch scripts deleted.

### Failed

- None.

### Blocked or not run

- Nothing in the Python service, the wire contract or persistence changed, so
  the Python suite and the contract refusal lint prove nothing here and were not
  run.
- `npm run lint:mutation-config` and the Stryker run were not needed: neither
  `ai-contract.ts` nor `scoring-bands.ts` nor the mutation config is touched.
- Nothing was checked on the deployed endpoint. This is not deployed.

### Environment

- Local, throughout. One local database write, made and then undone.

### Residual risk

- The Hebrew is agent-written, like the sentences it sits beside, and no native
  reader has approved this one either. It reuses the dimension screen's wording
  on purpose to keep that risk to the joining words.
- With all eight dimensions derived the sentence says `כל הממדים`; that case was
  asserted in a test but not walked in a browser.

## Failed approaches

- Posting the fixture payload unchanged: refused four times, each time correctly
  — wrong questionnaire hash, wrong per-stone hash, scores that did not match
  Core's analytics, and metrics that did not cover every question. Recorded
  because it is evidence about the callback gate, not just about this branch:
  the gate cannot be talked past with a well-formed payload.

## Known risks

- The DTO gained a required field, so anything constructing a
  `DashboardInsightsDto` by hand must add it. Two test files did; the compiler
  found both.

## Approval gates

- None crossed. No credential, secret, alias or deployed state is touched. The
  manager password used locally was generated for the run and is gone with it.

## Questions requiring an owner decision

- Option 3, true per-dimension re-run, is still unbuilt and now the only item
  left from that research. It is not a UI change — see the handoff entry for
  what it would take.

## Next concrete step

Commit the work on this branch, then hand `git push origin
feat/the-map-says-which-paragraphs-it-wrote-itself:main` to the owner.

## Closing note, 2026-08-19

Landed with the sibling `feat/one-dimension-can-be-analysed-again` and seen on
the deployed stack the same day, in the owner's signed-in Chrome: on a seeded
round whose `balance` stone carries `deterministic_fallback`, the map sidebar
showed the heading `פסקאות שנגזרו מהנתונים` — the no-gaps variant — naming
`ממד איזון` and pointing at the re-run. So the two halves of the disclosure,
the banner here and the button there, were confirmed together on the screen a
trusting reader actually opens.
