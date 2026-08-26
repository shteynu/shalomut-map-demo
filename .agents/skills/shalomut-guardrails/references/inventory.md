# The gate inventory

Each row is one `lint:*` command from `package.json`. All of them are steps of
`verify:core`, and each runs its own test before running the check itself.
`npm run lint:gate-inventory` checks that this table and `package.json` agree.

The table is the route from a failing message to its rule, not the statement of
the rule. The rule is written in full in the doc-comment of the corresponding
script, and on any disagreement the script wins.

| Gate | What it refuses | Where the rule is stated |
| --- | --- | --- |
| `lint:literals` | A contract-version literal outside the contract package, the wire types and the tests — in Core and in the Python service | `scripts/check-version-literals.mjs`, `scripts/check-version-literals-python.mjs` |
| `lint:interpreter` | `python3` from PATH in command position in `scripts/`, `src/`, `e2e/`, `package.json` and the workflows; only `python3 -m venv` is allowed | `scripts/check-python-interpreter.mjs` |
| `lint:composition` | Resolving the composition root outside an entrypoint, and constructing a repository outside the composition root | `scripts/check-composition-root.mjs` |
| `lint:deploy-migrations` | A deployed build that no longer applies migrations — including the bypass through `vercel-build` | `scripts/check-deploy-migrations.mjs` |
| `lint:tenant-chokepoints` | A manager path to a school's data that goes around `loadManagerContext` and `authorizeManagerRound` | `scripts/check-tenant-chokepoints.mjs`, `Canonical boundaries` in `../../shalomut-map/SKILL.md` |
| `lint:fixtures` | Reachability of the demo fixtures (`DEMO_ORGANIZATION`, `DEMO_ROUND`, `SHALOM-DEMO`) from runtime modules | `scripts/check-runtime-fixtures.mjs` |
| `lint:skills` | A copy of a skill outside `.agents/skills/`, a broken or orphaned `references/` link, an unclassified section, a client adapter that routes nowhere | `scripts/check-agent-skills.mjs`, `AGENTS.md` |
| `lint:mutation-config` | A `tap.testFiles` that has drifted from the repository: the denominator of the mutation score is re-derived | `scripts/check-mutation-config.mjs`, [../../shalomut-verification/references/mutation-testing.md](../../shalomut-verification/references/mutation-testing.md) |
| `lint:contract-refusals` | A callback-payload validation path with no suite of negative tests | `scripts/check-contract-refusal-suites.mjs` |
| `lint:fonts` | A font going back to the network: `next/font/google`, a Google host in code or CSS, a missing local source | `scripts/check-local-fonts.mjs` |
| `lint:doc-numbers` | A number a document quotes from configuration that has drifted from it | `scripts/check-doc-numbers.mjs`, `AGENTS.md` |
| `lint:audit-count` | A count in `docs/critical-audit-2026-08-21.md` that disagrees with the statuses of its own records | `scripts/check-audit-count.mjs`, `AGENTS.md` |
| `lint:error-bodies` | A caught `error` in a route handler's response body — the detail goes to `reportRouteFailure`, not outward | `scripts/check-error-bodies.mjs` |
| `lint:python-deps` | A `pyproject.toml` that disagrees with the locks, lost hashes, an install that is not from the lock | `scripts/check-python-deps.mjs`, `ai-analytics-service/README.md` |
| `lint:docs-publish` | A regression in document publishing: this gate is one set of tests, `scripts/publish-doc.test.mjs` | `scripts/publish-doc.mjs` |
| `lint:gate-inventory` | A gate outside `verify:core`, a gate this table does not name, a row with no gate behind it, and a `lint:*` command that does not run its own test | `scripts/check-gate-inventory.mjs`, `../SKILL.md` |

## Checks that are not in this table

They are not part of the `lint:*` family and live by their own rules:

- `npm run openapi:check` and `npm run docs:endpoints:check` — the `--check`
  mode of a generator; they are run by tests and by the `docs` commands, not by
  `verify:core` directly.
- `npm run lint` (ESLint), `npm run typecheck`, `npm test`, `npm run build` and
  `npm run verify:ai` — ordinary steps of `verify:core`, not fitness checks on
  the shape of the repository.
- `scripts/gate-hook.mjs` — not a check but a dispatcher: Claude Code's
  `PostToolUse` hook (`.claude/settings.json`) hands it the file just written,
  and it runs the gates that path maps to so a violation surfaces at the edit
  rather than at CI. It refuses nothing of its own.
- `npm run verify:db`, `npm run test:e2e` and Stryker — environment and
  evidence; when they are mandatory is decided by the matrix in
  [../../shalomut-verification/SKILL.md](../../shalomut-verification/SKILL.md).
