# The consent screen stops promising what the deployment cannot keep

## Metadata

- Branch: `fix/consent-tells-the-truth`
- Base branch: `main`
- Base commit: `743c362`
- Current HEAD: `93e3baa`, one commit.
- Status: complete and verified locally. Waits on a push.
- Last updated: 2026-08-10
- Last agent/tool: Claude Code (Opus 5)

## Objective

Close the part of axis 1 of `docs/product-strategy-axes-2026-08-10.md` that is
an engineering fact rather than a legal question: the consent screen made a
promise about the whole system that only held for the application code.

## User-visible outcome

A teacher reads five promises instead of three. Two are new: what happens to
their IP address, and that a third-party language model writes the analysis from
question-level averages.

## Non-goals

- No legal document. Whether the Chief Scientist directive permits the pilot,
  and what Amendment 13 requires, stay with the owner.
- No privacy-policy route in the product. The artifact is a repository document,
  because the audience for it today is whoever writes the school's agreement.

## Decisions made

- **Describe the address rather than deny it.** The alternative — dropping the
  IP sentence entirely — would have left the strongest reassurance on the screen
  unexplained, and a respondent who later learns that a hosting edge logs
  addresses would read the silence as the same lie.
- **Disclose the model, and what crosses to it.** Naming a processor without
  naming the payload tells a respondent nothing. `analytics-encoder.ts` is what
  makes the sentence checkable.
- **Tests as refusals.** The regression worth catching is a future edit that
  widens a guarantee, not a typo, so the assertions are written against what the
  screen may not say.

## Completed

- `src/components/survey/survey-consent-step.tsx` — five promises.
- `src/components/survey/__tests__/consent-promises.test.tsx` — three tests.
- `docs/data-flow-and-subprocessors.md` — parties, boundaries, regions, and what
  does not exist (no retention rule, no meaningful respondent deletion route).
- `docs/README.md` — the new document listed as a living source of truth.

## Verification evidence

### Passed

- `npm test` — 811 tests, 0 failures.
- `npm run typecheck`, `npm run lint`, `npm run build`.
- `npx playwright test e2e/` — 9 passed.
- The screen walked at 390px on the local stack: five promises render, each with
  its icon, and the manager's own note stays visually below them.

### Blocked or not run

- Nothing deployed was touched. `verify:db` and `verify:ai` were not run: no
  schema, contract, prompt or version changed.

## Known risks

The manager-authored `anonymityText` still renders on the same screen and can
contradict the promises above it. The test pins that it cannot join them; it
cannot stop a manager from writing something wrong beneath them.

## Approval gates

`git push origin fix/consent-tells-the-truth:main` is the owner's to run.

## Next concrete step

Push this branch, then `feat/the-product-is-watched`, which is based on it.
