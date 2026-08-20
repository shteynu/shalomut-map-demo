# Documentation sync audit before the multi-tenancy feature

## Metadata

- Branch: `docs/the-handoff-stops-being-a-journal`
- Base branch: `main`
- Base commit: `17792be`
- Final commit: `6d6ec97`
- Status: complete, merged and archived. Reached `main` on 2026-08-20.
- Last updated: 2026-08-20
- Last agent/tool: Claude Opus 5 (Claude Code)

## Objective

Bring the documentation into a consistent state before the multi-tenancy feature
begins, and establish by verification rather than by prose which claims were
already out of step.

## User-visible outcome

None. No product code changed; the one source edit is a comment.

## Context

The owner opened the session with "приведём документацию в порядок, проверим что
всё синхронизировано перед началом большого фичера мультитенанси". The branch it
started from, `feat/an-idle-worker-asks-less-often`, was fully merged into
`origin/main` and both of its task files were already archived.

## Scope

Living documents, the documentation index, `.env.example`, and the operational
handoff. One code comment that stated the opposite of the code.

## Non-goals

- Any multi-tenancy implementation. This task only reports what that feature will
  have to change.
- Rewriting dated plans or archived task files.

## Acceptance criteria

- Every document under `docs/` and every root document is classified by
  `docs/README.md`.
- No living document states a fact that the code contradicts.
- The handoff is a snapshot rather than a journal, and its first paragraph is
  current.
- The automated gates still pass.

## Relevant repository instructions

`AGENTS.md`, `.agents/skills/shalomut-tracker/SKILL.md` (source priority, memory
boundaries, save-progress), `.agents/skills/shalomut-verification/SKILL.md`.

## Decisions made

- **The hand-maintained `Updated: <date>` line is removed, not reset.** In
  `PROJECT_CONTEXT.md` it had read `2026-08-04` across twenty-four consecutive
  commits to that file, including every ADR from 013 to 024; `PROGRESS.md`,
  `ROADMAP.md`, `docs/ai-analytics-handoff.md`,
  `docs/product-behaviour-backlog.md` and `docs/ai-contract-version-matrix.md`
  all drifted the same way. Resetting each to today would restart the failure on
  the next commit. Where the surrounding sentence was worth keeping it now names
  `git log -1 -- <file>`; where the stamp was the whole line, the line is gone.
- **`AI_SERVICE_TIMEOUT_MS` is removed from `.env.example` rather than
  documented.** Nothing in the repository reads it. It is still set on Vercel,
  which is harmless, and the handoff records that it can be deleted there.
- **The handoff was compacted, and the pre-compaction file was snapshotted.**
  Deciding which sentences were durable is a judgment call, so the whole file is
  preserved byte-for-byte under
  `docs/archive/documentation-snapshots/2026-08-20-handoff-compaction/`, the
  mechanism `docs/README.md` already names.

## Assumptions

- Core is expected to have followed `origin/main` to `17792be` and the AI service
  to have stayed on `e69a5eb`, because nothing since that commit touches
  `ai-analytics-service/**`. **Neither was read this session** — both are
  inferences from the rules in the handoff, and they are written there as such.

## Completed

- `5cb5e19` — the stale date stamps in six living documents.
- `afc46f5` — `.env.example` loses a dead setting and gains the live one; three
  comments that had stopped being true are corrected, one of them in
  `src/lib/server/request-question-suggestion.ts`; `docs/README.md` gains the
  three documents its index did not classify.
- `a07a77d` — the handoff compacted from 3116 lines to 516, with the original
  snapshotted; the stale branch citation in `docs/ai-analysis-jobs.html` fixed.
- `6d6ec97` — this record.

## In progress

Nothing.

## Remaining

Nothing. The branch reached `origin/main` on 2026-08-20 as `6d6ec97`.

## Changed files

`PROGRESS.md`, `PROJECT_CONTEXT.md`, `ROADMAP.md`, `.env.example`,
`docs/README.md`, `docs/ai-analytics-handoff.md`,
`docs/ai-contract-version-matrix.md`, `docs/product-behaviour-backlog.md`,
`docs/ai-analysis-jobs.html`, `docs/shalomut-tracker-handoff.md`,
`docs/archive/documentation-snapshots/2026-08-20-handoff-compaction/**`,
`src/lib/server/request-question-suggestion.ts` (comment only).

## Verification evidence

### Passed

Run on the final tree at `a07a77d`:

- `npm test` — **1219 passed**, 0 failed, 19 suites.
- `npx tsc --noEmit` — clean.
- `npm run lint` — clean.
- `npm run lint:skills` — 3 canonical skills, 4 declared entrypoints.
- `npm run lint:doc-numbers` — 17 claims across 3 documents.
- `npm run docs:endpoints:check` — 12 endpoints.
- `npm run openapi:check` — mirror matches.
- Every relative link in the rewritten handoff resolves, and every code anchor it
  names was checked to exist: `verifyAiResultAgainstRound`,
  `ai_deterministic_metric_narrative_ratio_sample`, `regenerate_dimension_ids`,
  `provider_rate_limiter`, `AI_JOB_POLL_MAX_INTERVAL_SECONDS`,
  `LLM_REASONING_EFFORT`, `ai-analytics-service/tests/test_provider_health.py`,
  `.github/workflows/browser-smoke.yml`'s concurrency group, `render.yaml`'s
  `buildFilter` paths and `AI_JOB_POOL_SIZE: "1"`, and the non-empty-only
  password check in `src/lib/auth/manager-auth-service.ts`.
- The snapshot is byte-for-byte identical to the pre-compaction file (`cmp`).

### Failed

None.

### Blocked or not run

- `npm run verify:db` and `npm run verify:ai` — not run and not needed: no schema,
  repository, contract or Python file is in this diff.
- `npm run build` — not run. No code path changed; the one source edit is a
  comment, and `tsc` and ESLint both cover the file.
- No deployed reading was taken. Nothing in this diff can be deployed.

### Environment

Local worktree only. No provider call, nothing billed, no database touched.

### Residual risk

The compaction dropped session narrative by judgment. If a durable fact was lost,
it is in the snapshot directory and in `git show 17792be:docs/shalomut-tracker-handoff.md`.

## Failed approaches

Rewriting the `Updated:` stamps with today's date was the first move and was
abandoned once the Git history showed the field had never once been maintained
correctly in `PROJECT_CONTEXT.md`.

## Known risks

None to the product. This branch changes no behaviour.

## Approval gates

None new. The nine open gates are in `docs/shalomut-tracker-handoff.md`; the most
current is the `GEMINI_API_KEY` rotation.

## Questions requiring an owner decision

None from this task.

## Findings the multi-tenancy feature will have to act on

Four documents jointly declare "one manager per deployment" a deliberate decision
and name **multi-tenant hosting** as the exact trigger that reopens it. Starting
the feature means changing them in the same task rather than discovering them one
at a time:

- `PROJECT_CONTEXT.md` ADR-013 — the trigger is "a second manager, multi-tenant
  hosting or real respondents, whichever arrives first".
- `docs/product-behaviour-backlog.md` §8 — carries the proposal (persist
  `Manager` and `OrganizationMembership`, a real credential with a memory-hard
  KDF or an identity provider, strength enforced where a password is *set*,
  invitation/revocation/recovery with Hebrew RTL screens).
- `ROADMAP.md`, "Conditional, not scheduled" — the long-term identity model.
- `PROJECT_CONTEXT.md` ADR-020 — the school-choice layer was built for this:
  "When memberships become real, this is the layer that starts consulting them;
  nothing above it has to move."

Two smaller ones in the same area: password-strength enforcement already exists,
written and withdrawn, on the local-only branch `fix/manager-password-must-be-strong`
(backlog §8 is its record if the branch is lost); and
`MANAGER_ORGANIZATION_ID` is currently a session's default rather than a binding.

## Next concrete step

None. The branch is merged and this file is archived. The findings below were
taken up by `docs/multi-tenancy-plan-2026-08-20.md`, which is where the
multi-tenancy work continues.
