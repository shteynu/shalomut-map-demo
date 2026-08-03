# Архив pre-alignment документации

## Metadata

- Branch: `docs/archive-pre-alignment-snapshots`
- Base branch: `origin/main`
- Base commit: `4a3e795`
- Current HEAD: `b8c7e53` (`docs: archive pre-alignment documentation
  snapshots`); task archival recorded by the immediate metadata commit
- Status: complete, verified and published to `origin/main`
- Last updated: 2026-08-03
- Last agent/tool: Codex

## Objective

Сделать исторический материал, удалённый при документационной компактизации,
доступным из текущего дерева репозитория без возвращения устаревших утверждений
в living documentation.

## User-visible outcome

Цельные версии существенно переписанных документов до alignment-коммита
доступны в явно помеченном snapshot-каталоге и связаны с documentation index.

## Context

Коммит `238fe1d` привёл living docs к состоянию `main` и удалил большой объём
session history и устаревших operational snapshots. Исходные версии находятся
в его parent-коммите `278ba9b`, но пользователь предпочёл явный архив.

## Scope

- Exact pre-alignment snapshots of `PROGRESS.md`, `PROJECT_CONTEXT.md`,
  `ROADMAP.md`, `docs/ai-analytics-handoff.md` and
  `docs/shalomut-tracker-handoff.md`.
- Archive README and a link from `docs/README.md`.

## Non-goals

- Возвращать исторический текст в living docs.
- Архивировать исправленные ошибочные формулировки из README, skills или env
  comments как альтернативные инструкции.
- Менять runtime, tests, product behavior или deployed state.

## Acceptance criteria

- Архивные payload-файлы byte-for-byte совпадают с `278ba9b`.
- Архив явно говорит, что snapshot не является current source of truth.
- Documentation index ведёт к архиву.
- Markdown links и `git diff --check` проходят.

## Relevant repository instructions

- `AGENTS.md` documentation lifecycle.
- `.agents/skills/shalomut-tracker/SKILL.md`.
- `.agents/skills/shalomut-map/SKILL.md`.
- `.agents/skills/shalomut-verification/SKILL.md`.

## Relevant architecture and contracts

Не затрагиваются; архив сохраняет исторический текст как evidence.

## Decisions made

- Сохранять пять существенно переписанных narrative/state документов, где
  удалённый текст имеет историческую ценность.
- Использовать расширение `.md.txt`, чтобы exact snapshots не воспринимались
  как living Markdown и их старые relative links не проходили current link
  resolution.
- Не дублировать мелкие удалённые ошибки из канонических instructions.

## Assumptions

- `278ba9b` — последний pre-alignment commit и точный источник snapshot.

## Completed

- Определён scope по `git diff --numstat 278ba9b..238fe1d` и структуре старых
  документов.
- Созданы пять exact `.md.txt` snapshots из `278ba9b` — 3429 строк.
- Добавлены archive README и ссылка из documentation lifecycle index.
- Проверены byte equality, current Markdown links, whitespace и отсутствие raw
  credentials/private session URLs.

## In progress

Ничего.

## Remaining

Nothing in scope.

## Changed files and exact Git state at archival

- Archive payload, README/index update and initial active task are committed in
  `b8c7e53`; no scoped implementation files remain unstaged or untracked.
- This task-file move from `active/` to `archive/` is recorded by the immediate
  metadata commit after `b8c7e53`.
- Unrelated pre-existing `.idea/shalomut-map-demo.iml` and `next-env.d.ts`
  changes remain unstaged in this worktree and are absent from both commits.
- The separate `main` worktree retains its own unstaged `next-env.d.ts`;
  fast-forward publication does not include or overwrite it.
- Visibility after session close: both commits are reachable from pushed
  `origin/main` and portable to other worktrees, clones and machines.

## Verification evidence

### Passed

- `git fetch --prune origin` and `npm run agent:context` — current branch/base
  and unrelated worktree state confirmed.
- `git diff --numstat 278ba9b..238fe1d` — archive scope identified.
- Byte comparison against `git show 278ba9b:<path>` — all five snapshots are
  exact; SHA-256 digests recorded in command output.
- Current Markdown relative-link scan — `docs/README.md`, archive README and
  active task links resolve.
- Sensitive-content pattern scan — no raw credential or private session URL;
  only the existing redacted `postgresql://…supabase…` placeholder matched.
- `git diff --check` — exit 0.
- Final `git fetch --prune origin` and `npm run agent:context` — branch, base,
  active task, upstream and exact dirty state confirmed; `origin/main` remains
  `4a3e795`.
- Separate `main` worktree preflight — `main` matches `origin/main`; its
  unrelated unstaged `next-env.d.ts` is preserved.
- Final exact-snapshot/link/task/sensitive-content harness — exit 0 after
  explicit UTF-8 validation; all five payloads match `278ba9b`, current links
  resolve, exactly one `Next concrete step` exists, and no raw credential or
  private session URL was detected.
- Whitespace checks for the tracked diff and all five archive payloads — exit
  0.

### Failed

None.

### Blocked or not run

- Runtime suites: not run; planned diff is documentation-only.

### Environment

Local repository/worktree.

### Residual risk

Historical text can be mistaken for current guidance unless readers follow the
archive warning and `docs/README.md`.

## Failed approaches

- First bulk extraction command was rejected before execution because it
  included temporary-directory deletion; rerun without deletion succeeded.
- First combined validation command had unmatched shell quotes and did not
  execute; corrected command passed.
- First final security harness reached the content scan but stopped on mixed
  binary/UTF-8 comparison; the corrected explicit UTF-8 rerun passed.

## Known risks

- Exact snapshots retain obsolete commands, counts and environment wording by
  design.
- Unrelated local IDE/Next-generated changes must remain excluded.

## Approval gates

None.

## Questions requiring an owner decision

None.

## Next concrete step

Done: the exact historical snapshots and this archived task were fast-forwarded
to `main` and published to `origin/main`; start the next independently
deliverable task from refreshed remote state.
