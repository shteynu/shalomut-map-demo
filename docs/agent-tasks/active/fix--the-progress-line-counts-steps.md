# The browser smoke was still reading questions off a line that counts steps

## Metadata

- Branch: `fix/the-progress-line-counts-steps`
- Base branch: `main`
- Base commit: `a8c8b81`
- Status: fix written and verified locally; not merged
- Last updated: 2026-08-15
- Last agent/tool: Claude Code (Opus 5)

## Objective

`Vercel Deployment & Pipeline Checks` went red on `main` at `25ee069` — run
`31879036499`, job `Build & Validate`, step `Smoke the manager and respondent
flow in a browser`. The deployment itself is healthy; what failed is the
Playwright step of that workflow.

## What actually broke

`6be8395` — the branch that made the respondent flow walk *steps* rather than
questions — changed the progress line's own words. It reads `שלב N מתוך M`
where it read `שאלה N מתוך M`, and on the review step `הושלמו N מתוך M` where it
read `נענו N מתוך M`. `e2e/respondent-answers.spec.ts:144` still asserted the old
wording, so the walk stalled on the second screen and both projects
(`chromium`, `mobile-chrome`) failed twice each.

**Why nothing caught it before the merge.** `verify-core.yml` runs on every
push of every branch and carries no browser — `verify:core` has no Playwright
in it. The browser smoke lives only in `deploy-vercel.yml`, which triggers on
`main` and on pull requests to it. The stack was fast-forwarded onto `main`
rather than opened as a pull request, so the first execution of this spec
against the new wording *was* the failing run.

## The fix

`e2e/respondent-answers.spec.ts` asserts the wording the product now uses, and
`readQuestionTotal` is `readStepTotal` — the number it reads off that line is a
step count. Its comment says why the loop below may still answer one question
per iteration: the seeded round has no block and no allocation grid, so each of
its steps is one question. A round with a block would need a different walk.

No product file changed. The spec was wrong about the product, not the other
way round.

## Verification that actually ran

- `npx playwright test e2e/respondent-answers.spec.ts` — **2 passed**,
  `chromium` and `mobile-chrome`, against a production build on port 3100 with
  the local database reseeded (`--reset`, organization `local-dev-organization`
  so the smoke's own manager sees the round).
- `npm run typecheck` and `npm run lint` clean.
- The failure itself is evidence from CI rather than reproduced by hand: the run
  log names both the expected pattern and the received string.
- The submission queues an AI run, as it does in CI. Checked rather than
  assumed: `ai_analysis_runs` holds it `queued` with `attempt_count` 0 and no
  worker, and no AI service URL is configured locally — so nothing reached a
  provider.

## Risks and things left

- The other seventeen browser tests passed in that same CI run and were not
  re-run locally.
- The gap that let this land is still open: a branch's Playwright suite runs
  only once the branch is on `main`. Worth a decision, not fixed here.

## Next concrete step

Push this branch to `main` — the owner's action — and read
`Vercel Deployment & Pipeline Checks` back green.
