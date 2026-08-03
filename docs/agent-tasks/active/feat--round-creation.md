# Creating a second round for a school

## Metadata

- Branch: `feat/round-creation`
- Base branch: `main`
- Base commit: `0fa9d3f`
- Current HEAD: see `## Changed files`; the branch is committed but not pushed
- Status: implementation complete, awaiting the owner's push
- Last updated: 2026-08-03
- Last agent/tool: Claude Code (Opus 5)

## Objective

Let a school open a second measurement round, which is what makes the round
switcher delivered by `feat/round-history-selection` worth using. Backlog
`docs/product-behaviour-backlog.md` §10, requirements document §5.5 and §8.1.

## User-visible outcome

From `/setup`, a manager whose school already has a round sees "פתיחת סבב חדש".
It opens `/setup?round=new`: the school's own details are prefilled, the round
fields are empty. Saving creates a draft round and the follow-up link goes to
that round's questionnaire builder, not the running round's. The draft goes live
once its questionnaire covers all eight dimensions, and going live closes the
round the school was running — the builder says which one.

## Context

`feat/round-history-selection` made every manager screen able to read a named
round (`?round=<id>`), with `round-not-found` rather than a silent fallback.
This slice adds the write side. Two rounds live at once would mean two live
share links for one staff room, so the owner's 2026-08-03 decision — one active
round per school — is enforced here for the first time.

## Scope

- A new-round mode for the setup screen and its form.
- Round-aware `/round` and `/survey` manager routes so a created round can be
  addressed directly.
- The single-active-round rule in `RoundService`, at both activation points.
- Naming the closed round in the survey builder.

## Non-goals

- Comparison across rounds (still §10 remaining).
- A database-level guarantee for the single-active-round rule.
- Deciding whether archived rounds belong in the switcher.

## Acceptance criteria

- Creating a second round never edits the first.
- The builder link after creation names the new round.
- Activating a round leaves exactly one active round for that school, and none
  of another school's rounds change.
- Closed and archived rounds are not reopened or altered.

## Relevant repository instructions

`AGENTS.md` skill routing (`shalomut-map`, `shalomut-tracker`,
`shalomut-verification`); branch-scoped task state; `git push` is the owner's
action in this environment.

## Relevant architecture and contracts

`PROJECT_CONTEXT.md` ADR-004 (round-scoped snapshots, fixed dashboard taxonomy)
and the new ADR-014 (one round at a time). No contract version is affected: this
slice changes no payload crossing the Core/AI boundary.

## Decisions made

- The new-round marker is `?round=new` rather than a separate path, so all
  manager screens keep one round parameter with one reader (`isNewRoundParam`).
- Absence of `round.id` in the setup PUT is what makes the write a creation, so
  the API needed no new mode flag.
- `activateRound` returns `{ round, closedRounds }`. An earlier shape made the
  route call `closeOtherActiveRounds` a second time, which always reported an
  empty list because the first call had already closed everything.
- The rule lives in the service, not the schema: the repository interface has no
  transaction primitive and a deployment has one manager, so concurrent
  activation is unreachable today. The durable form is recorded in ADR-014 and
  in the backlog's remaining list.

## Assumptions

- A new round starts with an empty questionnaire rather than copying the
  previous one. Copying is a plausible next convenience, not a requirement.

## Completed

All of the scope above, with tests.

## In progress

Nothing.

## Remaining

Nothing on this branch. `docs/product-behaviour-backlog.md` §10 keeps
cross-round comparison, the archived-rounds question and the partial unique
index.

## Changed files

- `src/lib/navigation.ts`, `src/lib/__tests__/navigation.test.ts` —
  `NEW_ROUND_PARAM`, `isNewRoundParam`, `setupRoute`, `newRoundSetupRoute`,
  `surveyBuilderRoute`, `roundTrackingRoute`.
- `src/app/setup/page.tsx` — new-round mode, `canOpenNewRound`.
- `src/components/round/setup-form.tsx` — empty round fields, creation PUT,
  builder link naming the created round, new-round copy.
- `src/app/round/page.tsx`, `src/app/survey/page.tsx` — read `?round=`.
- `src/lib/services/round.service.ts` — `activateRound`,
  `closeOtherActiveRounds`, and `createAndSaveRound` closing a previous round
  when the created round is born active.
- `src/app/api/rounds/[roundId]/survey-definition/route.ts` — activation through
  `RoundService`, `closedRoundTitles` in the response.
- `src/components/survey/survey-builder.tsx`,
  `src/components/survey/survey-builder/survey-builder-sidebar.tsx` — a Hebrew
  `role="status"` note naming the round that stopped running.
- `src/lib/services/__tests__/round-activation.service.test.ts` — new, 5 cases.
- `PROGRESS.md`, `PROJECT_CONTEXT.md` (ADR-014),
  `docs/product-behaviour-backlog.md` §10.

## Verification evidence

### Passed

- `npm run verify:core` (lint:literals, lint:composition, typecheck, tests,
  eslint, build): passed, 455 TypeScript tests.
- Browser, against the local dev server and the owner's authenticated session:
  - `/setup` offers "פתיחת סבב חדש" → `/setup/?round=new`.
  - The new-round form prefills the school fields and empties the round fields.
  - Submitting created a draft and rendered "המשך לבניית שאלון" →
    `/survey/?round=25a163b5-2789-4f6f-b04a-a32cb3a4cae8`.
  - `PUT` of a complete 24-question definition returned
    `{"ok":true,"questions":24,"status":200,"closedRoundTitles":["סבב סתיו 2026"]}`.
  - The dashboard then listed three rounds: `סבב חורף 2027` active, the other
    two closed.
  - `/survey?round=<id>` opened the requested round rather than the active one.

### Failed

None.

### Blocked or not run

- Mobile-viewport check: `resize_window` did not change `window.innerWidth`
  (stayed 1728), so responsive behaviour of the new setup screen is unverified.
- `npm run verify:db` and `npm run verify:ai` were not run; this slice touches
  no schema and no AI payload.

### Environment

Local: `next dev` on `:3000`, Docker PostgreSQL on `127.0.0.1:5433`. The rounds
`סבב סתיו 2026` and `סבב חורף 2027` are disposable test data created during this
verification.

### Residual risk

Two activations racing could leave two active rounds. Not reachable with one
manager per deployment; the durable fix is the partial unique index.

## Failed approaches

Branched from the stale local `main` (`8e1906e`) instead of `origin/main`
(`0fa9d3f`), which briefly reverted the working tree and left the dev server
serving CSS built without the round-switcher rules. Fixed with
`git checkout -B feat/round-creation origin/main` and a preview-server restart;
the unrelated `.idea` modification was preserved throughout.

## Known risks

None beyond the residual risk above.

## Approval gates

`git push` is blocked for the agent in this environment. The branch is committed
and waiting on the owner.

## Questions requiring an owner decision

The numbering collision in `docs/product-behaviour-backlog.md`, raised in a
previous thread, was never described concretely and is still unresolved. It is
documentation-only.

## Next concrete step

Owner runs:

```bash
git push origin feat/round-creation:main
```
