# Актуализация документации и agent instructions после рефакторинга

## Metadata

- Branch: `docs/align-main-documentation`
- Base branch: `origin/main`
- Base commit: `278ba9b`
- Current HEAD: `278ba9b`
- Status: docs/instructions пакет завершён и проверен; публикация в `main`
  авторизована пользователем
- Last updated: 2026-08-02
- Last agent/tool: Codex

## Objective

Сверить документацию, version-controlled skills и repository instructions с
фактическим состоянием `main` после рефакторинга, расширения обычных и
мутационных тестов и добавления новых возможностей; устранить найденные
расхождения и дублирование.

## User-visible outcome

Living documentation описывает текущую архитектуру, contracts `1.0`–`6.0`,
features, verification и mutation pilot. Исторические планы отделены от current
state, а глобальные memory-файлы снова имеют ограниченную понятную роль.

## Context

Работа выполнена от свежего `origin/main` (`278ba9b`) после
`git fetch --prune origin`. Код, tests, manifests, scripts and configuration
использованы как более приоритетные источники, чем старые deployment snapshots.

## Scope

- Living docs, `.agents/skills/`, `AGENTS.md`, `PRODUCT.md`, `design.md` и
  `.env.example` comments.
- Lifecycle-index документации.
- Актуальные Core/Python boundaries, V6 status, normal/mutation verification.
- Сжатие `PROGRESS.md` и operational handoff до заявленных владельцев state.

## Non-goals

- Runtime/product behavior changes.
- Secrets, credentials, auth configuration, deploy aliases or deployed writes.
- Механическое переписывание dated plans и archived task evidence.
- Полный repository-wide mutation testing.

## Acceptance criteria

- Выполнено: актуальные architecture/features/test commands подтверждены кодом
  и configuration.
- Выполнено: живые docs/skills/instructions не утверждают, что Core всё ещё
  остановлен на `3.0`/`5.0` или что default равен `3.0`.
- Выполнено: living/implemented/historical/task docs разделены в
  `docs/README.md`.
- Выполнено: docs structural validation, links и `git diff --check` зелёные.

## Relevant repository instructions

- `AGENTS.md`.
- `.agents/skills/shalomut-{tracker,map,verification}/SKILL.md`.
- `context-engineering` использован для bounded context pack.

## Relevant architecture and contracts

- `contracts/capabilities.json`: versions `1.0`–`6.0`.
- `src/lib/ai-contract-version.ts`: producible `3.0`–`6.0`, unset default
  `5.0`.
- Core: `CanonicalRoundAnalytics` + `encodeAnalyticsInput`.
- Python: `CanonicalAnalysisInput`, output adapter and application ports.
- Current remaining architecture slice: Core composition root instead of
  direct `getRepositories()`.

## Decisions made

- Added `docs/README.md` as the lifecycle/ownership index.
- Rewrote `PROGRESS.md` as concise product milestones and
  `docs/shalomut-tracker-handoff.md` as current operational state. Deleted
  session-history prose remains recoverable in Git and archived task files.
- Rewrote the stale AI handoff into a current cross-service overview.
- Kept exact historic test counts only where explicitly labelled checkpoint
  evidence; evergreen guides use commands instead of counts.
- Mutation testing is documented as an opt-in, non-blocking pilot for one file,
  not as repository-wide coverage or CI gate.
- Unrelated `.idea/shalomut-map-demo.iml` and `next-env.d.ts` changes were
  preserved and not edited.

## Assumptions

- `origin/main` after the fetch is the requested main baseline.
- Repository-recorded deployed V6/migration evidence is retained as current;
  this docs-only task did not query live Vercel/Render/Supabase state.

## Completed

- Updated canonical skills and root agent instructions.
- Added repository verification/mutation/documentation overview to README.
- Updated product, design, roadmap, source-of-truth and behavior backlog.
- Updated `.env.example` contract choices/default and V6 meaning.
- Updated contract matrix next-version rollout steps and marked V2/V3 rollout
  sections historical where appropriate.
- Updated AI service architecture, contract status and canonical pytest command.
- Rebuilt stable architecture context and compacted global memory documents.
- Closed regression-review findings: verification now uses local/test/deployed,
  both project skills protect released contracts `1.0`–`6.0`, and README again
  documents the production Core build/start commands.

## In progress

Ничего.

## Remaining

- Commit scoped documentation changes, archive this task, fast-forward local
  `main`, push `origin/main` and verify the published refs.

## Changed files

Scope, unstaged:

- `.agents/skills/shalomut-map/SKILL.md`
- `.agents/skills/shalomut-tracker/SKILL.md`
- `.agents/skills/shalomut-verification/SKILL.md`
- `.env.example`
- `AGENTS.md`, `README.md`, `PRODUCT.md`, `PROJECT_CONTEXT.md`, `PROGRESS.md`,
  `ROADMAP.md`, `design.md`
- `ai-analytics-service/README.md`
- `docs/ai-analytics-handoff.md`
- `docs/ai-contract-version-matrix.md`
- `docs/dashboard-semantic-contract.md`
- `docs/dynamic-questionnaire-ai-contract.md`
- `docs/local-environment.md`
- `docs/product-behaviour-backlog.md`
- `docs/shalomut-tracker-handoff.md`
- `docs/source-of-truth.md`

Scope, untracked:

- `docs/README.md`
- этот task-файл

Unrelated, pre-existing unstaged and untouched:

- `.idea/shalomut-map-demo.iml`
- `next-env.d.ts`

Staged files: none. Commits on this branch: none. Upstream is `origin/main`.

## Verification evidence

### Passed

- `git fetch --prune origin` — remote refs refreshed; base `278ba9b`.
- `npm run agent:context` — branch/task/Git context checked at session start.
- Modified-Markdown relative-link scan — no broken local links.
- Ruby YAML parse for all three changed `SKILL.md` files — valid frontmatter
  with `name` and `description`.
- Capability/architecture structural check — registry keys are exactly
  `1.0`–`6.0`; producible list and Python ports exist at documented paths.
- `npm pkg get scripts.verify scripts.verify:core scripts.verify:db
  scripts.verify:ai scripts.test:mutation:ai-contract` — documented scripts
  match `package.json`.
- `git diff --check` — exit 0 after final content changes.
- `npm ci` — exit 0; local ignored dependencies refreshed from lockfile.
- `npm run test:mutation:ai-contract -- --dryRunOnly` — exit 0 after dependency
  refresh; 1 source file/1137 mutants instrumented, 5 focused tests passed, no
  mutations executed.
- Instruction regression harness — root skill order, approval gates,
  parallel-worktree safety, tracker task routing, commit/push boundary, map
  privacy routing, documented npm scripts, one task `Next concrete step`,
  required file existence, comment-only `.env.example` diff and absence of
  runtime/test/build-config changes all passed.
- Повторный frontmatter/npm-command/link scan и `git diff --check` — exit 0.
- Post-fix regression harness — obsolete `preview/staging` vocabulary absent
  from verification skill; tracker/map contract invariant is identical;
  README build/start commands resolve to `package.json`; all checks passed.
- Повторный post-fix Stryker dry run — exit 0; 1 source file/1137 mutants
  instrumented, 5 focused tests passed, no mutations executed.
- Final pre-commit `npm run agent:context` — branch, base, active task and exact
  staged/unstaged/untracked state confirmed.
- Final frontmatter/link/npm-command/instruction-regression harness — exit 0;
  3 canonical skills, 21 Markdown files and 24 scoped files validated.
- Final pre-commit `git diff --check` — exit 0.

### Failed

- First Stryker dry run: `sh: stryker: command not found` because the existing
  local `node_modules` did not contain lockfile dependencies. Resolved by
  `npm ci`; identical rerun passed.

### Blocked or not run

- Full `npm run verify`: not run because the final diff is documentation,
  instructions and `.env.example` comments only; no runtime/schema behavior
  changed.
- Full mutation run: not run; config/validator/tests were not changed and the
  documented pilot remains opt-in/non-blocking.
- Live deployed smoke: not run; this task made no deployed-state claim beyond
  the existing repository record and performed no external mutations.

### Environment

Local repository/worktree. Structural checks and Stryker dry run used local
Node dependencies from `package-lock.json`.

### Residual risk

- Dated historical plans intentionally retain old commands/counts/snapshots;
  their non-current status now depends on readers following `docs/README.md`.
- Live deployment source/health was not revalidated.
- `npm ci` reported 12 dependency-audit findings (3 moderate, 9 high); they are
  unrelated to this docs task and were not triaged or fixed.

## Failed approaches

- Stryker could not start before the lockfile dependencies were installed;
  refreshing ignored `node_modules` fixed the environment without tracked
  changes.

## Known risks

- Large intentional deletions in `PROGRESS.md` and the operational handoff
  remove duplicated history from current files; Git and archived task docs are
  the recovery/history boundary.
- Unrelated worktree changes must remain excluded from any future commit.

## Approval gates

Нет. No secret/auth/deploy/database mutation is in scope.

## Questions requiring an owner decision

Нет.

## Next concrete step

Commit the scoped docs package, archive this task, fast-forward local `main`,
push `origin/main`, then verify the published refs while preserving unrelated
`.idea/shalomut-map-demo.iml` and `next-env.d.ts` changes.
