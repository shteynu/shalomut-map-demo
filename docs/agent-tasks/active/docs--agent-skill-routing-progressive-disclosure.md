# Agent skill routing: trigger plus relevant section, one canonical set

## Metadata

- Branch: docs/agent-skill-routing-progressive-disclosure
- Base branch: main
- Base commit: 42e93ce
- Current HEAD: `23e7932`, one commit on this branch, not pushed
- Status: complete and committed; waits only on the owner’s push
- Last updated: 2026-08-12
- Last agent/tool: Claude Code (Opus 5)

## Objective

Cut the mandatory reading budget `AGENTS.md` imposes on every agent, without
weakening any rule and without letting the canonical skill set fragment per
client. Two defects were in scope:

1. `AGENTS.md` routing ordered each matching `SKILL.md` to be read *fully*. That
   is the one instruction that cannot mean the same thing to a client with
   automatic skill discovery and a client that direct-reads.
2. `shalomut-map/SKILL.md` ordered unconditional full reads of
   `docs/source-of-truth.md`, `docs/README.md`, `PROJECT_CONTEXT.md` and
   `docs/shalomut-tracker-handoff.md`, contradicting `shalomut-tracker`, which
   already required section-scoped loading.

## User-visible outcome

None. Agent instructions and one new lint; no runtime behaviour changes.

## Context

Measured on `42e93ce`: the three skills were 10,040 + 15,914 + 15,464 = 41,418
bytes, all ordered read in full, and `shalomut-map`'s trigger is a catch-all, so
nearly every task paid at least its 10,040 plus `AGENTS.md`'s 6,303. The
documents it ordered added 9,596 + 6,056, and for any runtime/API/persistence
task a further 33,392 + 69,554.

Owner constraint for this task: the principle that every agent uses one and the
same set of skills must survive the change.

## Scope

`AGENTS.md`; the three `.agents/skills/*/SKILL.md`; two new `references/` files;
`CLAUDE.md` and `.github/copilot-instructions.md`; a new `lint:skills` check
wired into `verify:core`.

## Non-goals

- No relocation of `.agents/skills/` — it is Codex CLI's native path and a
  documented fallback for other clients.
- No per-client copy of any skill, including a `.claude/skills` copy.
- No change to any product rule, invariant, safety gate or verification
  obligation.

## Acceptance criteria

- Every rule reachable before the change is still reachable after it.
- No invariant moved into conditionally-loaded material.
- Discovery and direct-read clients follow the same reading map.
- The two canonical skills no longer contradict each other on context loading.
- The one-canonical-set rule is checked by a script, not only asserted.

All five met; see Verification evidence.

## Decisions made

- The reading contract lives in each skill, not in `AGENTS.md`. That is what
  makes discovery and direct-read clients converge.
- Only conditional material moved to `references/`; invariants stay in the
  always-loaded body.
- Extraction limited to two files. More files mean more drift surface, and this
  repository has one maintainer.
- `AGENTS.md` alone states how much of a skill to read. `CLAUDE.md` and
  `.github/copilot-instructions.md` point at it rather than restating it, so the
  contract has one home.
- The measured win is not where the plan expected it. See Residual risk.

## Assumptions

- Section-scoped loading was already the intended behaviour, because
  `shalomut-tracker` stated it; `shalomut-map` was the file that had drifted.

## Completed

- `AGENTS.md` routing rewritten: trigger plus pointer, with a new
  `One canonical set for every agent` subsection stating the no-copy rule and
  naming exactly what the lint does and does not check.
- Each skill opens with `Как читать этот скилл`, classifying every one of its
  sections as always-in-force or conditional.
- `shalomut-map` startup steps 2–3 rewritten to section-scoped loading, and the
  operational-handoff condition restated as a task class (deployment, migrations,
  environment/alias, dependency on external state) because "does this touch a
  blocker" cannot be answered without reading the document it gates.
- Two conditional blocks extracted:
  `shalomut-tracker/references/escalation.md` (procedure, output format,
  task-file block; the triggers stay in the skill) and
  `shalomut-verification/references/mutation-testing.md`.
- Adversarial audit run over the diff; nine real defects found and fixed:
  - `lint:contract-refusals` and `lint:mutation-config` added to the matrix rows
    that select them, so a contract-version bump gets advance notice instead of
    a red CI. The obligation had become reachable only through the mutation row.
  - Mutation row widened to the mutated files themselves, not only their tests
    and config.
  - `npm run typecheck` stated under the matrix as the cross-row minimum for any
    `.ts`/`.tsx` diff; it had been stranded inside a conditional subsection.
  - Deployed read-only rule and "`npm run dev` is not evidence" hoisted into
    `Preflight`; both had ended up behind a user-visible-flow condition.
  - OpenAPI single-source rule moved into `Канонические границы`; it constrains
    which file may be edited, so a readiness-time condition was too late.
  - Destructive-Git prohibition moved into `Инварианты проекта`; it applies to a
    solo agent, not only to parallel work.
  - "Небольшие проверяемые порции" and the pointer to `shalomut-map` moved to
    always-in-force; both fire at the first edit.
  - `Назначение` added to `shalomut-map`'s map, which was the only incomplete one.
  - `AGENTS.md`'s claim about the lint replaced with what it actually checks.
- `scripts/check-agent-skills.mjs` + `.test.mjs`, wired as `lint:skills` into
  `verify:core`. It checks: frontmatter name matches directory; every relative
  link inside a skill resolves; no orphaned `references/` file; every `## `
  section classified by the reading map; nothing skill-shaped outside
  `.agents/skills/`; the four declared adapters still route here.
- The check failed on its first real run and found the leftover empty
  `.gemini/skills/shalomut-tracker/` directory, which contradicted `GEMINI.md`
  since 2026-07-30. Removed. It held no file and was untracked and gitignored,
  so nothing was discarded.

## In progress

- Nothing.

## Remaining

- Nothing. Push is the owner’s action.

## Changed files

Modified: `AGENTS.md`, `CLAUDE.md`, `.github/copilot-instructions.md`,
`package.json`, `.agents/skills/shalomut-map/SKILL.md`,
`.agents/skills/shalomut-tracker/SKILL.md`,
`.agents/skills/shalomut-verification/SKILL.md`.

Added: `.agents/skills/shalomut-tracker/references/escalation.md`,
`.agents/skills/shalomut-verification/references/mutation-testing.md`,
`scripts/check-agent-skills.mjs`, `scripts/check-agent-skills.test.mjs`,
this task file.

Removed outside Git: the empty, untracked, gitignored directory
`.gemini/skills/shalomut-tracker/`.

Pre-existing unrelated modifications, left untouched and unstaged:
`.idea/shalomut-map-demo.iml`, `next-env.d.ts`.

Everything is committed in `23e7932`. Another worktree can consume it now; another
checkout or machine only after the branch is pushed.

## Verification evidence

### Passed

- `npm run lint:skills` — 21 unit tests, exit 0, and the repository check
  passes. Negative proof taken twice rather than assumed: appending an
  unclassified `## ` section to `shalomut-map/SKILL.md` made it exit 1 with the
  unmapped-section message, and the empty `.gemini/skills/shalomut-tracker/`
  directory made it exit 1 before removal.
- `npm run lint:literals`, `lint:composition`, `lint:fixtures`,
  `lint:mutation-config`, `lint:contract-refusals` — all exit 0.
- `npm run typecheck`, `npm run lint`, `npm run build` — all exit 0.
- `git diff --check` — exit 0.
- Relative-link validation over the ten routing and skill documents: 9 links
  checked, 0 broken. Inline backtick paths in `AGENTS.md` all resolve.
- `npm test` — 878/878 pass when the venv interpreter is on `PATH`
  (`PATH="$PWD/ai-analytics-service/.venv/bin:$PATH" npm test`, exit 0).

### Failed

- `npm test` with the default `PATH` — 875 pass, 3 fail, exit 1. All three are
  `src/app/api/__tests__/ai-e2e.test.ts`, which hardcodes
  `spawnSync('python3', ...)` at line 181; system `python3` is 3.9.6 and lacks
  `typing.NotRequired`, so `ai-analytics-service/src/agents/state.py:1` raises
  ImportError. Pre-existing and unrelated: this diff touches no `.ts`, no `.py`
  and no test under `src/`. Because `verify:core` chains `npm test`, the full
  gate cannot complete locally, and no workflow in `.github/workflows/` runs
  `npm test` either. Spun off as its own task; not fixed here.

### Blocked or not run

- Playwright e2e, Python pytest, deployed smoke: not applicable. The diff is
  Markdown, one Node lint script and one `package.json` script entry.
- Full `npm run verify:core` as a single chain: blocked by the pre-existing
  `python3` failure above. Every step in it was instead run individually and
  passed.

### Environment

- Local worktree `/Users/maxim.berenshtein/WebstormProjects/shalomut-map-demo`.

### Residual risk

- **The win is not where the plan expected it, and the honest numbers should not
  be restated as a cut in skill size.** Always-loaded instructions grew:
  `AGENTS.md` 6,303 → 7,964, `shalomut-map` 10,040 → 12,825, `shalomut-tracker`
  15,914 → 17,133, `shalomut-verification` 15,464 → 14,768 — 47,721 → 52,690
  bytes, **+4,969**. Most of that increase is rules the audit forced back into
  always-in-force sections so they would stay reachable. The saving is
  transitive: a runtime/API task previously also carried 9,596 + 6,056 + 33,392
  + 69,554 bytes of ordered global documents, and now carries targeted sections
  instead — roughly 135 KB down to roughly 25 KB. Anyone re-opening this should
  optimise the transitive reads, not the skills.
- The reading maps are now load-bearing but their *correctness* is not
  checkable. `lint:skills` proves every section is classified; it cannot prove a
  section is classified correctly. Nine misclassifications were found by review
  in one pass, so more may exist.
- `checkAdapter` is a presence check. An adapter that names `AGENTS.md` only to
  repudiate it passes; a test pins that limitation and `AGENTS.md` states it.
- `CLIENT_ADAPTERS` is a fixed list. A brand-new entrypoint file — `.cursorrules`,
  `AGENT.md` — is not checked at all until it is added to that list.

## Failed approaches

- The first pass added a three-paragraph reading map to each skill restating the
  same cross-client preamble. That duplicated `AGENTS.md` and grew the
  always-loaded set; the maps were compressed to a single classified pair, and
  the preamble now lives once in `AGENTS.md`.
- `git checkout -- .agents/skills/shalomut-map/SKILL.md`, used to undo a
  deliberately appended test line, reverted the whole uncommitted file to
  `42e93ce`. All edits to that skill were re-applied. Use a scratch copy for
  negative-path probes on a dirty file.

## Known risks

- None to runtime. The only executable addition is a lint that reads Markdown.

## Approval gates

- None triggered. No secrets, credentials, aliases or migrations touched.

## Questions requiring an owner decision

- Should `lint:skills` also check for undeclared client entrypoints
  (`.cursorrules`, `AGENT.md`, `.github/instructions/**`)? It would close the
  `CLIENT_ADAPTERS` gap, at the cost of false positives on any new root
  Markdown file.

## Next concrete step

The owner pushes with
`git push origin docs/agent-skill-routing-progressive-disclosure:main`.
