# Plain-language platform documentation, with English as the source

## Metadata

- Branch: `claude/free-ai-service-deploy-yk4tjj`
- Base branch: `main`
- Base commit: `d47a59c`
- Current HEAD: `6ae2f13`, contained in `origin/main` at `6ae2f13`
- Status: landed. Archived on 2026-08-18
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

- Nothing here. The screen the owner asked for is on `claude/manager-help-screen`
  with its own task file; this branch is documentation and changes no product
  behaviour, so the two merge independently and in that order.

## Changed files

- `docs/platform-handbook.md` — new.
- `docs/ai-analysis-run-lifecycle.md` — new.
- `docs/snapshots/README.md` — new.
- `docs/snapshots/platform-handbook.ru.md` — new.
- `docs/snapshots/platform-handbook.he.md` — new.
- `docs/README.md` — two living documents added, snapshots section added.

## Verification evidence

### Passed

- `npm run verify:core` — **exit 0** on this branch's own tip: every fitness
  check, `typecheck`, `npm test` (**1175 passing**), `verify:ai` (**496
  passing**), `lint` and the production build. It proves this branch breaks
  nothing rather than proving anything about the documents: the diff is Markdown
  and no check reads it.
- `npm run verify:db` — **exit 0**: **36 PostgreSQL tests**, after all fifteen
  migrations applied to an empty database in order. Same caveat, more strongly —
  nothing here touches the schema. The container has no Docker daemon, so
  `compose.yaml` could not be used; the cluster was PostgreSQL 16 from the image,
  initialised at `/var/lib/postgresql/verifydata` on port 5433 and stopped
  afterwards. No deployed or local development database was touched.
- `npm run lint:skills` — the check with an actual subject in this diff, since it
  sweeps the repository for undeclared agent entrypoint files: 28 passing.

### Failed

- None.

### Blocked or not run

- `npm run test:e2e` — not run. The pinned Playwright expects a browser build the
  image does not carry. Nothing in this diff is reachable from a browser, so the
  suite has no subject here either.

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

- None open. **Should the product carry its own documentation?** was asked here
  and answered on 2026-08-18: yes, as a manager-facing Hebrew help section, and
  explicitly **not** as this handbook — it names hosting providers, regions and
  queue mechanics that a principal has no use for. That work is
  `claude/manager-help-screen`, branched from this tip so the two land in order.

## Next concrete step

None — landed. What follows is the record of why, kept as written.

Merge this branch. It touches no file the application serves — `docs/` is not a
route and nothing in `src/app` reads it — so merging changes nothing a manager or
a respondent sees, and `deploy-vercel.yml` will redeploy an application that is
byte-identical in behaviour. The screen waits on its own branch for a
Hebrew-speaking reader.
