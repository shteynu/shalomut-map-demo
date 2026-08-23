# Asking for a round does not compute a map

## Metadata

- Branch: `perf/asking-for-a-round-does-not-compute-a-map`
- Base branch: `main`
- Base commit: `96c2e52`
- Current HEAD: `36b9fd0`, an ancestor of `main`. The branch is `8bafdd8`, `36b9fd0`,
  oldest first.
- Status: complete, landed on `main`; archived 2026-08-23
- Last updated: 2026-08-23
- Last agent/tool: Claude Code (Opus 5)

## Objective

Close the 2026-08-21 audit's «`GET /api/rounds` платит полным пересчётом
аналитики, чтобы вернуть один объект раунда», anchored at
`src/app/api/rounds/route.ts:37`.

## What was actually wrong

The audit named the endpoint. The endpoint was one of eight.

`ManagerContextService.load` is the single door every manager screen and that
endpoint come through, and it called `AnalyticsService.getAnalyticsForRound`
unconditionally. Auditing the eleven callers against what they actually read:

- **Render the analysis** — `/`, `/dashboard`, `/breakdown`. Three.
- **Read only `responseCount`** — `/survey`, `/round`. Two.
- **Read neither** — `/goals`, `/setup`, `/dashboard/[dimension]` and its
  `metrics` and `recommendations` children, and `GET /api/rounds`. Six.

The cost is not uniform, and the worst case is not a latency problem:

- Cheapest path — a collecting round: one redundant `roundRepo.findById` of a
  round `load` is already holding, plus the count.
- Closed round with a valid published copy: that `findById`, the count, and
  `roundRepo.findPublishedAnalytics`.
- Closed round whose basis of calculation moved — which is what happens as soon
  as the questionnaire is edited: `surveyRepo.findResponsesByRoundId` for every
  response of the round, a full recompute, and `savePublishedAnalytics`. **A
  write, performed while answering a read.**

## Decisions made

1. **The analysis is declined, not requested.** `{ withAnalytics: false }` is
   the only option and has one useful value, because computing it is what the
   default does. Defaulting to computing it also means a caller added later is
   correct-but-slow rather than fast-but-wrong.
2. **The field is removed from the type, not set to `null`.** `null` already
   means "this round has no numbers", so a screen that opted out and later
   started reading `analytics` would be handed something that looks like an
   answer and would render an empty map. `ManagerContextWithoutAnalytics` is
   `Omit<ManagerContext, "analytics">`, so reading it is `TS2339`. **Verified
   by hand**: adding `context.analytics` to `goals/page.tsx` fails `tsc` with
   `Property 'analytics' does not exist on type
   'ManagerContextWithoutAnalytics'`; the line was removed again.
3. **`responseCount` stays, and is counted directly.** That let `/survey` and
   `/round` decline too, taking the eight to eight rather than six. It is the
   same number either way, and that is checked rather than assumed: every
   analytics path sets `totalResponses` from `scopedResponses.length`, whose
   only filter is `response.roundId === round.id` over rows already fetched by
   `findResponsesByRoundId(roundId)` — so it equals `getResponseCount(roundId)`
   in all three branches.
4. **One entrypoint, not two.** A separate `loadManagerContextWithoutAnalytics`
   would have been simpler to type. It would also have been a second way into
   the manager screens, and `loadManagerContext` is a tenant chokepoint whose
   job is recording the administrator's visit — guarded by
   `scripts/check-tenant-chokepoints.mjs` precisely because that has been
   bypassed before. Overloads on the one function keep the door single.
5. **Two helpers were widened rather than duplicated.** `loadSchoolChoices`,
   `loadSchoolGoals` and `isSelectedRoundSuperseded` never read the analysis, so
   they now take `ManagerContextWithoutAnalytics` and accept both shapes. That
   widening is documentation: it says which shared helpers are safe for a
   declining screen. `loadRoundComparison` still takes the full context, because
   it genuinely reads `context.analytics`.
6. **The three screens that draw the map were not touched.**

## Known asymmetry, deliberate

The four states that return before a round is selected — `needs-organization`,
`needs-round`, `round-not-found`, `scope-required` — are shared by both paths and
still carry `analytics: null` at runtime, even when the caller declined. The type
hides it, nothing serializes a context, and there is no analysis to decline in
those states because there is no round. Splitting four return statements in two
to remove a field nobody can see would be worse than saying so here.

## Deliberately not done

- **The 2026-08-21 row above this one — "экраны раунда и breakdown грузят
  ответы и попытки по два раза за рендер" — is still open.** It is the same
  neighbourhood and a different fix: passing already-loaded arrays into the
  services. Doing it inside this change would have mixed a "read less" argument
  with a "read once" one.
- No measurement against the deployed database. The claim here is about which
  repository methods are reached, which is what the tests assert; turning that
  into milliseconds would need a database with a real round's responses, and
  there is one round deployed.

## Changed files

- `src/lib/services/manager-context.service.ts` — the option, the overloads,
  `ManagerContextWithoutAnalytics`, and the branch that skips.
- `src/lib/server/manager-context.ts` — the wrapper's overloads and the two
  widened helpers.
- `src/app/api/rounds/route.ts` and seven screens — the opt-out.
- New `src/lib/services/__tests__/asking-for-a-round-does-not-compute-a-map.test.ts`.
- `PROJECT_CONTEXT.md` ADR-045, `docs/critical-audit-2026-08-21.md`,
  `PROGRESS.md`.

Nothing in `docs/openapi.yaml`: `GET /api/rounds` returns the same body and the
same statuses. It is now the body it always claimed to return, computed without
the work it never needed.

## Exact Git state

See the commits on this branch. The only unstaged file is `next-env.d.ts`, which
is generated and belongs to the owner — stage with
`git add -A ':!next-env.d.ts'`.

## Verification evidence

### Passed

- `npm run verify:core` — exit `0`, zero `not ok`. Includes the production build:
  every screen still renders dynamically, so nothing became static by losing a
  read.
- `npm run test:e2e` — exit `0`, **24 passed**. Run because seven screens are in
  the diff. Two of them matter directly: `smoke.spec.ts:37` is "a manager signs
  in and the round screen reports its numbers", which is the screen whose
  `responseCount` now comes from a different source, and the five
  `tenant-boundary` tests walk the screens through the wrapper whose signature
  changed, including the administrator's audit record.
- `src/lib/services/__tests__/asking-for-a-round-does-not-compute-a-map.test.ts`
  — 7 tests. They count repository calls rather than time anything. On a closed
  round with no published copy the declining path reaches `getResponseCount`
  once and `findById`, `findPublishedAnalytics`, `findResponsesByRoundId` and
  `savePublishedAnalytics` **zero times**; the asking path reaches each of them
  once, which is asserted in the same test so the first assertion cannot pass on
  a product that stopped analysing anything.
- `npx tsc --noEmit` — clean, and deliberately made to fail once (decision 2
  above) to prove the omission is enforced rather than merely declared.

### Blocked or not run

- `npm run verify:db` — not run. No repository, schema or migration changed;
  the diff is services and screens. `verify:core` covers what moved.
- The Python suite — not run; nothing on that side changed.
- **No before/after timing.** See **Deliberately not done**.

### Environment

Local. No database beyond what `verify:core` and the Playwright web server bring
up themselves; nothing deployed was contacted.

### Residual risk

- **A screen that starts rendering the map must remember to stop declining.** It
  will not compile if it reads `context.analytics`, which is the whole design —
  but a screen that renders a map from some *other* source while holding a
  declining context would be a wrong screen that compiles. Nothing here can
  catch that, and nothing does it today.
- The eight declining callers were chosen by reading what each renders. That
  reading is now enforced by the compiler going forward, but the initial
  classification was mine.

## Next concrete step

Hand the owner the push, which is theirs to run:

```
git push origin perf/asking-for-a-round-does-not-compute-a-map:main
```

No migration, no configuration and no secret is involved; the deployment picks
this up as an ordinary build.
