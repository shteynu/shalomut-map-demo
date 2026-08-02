# Remove the dormant password-free authentication path

## Metadata

- Branch: `fix/dormant-auth-bypass`
- Base branch: `origin/main`
- Base commit: `ae3c3c4`
- Current HEAD: merged into `main` by `a6599d3`
- Status: complete, verified and merged into `main`
- Last updated: 2026-08-02
- Last agent/tool: Claude Code

## Objective

Close the P1 defect "Dormant DB-auth password bypass" from the v3 architecture
refactoring plan, listed there as "critical vulnerability once the branch is
switched on" with the resolution "delete the branch or introduce Argon2 or a
managed identity provider".

## User-visible outcome

None today, and that is the point: nothing production reached the removed path.
The change is what keeps the outcome empty on the day a database-backed manager
store is connected.

## Context

`ManagerAuthenticationService.authenticateCredentials` accepted an optional
`IManagerRepository`. When one was passed, it looked the manager up by email,
checked that some membership was active, and returned `ok: true` — without
verifying a password, and without any password to verify, since `Manager` in
`src/lib/auth/types.ts` carries no credential field.

The path was dormant: `src/app/api/auth/login/route.ts:23` is the only
production caller and passes two arguments, and no test exercised the third.
Stage 1 item 6 of the v3 roadmap asked for it to be closed; the 2026-07-30 plan
review recorded "Auth — выполнено", but that referred to closing stale branches
and folding tenant authorization into stage E, not to this code.

## Scope

- Remove the repository parameter and its branch from
  `authenticateCredentials`.
- Add a regression that passes a repository the way a future caller might and
  requires it to change nothing.

## Non-goals

- Replacing the SHA-256 password hash with a static pepper
  (`manager-auth-service.ts:102-107`). Argon2 or a managed identity provider
  belongs to the persistent-identity work in stage E of the refactoring plan.
- Adding a credential field to `Manager` or a database-backed manager store.
- Application-level manager identity, roles and tenant authorization, which
  stage E already owns.

## Acceptance criteria

- Passing a manager repository cannot produce a session.
- Every existing authentication behavior is unchanged: valid credentials,
  invalid password, unknown user, suspended account, unconfigured deployment
  and deployed organization scoping.

## Relevant repository instructions

`AGENTS.md` (explicit bounded approval for authentication configuration —
none needed here, since no secret, credential or configuration value changes),
`.agents/skills/shalomut-verification/SKILL.md` (auth row: unauthorized and
missing-secret tests plus a security-focused diff review).

## Relevant architecture and contracts

No contract, schema, migration or environment variable is touched. The public
signature of `authenticateCredentials` narrows from three parameters to two;
the only production caller already passed two.

## Decisions made

- Deleted rather than repaired. Verifying a credential requires a stored
  credential, and `Manager` has none. Giving it one is the persistent-identity
  work, so leaving a "fixed" repository path in place would have meant
  inventing a credential model ahead of that task.
- The regression casts the bound method and passes a repository anyway. A test
  that simply calls the two-argument form would have passed against the old
  code too and proved nothing.

## Assumptions

- The manager repository keeps its role in membership and audit services,
  which never authenticate. `MembershipService` and `ManagerAuditService`
  continue to use `IManagerRepository` unchanged.

## Completed

- `src/lib/auth/manager-auth-service.ts`: removed the `repository` parameter,
  its branch and the now-unused `IManagerRepository` import; documented why the
  parameter is gone rather than fixed.
- `src/lib/auth/__tests__/manager-auth-service.test.ts`: added "a manager
  record is not a credential".

## In progress

None.

## Remaining

Nothing in this task's scope.

## Changed files

Committed as the single commit on `fix/dormant-auth-bypass`. The branch is not pushed,
so another worktree in this clone can consume it and another checkout or
machine cannot.

- Modified: `src/lib/auth/manager-auth-service.ts`,
  `src/lib/auth/__tests__/manager-auth-service.test.ts`
- Unrelated, still unstaged and preserved: `.idea/shalomut-map-demo.iml`,
  `next-env.d.ts`

## Verification evidence

### Passed

- `npm run verify:core`, exit code `0`: version-literal fitness check, prisma
  generate, `next typegen && tsc --noEmit`, 325 TypeScript tests, ESLint and
  the production build.
- Red-before-green: with the bypass restored from the stash, the new test
  fails; with it removed, all 13 tests in the auth service file pass.
- Security-focused diff review: the diff only deletes a code path and its
  import. The surviving path verifies a password against a stored hash with a
  timing-safe comparison, and the unauthorized, unknown-user, suspended,
  unconfigured and organization-scoping tests all still pass.

### Failed

None.

### Blocked or not run

- `.venv/bin/python -m pytest`: not run. No Python file changed.
- `npm run verify:db`: not run. No Prisma schema, migration or repository
  changed.
- Browser smoke: not run. The login screen and its states are untouched.

### Environment

Local. `origin/main` at `ae3c3c4`.

### Residual risk

- The remaining password hash is SHA-256 with a static pepper. It is out of
  scope here and stays an open stage-E item; this branch does not improve it.
- Removing the parameter narrows a public signature. Nothing in the repository
  passed three arguments, but a future caller written against the old shape
  would now be a type error rather than a silent bypass — which is the intent.

## Failed approaches

The first regression asserted `authenticateCredentials.length === 2`. Optional
parameters are excluded from `Function.length`, so the old three-parameter
signature also reported 2 and the assertion passed against the very code it was
meant to catch.

## Known risks

None beyond the residual risk above.

## Approval gates

None. No credential, secret, authentication configuration value or deployment
alias changes; only a code path that could never authenticate is removed.

## Questions requiring an owner decision

None.

## Next concrete step

None. Archived after merge into `main` at `a6599d3`.
