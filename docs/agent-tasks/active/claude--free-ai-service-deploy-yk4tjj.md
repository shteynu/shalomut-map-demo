# Plain-language platform documentation, with English as the source

## Metadata

- Branch: `claude/free-ai-service-deploy-yk4tjj`
- Base branch: `main`
- Base commit: `d47a59c`
- Current HEAD: `d47a59c` before this commit
- Status: documentation delivered; one owner decision open (§ Questions)
- Last updated: 2026-08-18
- Last agent/tool: Claude Code

## Objective

Give the project one plain-language description of the whole platform that a
non-developer can read, keep the English text in `docs/` as its only source, and
release the Russian and Hebrew versions as dated snapshots rather than as copies
expected to stay aligned by themselves.

## User-visible outcome

A reader who does not use Git can be handed one document — in English, Russian or
Hebrew — and understand what the product does, how a round works, what privacy
actually guarantees, how an analysis is ordered, what the model does and does not
decide, and where the system runs. A developer gets the same run mechanics with
real endpoint names in a separate file.

## Context

The branch started as a question about free or cheap hosting for the AI service
(answer: the current Render free plan plus an external uptime monitor is already
the cheapest working option; Render Starter at $7/mo is the one-line change that
removes sleep, 502 windows on deploy and the need for the monitor). No hosting
change was made. The work then moved to documentation at the owner's direction.

Owner decisions taken during the session, in order:

1. Documentation should live somewhere reachable without the repository.
2. Confluence is not connected to this environment; a published page and a Google
   Doc were produced instead as reading copies.
3. English text in `docs/`, with Russian and Hebrew as released snapshots.

## Scope

- `docs/platform-handbook.md` — English source, plain language, twelve sections.
- `docs/ai-analysis-run-lifecycle.md` — implementation-level companion for the
  durable run: sequence and state diagrams, constants, endpoint surface.
- `docs/snapshots/` — the release rule plus the Russian and Hebrew snapshots.
- `docs/README.md` — both new living documents indexed, snapshots explained.

## Non-goals

- No product, code, schema or configuration change. Nothing in `src/`,
  `ai-analytics-service/`, `prisma/` or `render.yaml` is touched.
- No hosting migration and no change to `plan: free` in `render.yaml`.
- No in-product documentation UI. That is the open question below.
- No attempt to synchronise the external reading copies automatically; the
  snapshot rule exists precisely because that is not possible here.

## Acceptance criteria

- The English handbook describes only behaviour that exists today, and says so
  where a plan is not implemented.
- Every claim in it is traceable to code, schema, contracts or a recorded owner
  decision rather than to another prose document alone.
- The snapshots carry their release date and name their source.
- `docs/README.md` tells a reader which of the three is the original.

## Relevant repository instructions

- `AGENTS.md` — documentation lifecycle: living docs must be corrected in the
  same task when they disagree with code; historical plans are not rewritten.
- `.agents/skills/shalomut-map/SKILL.md` — canonical product boundaries.
- `.agents/skills/shalomut-tracker/SKILL.md` — source priority, this task file.
- `.agents/skills/shalomut-verification/SKILL.md` — verification proportional to
  the diff.

## Relevant architecture and contracts

Read for accuracy while writing: ADR-001 to ADR-022 in `PROJECT_CONTEXT.md`;
`contracts/scoring-bands.json` and `contracts/ai-analytics-v2.json` for the bands
and the eight dimension ids; `prisma/schema.prisma` for `AiAnalysisRun`,
`SurveyResponse`, `SurveyAttempt` and `QuestionAnswer`;
`src/lib/server/ai-analysis-worker.ts`, the three `ai-analysis-runs` routes and
`src/lib/repositories/prisma/prisma-ai-analysis-run.repository.ts` for the lease
mechanics; `ai-analytics-service/src/` for the pipeline, transport and sink;
`docs/data-flow-and-subprocessors.md` for the subprocessor table.

## Decisions made

- **English is the source, translations are dated snapshots.** Owner decision.
  Recorded as a rule in `docs/snapshots/README.md` so the next agent does not
  "helpfully" edit a translation.
- **The technical diagrams are a separate document** rather than an appendix to
  the handbook. The handbook's readers are not its audience, and mixing them
  would put endpoint names in a document written to avoid them.
- **The webhook path is documented as deliberately absent** from every diagram,
  with the reason, rather than omitted silently.

## Assumptions

- The 126-item research instrument is treated as **not implemented**, per
  `docs/default-research-instrument-plan-2026-08-14.md` and the current default
  of 24 statements in `src/lib/shalomut-source.ts`. The handbook describes the
  24-question default and describes background questions as a supported question
  kind rather than as the live questionnaire.
- Snapshot headers name their release date and their source document rather than
  a commit hash, because the hash of the commit introducing them is not knowable
  from inside it.

## Completed

- All four documents written and indexed.

## In progress

- Nothing.

## Remaining

- Owner decision on an in-product documentation UI (see Questions).
- If that decision is yes, a separate task and branch: this one is docs-only.

## Changed files

- `docs/platform-handbook.md` — new.
- `docs/ai-analysis-run-lifecycle.md` — new.
- `docs/snapshots/README.md` — new.
- `docs/snapshots/platform-handbook.ru.md` — new.
- `docs/snapshots/platform-handbook.he.md` — new.
- `docs/README.md` — two living documents added, snapshots section added.

## Verification evidence

### Passed

- `npm run lint:skills` — the skills sweep, which also fails on undeclared agent
  entrypoint files anywhere in the repository. Run because this diff adds
  documentation files; recorded with its actual result at commit time.

### Failed

- None.

### Blocked or not run

- `npm run verify` and `npm run verify:core` — not run. The diff is Markdown
  only: no TypeScript, Python, schema, contract or configuration file is
  touched, so typecheck, tests, build, database and Python suites have no
  subject in it. This is a deliberate proportionality call, not an omission.
- `npm run openapi:check` — not run, for the same reason: `docs/openapi.yaml` is
  untouched.

### Environment

- Local repository only. No deployment, no database and no external service was
  contacted for this change.

### Residual risk

- Prose can drift from code without any check failing. Nothing in the repository
  verifies that the handbook still describes current behaviour; the mitigation is
  the documentation lifecycle rule in `AGENTS.md`, not a script.
- Two reading copies exist outside the repository (a published page and a Google
  Doc). They are copies of the Russian snapshot and will age independently. The
  snapshot rule names them as copies; nothing enforces it.

## Failed approaches

- Automatic synchronisation between the repository and the external Google Doc
  was investigated and rejected as impossible here, not merely unwise: the
  available Drive tooling can create a document and change its title or folder,
  but cannot replace the content of an existing one. Any "sync" toward Docs would
  create a new document and discard the comments on the old one.

## Known risks

- The Hebrew snapshot has not been reviewed by a Hebrew-speaking reader. It is a
  translation produced with the source, and product-facing Hebrew copy elsewhere
  in the repository is reviewed rather than generated.

## Approval gates

- None consumed. No secret, credential, alias or deployment configuration was
  touched.

## Questions requiring an owner decision

1. **Should the product carry its own documentation screen?** Raised by the owner
   at the end of the session. The recommendation recorded here is that the
   handbook itself must **not** be that screen: it names hosting providers,
   regions, free plans and internal mechanics that a principal has no use for and
   that do not belong in a product surface. What could be justified is a much
   smaller Hebrew help section for managers — what the threshold means and why a
   result is locked, how a stone gets its colour, what the AI does and does not
   decide, what closing a round triggers — written in product voice, RTL, and
   linked from the screens that raise those questions. That is product scope with
   routes, copy, accessibility, tests and e2e coverage, and belongs on its own
   branch with its own task file.

## Next concrete step

Answer question 1. If the answer is a manager-facing help section, open a new
branch and task file for it; if the answer is no, this branch is complete and can
be merged as documentation only.
