# The 2026-08-21 audit gets a file in the repository

## Metadata

- Branch: `docs/the-audit-of-2026-08-21-gets-a-file`
- Base branch: `docs/the-tenancy-spec-landed`, which is itself based on `main`
- Base commit: `0a56f8c` (unpushed; `origin/main` is `68ec755`)
- Current HEAD: the commit carrying this file
- Status: done; awaiting the owner's push
- Last updated: 2026-08-22
- Last agent/tool: Claude Code (Opus 5)

## Objective

Put the 2026-08-21 critical audit into the repository, so that its open
findings survive the session and the artifact that were its only copies.

## User-visible outcome

None. This is documentation.

## Context

The audit ran on 2026-08-21: six independent readers over six axes, an
adversarial agent trying to refute each finding against specific lines, and a
completeness critic looking for missed classes. Its one critical finding — an
open round republishing its aggregates on every read — was fixed the same
evening in `648465c..66707ae`.

The other findings were never written down anywhere Git could see. What the
repository held was a single sentence in the archived task file: *"The audit's
other 56 findings are untouched by this branch."* That sentence names a count
and no finding, so an agent reading it could neither act on the audit nor check
it. The findings themselves lived in the session transcript and in a private
published artifact — neither of which is a backup, and both of which outlive
nothing.

## Scope

- `docs/critical-audit-2026-08-21.md` — the restored audit.
- `docs/README.md` — one entry under "Historical plans and evidence".
- `docs/shalomut-tracker-handoff.md` — the next-step paragraph, which said no
  substantial work was startable.

## Non-goals

- Fixing anything the audit found. Every finding is open and none has an owner
  decision behind it.
- Re-running the audit. This restores what was produced on 2026-08-21; a fresh
  audit would be a different document against a different tree.
- Re-verifying all fifty findings. The seven high ones were re-read; the medium
  and low ones were not, and the document says so.
- Translating it. The audit was written in Russian and is preserved in Russian.

## Acceptance criteria

- Every finding in the artifact reaches the document — no silent truncation.
- The document states which findings still hold and which do not, and never
  presents a 2026-08-21 line number as a current one.
- A reader who has never seen the artifact can act on a finding without it.

## Relevant repository instructions

- `AGENTS.md`: do not rewrite dated plans as if they were current; preserve them
  as historical evidence. Hence a dated document with an explicit snapshot
  commit, registered under "Historical plans and evidence" rather than as a
  living source.
- `AGENTS.md`: never store chats, hidden reasoning or private AI session URLs in
  repository documentation. The artifact URL is the owner's own published page
  and is cited as the source; no transcript or session URL is copied.

## Decisions made

- **Restore, not re-derive.** The artifact still existed, so re-running an audit
  would have produced a different document and quietly lost the original's
  findings. `WebFetch` on the artifact URL saves the full HTML locally, and the
  document was converted from that file rather than from a model's summary of
  it — a summary would have dropped findings without saying which.
- **Russian, and said so in the file.** The repository's prose is English. A
  translation of fifty findings restates evidence instead of restoring it, and
  every mistranslated mechanism becomes a false anchor. The document opens by
  naming the exception and why it is one.
- **The counts are reported as they are, contradiction included.** The
  artifact's own tally tiles say 1/9/24/18 = 52; its body carries 1/7/22/20 =
  50; its method line says 57 of 62 raw findings survived with duplicates
  merged. The document tabulates both and states which one it counted, rather
  than picking a number and presenting it as settled.
- **The seven high findings were re-read, the rest were not.** Verifying fifty
  findings is a second audit. The high ones are what someone will act on first,
  so they were checked at `0a56f8c` and the document carries a table of old
  anchor against re-read line. The medium and low ones say plainly that their
  first step is to re-read their own lines.
- **Registered as dated evidence, not a plan.** No owner decision stands behind
  any finding, and three are flagged by the artifact itself as found by the
  completeness critic without adversarial verification.

## Assumptions

- The artifact will not be edited or deleted in a way that changes what was
  restored; the document records its URL and the restoration date, so a future
  divergence is visible rather than silent.

## Completed

Everything in Scope.

## In progress

Nothing.

## Remaining

Nothing. The owner pushes.

## Changed files

Added: `docs/critical-audit-2026-08-21.md`,
`docs/agent-tasks/active/docs--the-audit-of-2026-08-21-gets-a-file.md`.

Modified: `docs/README.md`, `docs/shalomut-tracker-handoff.md`.

Not this task's: `next-env.d.ts` is generated and belongs to the owner.

## Verification evidence

### Passed

- **Nothing was lost in conversion, counted against the source HTML.** The
  artifact body holds 1 callout, 14 cards and 39 compact rows; the document
  holds 1 + 14 + 39. The first two conversion attempts silently dropped the last
  row of every pack and all four dismissed rows — found by comparing counts
  against the HTML rather than by reading the output, and fixed before the file
  was written.
- **The critical finding is closed in the tree**, not only in the handoff:
  `isRoundCollecting(round.status)` at `src/lib/services/analytics.service.ts:351`.
- **All seven high findings re-read at `0a56f8c` and all still hold** —
  `analytics.service.ts:441/449`, `manager-administration-service.ts:166`,
  `ai_job_worker.py:94/103`, `prisma-round.repository.ts:156/167`,
  `rounds/[roundId]/route.ts:79/81`, `ai-insights-service.ts:57/66`,
  `package.json:10` plus zero occurrences of `migrate` in
  `.github/workflows/deploy-vercel.yml`. The table in the document is that
  reading.
- `npm run lint:doc-numbers` — exit 0.
- `npm run lint:skills` — exit 0.

### Failed

None.

### Blocked or not run

- The twenty-two medium and twenty low findings were not re-verified. Named as
  a limitation in the document itself rather than left for a reader to discover.
- No test, typecheck, build or browser check was run: the diff is four
  documentation files and touches no code.
- Nothing on the deployed endpoint; there is nothing there to check.

### Environment

Local worktree only. The artifact was read over the network through the owner's
own claude.ai session.

### Residual risk

Low. The risk that remains is a reader treating a medium or low finding's
2026-08-21 line number as current; the document says three times that they are
not, and the anchors are cited as evidence to re-read rather than as locations.

## Failed approaches

- **Searching the session transcripts for the findings.** `57 findings`,
  `56 findings` and a verbatim phrase from the critical finding all returned no
  matching session — the audit's content is in an artifact, not in searchable
  transcript text. Reading the sessions list and then the one session named
  «Критическая оценка системы» is what named the artifact.
- **Regex row extraction with a lookahead on `<div class="row ` (with a
  trailing space).** Dropped every dismissed row, because those are
  `class="row"` with no severity, and dropped each pack's last row. Splitting on
  the row boundary instead of matching to a lookahead fixed both.

## Known risks

The audit is now a standing list of open technical work with no owner decision
behind any item. The risk is that an agent treats it as a queue and starts
implementing. Both the document and the `docs/README.md` entry say it is not for
implementation.

## Approval gates

None. Unchanged: `GEMINI_API_KEY` awaits the owner's rotation.

## Questions requiring an owner decision

- Which of the seven high findings, if any, becomes work. They are ranked by the
  audit's own severity, not by the owner's priorities, and several are cheap
  (the pg pool, the redundant index) while others are architecture (persisted
  analytics, migrations in the deploy path).

## Next concrete step

`git push origin docs/the-audit-of-2026-08-21-gets-a-file:main` — the owner's
action. It carries the `docs/the-tenancy-spec-landed` commit `0a56f8c`
underneath it, so this one push lands both and the other branch needs no push of
its own. No deploy check is needed: documentation only, no runtime change.
