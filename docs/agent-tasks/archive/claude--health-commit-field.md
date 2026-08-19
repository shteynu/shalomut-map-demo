# Core's health endpoint says which commit it runs

## Metadata

- Branch: `claude/health-commit-field`
- Base branch: `main`
- Base commit: `a3dd4fe`
- Current HEAD: `ca1c6c8`, merged into `main` (fast-forward — `main` had not
  moved since the base commit)
- Status: merged; unconfirmed on the deployed endpoint
- Last updated: 2026-08-19
- Last agent/tool: Claude Code

## Objective

Add a `commit` field to `GET /api/health`, so "is the deployed code the code I
just pushed?" can be answered against Core anonymously, the way it already can
against the AI service.

## User-visible outcome

None in the product. No screen, survey, analysis or database behaviour changes.
The change is on an anonymous operational endpoint.

## Context

Asked for directly after a deploy check ran into the limits of what this
container can see: outbound requests to `*.vercel.app` are refused by the
environment's network policy, and when the fallback plan was to read the
deployed commit from `/api/health`, the field turned out not to exist.

The AI service has reported `commit` on its own `/health` since it had one
(`ai-analytics-service/src/main.py`, reading `RENDER_GIT_COMMIT`), with the
stated reason that a consumer-first rollout has to be verifiable from outside.
Core never did, so every reading of a served Core commit in
`docs/shalomut-tracker-handoff.md` came from the Vercel dashboard in the
owner's signed-in Chrome — a sign-in, a different surface, and unavailable to
any agent.

## Scope

- `src/lib/deployment-commit.ts` — the resolver and the rule that decides what
  may be published.
- `src/app/api/health/route.ts` — the field on both the 200 and the 503 answer.
- `docs/openapi.yaml` and the generated `public/openapi.json`.
- Tests for both the rule and the endpoint.
- One paragraph in `docs/shalomut-tracker-handoff.md`, whose "Deployed state"
  section is the thing that stops needing a sign-in.

## Non-goals

- Reporting anything else about the deployment: branch, build time, deploy id,
  environment name. Each is a separate decision about what an anonymous caller
  learns, and none was asked for.
- Changing the AI service's `/health`. It already answers this question, and
  its `[:7]` truncation without a shape check is a difference worth noting
  rather than silently editing from a Core task — see Known risks.
- Adding `VERCEL_GIT_COMMIT_SHA` to `.env.example`. The platform sets it; that
  file is for values a person configures, and listing it there would invite
  someone to set it by hand and publish a commit the deployment is not running.

## Acceptance criteria

- A deployment whose `VERCEL_GIT_COMMIT_SHA` holds a real SHA reports its first
  seven characters, matching `git rev-parse --short=7`.
- A deployment that cannot prove a SHA reports `unknown` — present as a key,
  never absent, never an empty string.
- A value that is not a full 40-character hex SHA is never published, in whole
  or in part.
- The 503 answer carries the commit too.
- `npm run openapi:check` passes, so the published schema describes the field.

## Relevant repository instructions

- `AGENTS.md`: never expose respondent identity; current code outranks prose,
  and a living document that disagrees is fixed in the same task — which is why
  the handoff paragraph is in this diff rather than left for later.
- `.agents/skills/shalomut-verification/SKILL.md` selected the rows this diff
  actually touches: API surface, OpenAPI, lint and build. No Prisma schema, no
  Python, no AI contract, so those rows did not apply. `verify:db` was run
  anyway because it is seconds and the cluster was already up.

## Relevant architecture and contracts

- `src/lib/ai-contract-version.ts` is the pattern this follows: a resolver kept
  out of the route so it can be tested directly and so the route can report a
  problem rather than become one.
- That module states the rule this change had to work within, in as many words:
  *"this feeds a public endpoint, and echoing whatever a variable happens to
  hold is how a misplaced secret gets published."*

## Decisions made

- **The field is published only when the value is provably a commit SHA.** This
  is the whole design. `/api/health` is anonymous and its own doc comment
  promised that no variable's value is echoed; adding a field that echoes one
  needed that promise kept another way. `^[0-9a-f]{40}$` is exactly the shape of
  a Git SHA-1, so a value matching it can be nothing else.
- **Exactly forty characters, not "at least forty".** This repository generates
  its shared secrets with `openssl rand -hex 32` — sixty-four hex characters,
  which passes a lower bound and fails an exact one. A secret has no business in
  `VERCEL_GIT_COMMIT_SHA`, and the endpoint should not be the thing that assumes
  so. There is a test with a 64-character hex value asserting it stays unpublished.
- **`unknown`, not an omitted key and not an empty string.** A caller reading
  `body.commit` must be able to tell "this deployment cannot prove what it runs"
  from "this deployment has no such concept", and an absent key reads as the
  endpoint being older than the field.
- **`unknown` deliberately does not say why.** Local, unrecognised host, and
  malformed value all collapse to it. A caller comparing against `git rev-parse`
  learns the same thing from all three, and separating them would describe the
  deployment's own configuration to an anonymous caller.
- **Truncated to seven, like the AI service and like `git log --oneline`.** The
  two halves are meant to be compared by eye against the same `git` output.
- **On the 503 answer too**, resolved before the branch. Which revision is
  misconfigured is the first thing worth knowing about a misconfiguration, and
  that answer must not depend on the deployment being healthy enough to give it.
- **The handoff paragraph is worded so it is true before and after the deploy.**
  The capability lands with this commit; the endpoint does not have it until
  Vercel serves it, and a reading of `unknown` means exactly that.

## Assumptions

- Vercel sets `VERCEL_GIT_COMMIT_SHA` on deployments of this project. This is
  the documented platform variable and matches how the sibling service reads
  `RENDER_GIT_COMMIT`. It is assumed, not verified: this container cannot reach
  the deployment to confirm it, and the failure mode if it is wrong is a
  permanent `unknown` — visible, honest, and not a wrong commit.

## Completed

Everything in Scope. Implementation, tests, OpenAPI regeneration and the
handoff paragraph.

## In progress

Nothing.

## Remaining

Nothing on this branch. Merging is the user's call, separately.

## Changed files

- `src/lib/deployment-commit.ts` (new)
- `src/lib/__tests__/deployment-commit.test.ts` (new)
- `src/app/api/health/route.ts`
- `src/app/api/__tests__/health.test.ts`
- `docs/openapi.yaml`
- `public/openapi.json` (generated)
- `docs/shalomut-tracker-handoff.md`

## Verification evidence

### Passed

- `npm test` — 1201 passed, up from 1191: seven new resolver cases and three new
  endpoint cases.
- The three new rules were mutation-proven by hand before shipping, each
  reverted from a backup afterwards and the suite reconfirmed at 15/15:
  - `{40}` widened to `{40,}` → 3 failures, so the secret-length case is real.
  - the shape check deleted entirely → 3 failures.
  - `commit` removed from the 503 branch → 2 failures.
- The existing invariant test, `the response carries no configured value and no
  secret state`, was extended rather than left alone: it now runs with a
  64-character hex value in the commit variable and asserts it does not appear
  in the serialized body. Without that, the one field allowed to echo a variable
  would have been the one field that test did not cover.
- Runtime, local, with the variable set as the platform sets it:
  `VERCEL_GIT_COMMIT_SHA=a3dd4fe…ee2 npm run dev` → `"commit":"a3dd4fe"`, equal
  to `git rev-parse --short=7 HEAD`. Read both by `curl` and in Chromium.
- Runtime, local, with no variable at all → `"commit":"unknown"`.
- `npm run typecheck`, `npm run lint`, `npm run build` (44 routes) — clean.
  `next-env.d.ts` reverted after the build.
- `npm run openapi:check` — mirror check passed after regeneration.
- `npm run verify:db` — 36/36. `lint:mutation-config`, `lint:contract-refusals`
  and `lint:skills` all pass.

### Failed

None.

### Blocked or not run

- The deployed endpoint. This container's network policy refuses
  `shalomut-map-demo.vercel.app` (`403 to CONNECT`), by `curl` and by a real
  browser alike, so the field cannot be confirmed live from here. It is
  confirmed locally against the real runtime, which is the strongest evidence
  available in this environment.
- Python suite not run: the diff contains no Python.

### Environment

Local. The deployed environment was not reached or written to.

### Residual risk

Low, and concentrated in one assumption: if Vercel does not populate
`VERCEL_GIT_COMMIT_SHA`, the field reports `unknown` forever. That is visible on
the first read after deploy and is a wrong-looking answer rather than a wrong
answer. Nothing else on the endpoint changed, and no product path touches this
module.

## Failed approaches

None. The one design question — whether adding the field breaks the endpoint's
own no-echo promise — was answered by constraining the shape rather than by
accepting the trade.

## Known risks

The two halves now answer the same question by different rules. The AI service
truncates `RENDER_GIT_COMMIT` to seven characters without checking its shape, so
a non-SHA value there would be published as its first seven characters. Core
refuses it. Aligning them is a one-line change in `main.py` and belongs to a
task that is allowed to touch the AI service; it is recorded here rather than
done silently from a Core change.

## Approval gates

None. No credentials, secrets, deployment aliases or database state are touched.
The new field publishes a commit SHA from a public repository.

## Questions requiring an owner decision

- Whether the AI service's `/health` should adopt the same shape check (see
  Known risks). Small, and not this branch's to decide.

## Next concrete step

None on this branch. Merged into `main` as `ca1c6c8`.

The one thing that outlives it is a reading nobody has taken: whether the
deployed endpoint actually reports a SHA rather than `unknown`. That is the
assumption this branch could not verify from its own container, so it moves to
`shalomut-tracker-handoff.md` under what waits on the owner's hands — an
archived file cannot carry an open item.
