# The service proves its commit the way Core does

## Metadata

- Branch: `fix/the-service-proves-its-commit-the-way-core-does`
- Base branch: `main`
- Base commit: `e752081`
- Current HEAD: `e752081` plus uncommitted work at the time of writing
- Status: implementation complete, verified locally, not committed yet
- Last updated: 2026-08-19
- Last agent/tool: Claude Code (Opus 5)

## Objective

Close the two items the 2026-08-18 handoff left open around the `commit` field
on the two health endpoints:

1. Read Core's `commit` off the deployed `/api/health/` once, anonymously, and
   settle whether Vercel populates `VERCEL_GIT_COMMIT_SHA` on this project.
2. Align the AI service's `/health`, which truncated `RENDER_GIT_COMMIT` to
   seven characters without checking its shape — the known divergence recorded
   in `PROJECT_CONTEXT.md` ADR-023 and in
   `docs/agent-tasks/archive/claude--health-commit-field.md`.

## User-visible outcome

None in the product. Both anonymous health endpoints now answer the same
question by the same rule, and `unknown` means the same thing on either.

## Context

`ca1c6c8` gave Core's `/api/health` a `commit`, published only when
`VERCEL_GIT_COMMIT_SHA` is provably a Git SHA. That branch could not read the
deployment from its own container and recorded the platform-variable name as an
assumption. It also recorded, as a known risk, that the AI service publishes the
same field by a weaker rule and that fixing it belongs to a task allowed to
touch the service. This is that task.

## Scope

- `ai-analytics-service/src/deployment_commit.py` — new, the rule.
- `ai-analytics-service/src/main.py` — `/health` uses it; the now-unused `os`
  import goes.
- `ai-analytics-service/tests/test_deployment_commit.py` — new.
- `PROJECT_CONTEXT.md` ADR-023 — the divergence it records is closed.
- `ai-analytics-service/README.md` — the `/health` bullet says what `commit`
  publishes and under what rule.
- `docs/shalomut-tracker-handoff.md` — the deployed reading, and the open item
  it closes.

## Non-goals

- Not changing what either endpoint publishes besides the rule behind `commit`.
  The keep-alive monitor keys on `"status":"online"` in this body and must not
  be disturbed.
- Not touching `src/lib/deployment-commit.ts`. The reading confirmed it needs
  no change.
- Not extending the shape rule to any other field. ADR-023 binds the next field
  added; none is added here.

## Acceptance criteria

- A non-SHA in `RENDER_GIT_COMMIT` is never published, not even in part.
- A real SHA is published as its first seven characters, lowercase, matching
  `git log --oneline` and matching what Core publishes.
- The full Python suite stays green.

## Relevant repository instructions

- `AGENTS.md` — branch-scoped task state, mandatory progress handoff.
- `.agents/skills/shalomut-verification/SKILL.md` — the `ai-analytics-service`
  row of the selection matrix requires the full pytest run from the service
  directory, using `.venv/bin/python`.

## Relevant architecture and contracts

- `PROJECT_CONTEXT.md` ADR-023 — an anonymous endpoint publishes a variable
  only when its shape proves what it is. It now owns the rule for both halves.
- No wire contract, no schema and no versioned manifest is touched.

## Decisions made

- **A module and a test file, not the one-line change the risk note predicted.**
  A one-liner would have put the rule in the route, where the interesting cases
  are only reachable through an environment variable and a JSON body. Core kept
  the rule in `src/lib/deployment-commit.ts` for exactly that reason, and the
  two files are meant to read as one test.
- **The same forty-hex rule, not a shared one.** Two runtimes; a shared
  implementation would need a generated artefact to keep them equal, which is
  more machinery than a regex and a mirrored test. The tests carry the
  cross-reference so a change to one is visibly a change to only one.
- **The variable name stays `RENDER_GIT_COMMIT`.** It is what Render sets, and
  it is now a named constant instead of a string literal in the route, so the
  test and the endpoint cannot drift onto different names.
- **`unknown` still does not say why.** Local, unrecognised host and malformed
  value collapse to it, as on Core, and for the same reason.

## Assumptions

- Render populates `RENDER_GIT_COMMIT` with a full forty-character SHA. This
  was already true of the old code in the only way that mattered — every
  recorded `/health` reading in the handoff shows seven hex characters — and the
  new rule fails visibly rather than silently if it ever stops being true.

## Completed

Everything in Scope, plus the deployed reading:

- **`GET https://shalomut-map-demo.vercel.app/api/health/`, anonymous,
  2026-08-19:** `status: ok`, `commit: e752081`,
  `producedContractVersion: 6.0` from `configured`, producible `3.0`–`6.0`,
  supported `1.0`–`6.0`.
- **`git ls-remote origin refs/heads/main` at the same moment:**
  `e752081a3d466b19c64f8f1a0fff856725dacfb8`. Short form `e752081` — the served
  commit and the remote tip are the same revision.

## In progress

Nothing.

## Remaining

- Commit, and hand the push over. The push is an owner action here.
- The AI service side is not deployed by this branch. Render redeploys on its
  own build filter; until it does, `/health` there still answers under the old
  rule, which for a real SHA gives the same string.

## Changed files

- `ai-analytics-service/src/deployment_commit.py` (new)
- `ai-analytics-service/src/main.py`
- `ai-analytics-service/tests/test_deployment_commit.py` (new)
- `ai-analytics-service/README.md`
- `PROJECT_CONTEXT.md`
- `docs/shalomut-tracker-handoff.md`
- this file

`next-env.d.ts` is modified in the worktree and is not part of this task. It is
a Next.js-generated file that was already dirty at session start; left alone.

## Verification evidence

### Passed

- `.venv/bin/python -m pytest` from `ai-analytics-service` — **526 passed in
  5.74s**, provider keys stripped from the child environment so nothing reached
  a paid provider. The previous standing figure was 513; the thirteen new ones
  are this branch's.
- The targeted subset first: `tests/test_deployment_commit.py` with
  `tests/test_webhook_api.py` — 21 passed.
- `git diff --check` — clean.
- `py_compile` on both changed Python modules.
- The deployed reading above: the endpoint's answer and the remote's tip were
  compared as strings.

### Failed

- None.

### Blocked or not run

- No TypeScript changed, so `npm run typecheck`, `npm test`, `npm run lint` and
  `npm run build` prove nothing here and were not run.
- `npm run lint:skills` not run: no skill, adapter or root entrypoint is
  touched.
- No browser smoke: nothing user-visible changed.
- The AI service's deployed `/health` was not re-read after the change, because
  the change is not deployed.

### Environment

- Local, plus one anonymous read-only request against the deployed Core
  endpoint. No data was written anywhere.

### Residual risk

- If Render ever sets `RENDER_GIT_COMMIT` to something that is not a full SHA,
  `/health` starts answering `unknown` where it used to answer seven characters
  of that value. That is the intended trade and it is visible on the first read
  after deploy.
- The keep-alive monitor reads `"status":"online"` from this body and is
  untouched, but it is the reason no field here is ever renamed casually.

## Failed approaches

None.

## Known risks

- Two implementations of one rule can drift. The mitigation is the mirrored
  test and the cross-reference in both files; nothing enforces it mechanically.

## Approval gates

- None crossed. No credential, secret, alias or database state is touched, and
  the one outbound request was an anonymous GET to a public endpoint.

## Questions requiring an owner decision

- None. The one the archived Core branch left — whether the service should
  adopt the same shape check — was answered by the request that started this
  session.

## Next concrete step

Commit the work on this branch, then hand `git push origin
fix/the-service-proves-its-commit-the-way-core-does:main` to the owner.
