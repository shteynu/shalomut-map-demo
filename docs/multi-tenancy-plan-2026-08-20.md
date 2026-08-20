# Multi-tenancy plan — many schools, each with its own users

Four owner decisions, all taken on 2026-08-20: the product becomes
**multi-tenant with per-tenant users**; access is granted by **invitation**
rather than open registration; there is an **operator role that can read any
school**, not only administer it; and **revocation takes effect within about
fifteen minutes** rather than the current day. The reasoning for the last two,
including what they cost, is in §5a.

This is a live plan, not a specification: phase 0 is unblocked, everything after
it carries the four questions still open in §5.

Every claim about current behaviour below was read from the code on 2026-08-20
and carries its anchor. Where this document and the code disagree, the code wins.

## 1. What "multi-tenancy" means here, because two axes were being conflated

The question "does multi-tenancy mean more than one user?" has a specific answer
in this repository: **no, they are two independent axes, and one of them is
already built.**

**The tenant axis is already multi.** `Organization` is a real table
(`prisma/schema.prisma:12`), every round hangs off one, ADR-020 landed the
school-choice layer on 2026-08-07, the setup screen shows a switcher as soon as
there is more than one school, and `createOrganization` is an explicit action.
The deployed database being empty is a fact about data, not about the model.

**The identity axis does not exist at all.** On a deployed runtime,
`ManagerAuthenticationService.defaultAccounts()`
(`src/lib/auth/manager-auth-service.ts:136`) constructs **exactly one account, in
memory, on every login**: e-mail from `MANAGER_ADMIN_EMAIL`, password hashed from
`MANAGER_ADMIN_PASSWORD`. No row is stored, and nothing else can log in. Outside
a deployed runtime it adds three hardcoded accounts — `admin123`, `manager123`,
`suspended123` — which are unreachable in the deployment.

So three different products were available under one word, and the decision names
the third:

| | Shape | State |
| --- | --- | --- |
| (a) | one school, several staff | `docs/product-behaviour-backlog.md` §8, gated on being requested |
| (b) | several schools, one operator | **built** |
| (c) | several schools, each with its own users, isolated | **chosen 2026-08-20** — nothing built |

## 2. The boundary that has to move first, and why it is urgent rather than large

`src/lib/server/manager-scope.ts:22` states the current rule in its own words:

> It is a preference rather than a permission: the value is checked against the
> schools that actually exist before anything is read with it, and this
> deployment has one manager, so a wrong value is a wrong screen and never
> someone else's data.

That sentence is the entire tenant boundary, and decision (c) is precisely the
event that invalidates it. Concretely, today:

1. `?school=<id>` is read from the query string by `readChosenSchool`
   (`src/middleware.ts:28`), written to the `shalomut_school` cookie and injected
   as the `x-shalomut-manager-organization-id` header.
2. `ManagerScopeService.resolveOrganizationId`
   (`src/lib/services/manager-scope.service.ts:34`) accepts that id if it appears
   in **`orgRepo.findAll()`** — every school in the system.
3. The session's memberships are never consulted. The JWT carries them
   (`src/lib/auth/jwt-session-provider.ts:120` writes `mbs` and `role`), and no
   production code reads them for a decision.

With one manager this is a wrong screen. With two managers it is one query
parameter between a manager and another school's data. **It is not a
vulnerability today and becomes one on the first day of phase 1**, which is why
it is phase 0 and not part of the identity work.

A second, quieter leak sits beside it: `loadSchools()`
(`src/lib/server/manager-context.ts:47`) returns `orgRepo.findAll()` to feed the
setup screen's switcher. Under (c) that lists every tenant's school name and
city, which is a disclosure even when no round data follows.

### What is already right, and it is most of it

ADR-020 built this layer for exactly this moment and says so: *"When memberships
become real, this is the layer that starts consulting them; nothing above it has
to move."* That claim was tested against the code and holds.

**Every manager route funnels through one function.** All twelve go through
`authorizeManagerRound` or `resolveOrganizationId`, and `authorizeManagerRound`
itself calls `resolveOrganizationId` via `findRound`. The routes that do not are
exactly the right set: the four worker routes behind `AI_CALLBACK_SECRET`, `/api/mcp`
behind `MCP_SHARED_SECRET`, `/api/auth/*`, `/api/health`, the four respondent
share-code routes, and `/api/manager/question-suggestion`, which reads no
repository. The server-rendered pages converge on the same place:
`manager-context.ts` → `ManagerContextService.load` →
`ManagerScopeService.resolveOrganizationId`
(`src/lib/services/manager-context.service.ts:114`).

### Where the check belongs, which is not where it looks like it belongs

The obvious move is to make `resolveOrganizationId` consult memberships. It
cannot: it receives an organization repository and a requested id, and has no
session. Threading a session into it would change a signature that fourteen call
sites depend on.

**The middleware is the right place, and it already holds everything needed.**
`resolveManagerSession` runs at `src/middleware.ts:88` and the chosen school
becomes the header at `src/middleware.ts:97`, so `managerSession.memberships` is
already in scope at the exact line that grants it. Refusing a school the session is not an active
member of — and falling back to `activeOrganizationId` — is a few lines, changes
no signature, and leaves `resolveOrganizationId` doing what it does well: proving
the school still exists.

The switcher needs the same list. Either the middleware injects the membership
ids as a second header for `loadSchools` to filter by, or the setup page resolves
the session itself. The header is more consistent with how scope already travels;
the trade is one more piece of trusted-but-unsigned data between middleware and
page, in a header the middleware already strips and rewrites
(`createScopedManagerHeaders` deletes before it sets).

## 3. Phases

### Phase 0 — the boundary closes before there is anything to protect

Unblocked, and should land before any identity work.

- The middleware honours a chosen school only when the session holds an **active**
  membership for it.
- `loadSchools` returns only the session's schools.
- `resolveOrganizationId`'s two population-dependent branches — accept anything
  when no school exists, and demand a choice when more than one does — become
  membership-dependent rather than system-dependent.
- Regression tests that a foreign `?school=` is ignored rather than honoured.

**Behaviour is unchanged today**: the single session carries exactly one
membership, built from `MANAGER_ORGANIZATION_ID`, so every current request
resolves as it does now. That is the point — the rule is in place while it costs
nothing to verify.

### Phase 1 — identity becomes a row

- `Manager` and `OrganizationMembership` tables, and repositories behind the
  interfaces that already exist in `src/lib/auth/domain-contract.ts`.
- `authenticateCredentials` reads the repository instead of building
  `defaultAccounts()`. Its doc comment already anticipates this and explains why
  the repository parameter was removed rather than fixed
  (`manager-auth-service.ts:212`).
- A real credential: Argon2 or an identity provider. ADR-013 is explicit that
  swapping the SHA-256 hash **alone** closes nothing, because nothing stores it —
  it is derived from the environment variable per login and discarded.
- The three hardcoded local accounts go, or become seed data that cannot exist in
  a deployed runtime.

### Phase 2 — invitations

- `MembershipStatus` already includes `'invited'` (`src/lib/auth/types.ts:3`) and
  nothing has ever used it. The flow is already named by the type.
- Signed invite token → e-mail → the invitee sets their own password. No open
  registration.
- Revocation sets `suspended`; `authenticateCredentials` already refuses an
  account with no active membership.
- Password strength enforced **where a password is set**, which is what backlog §8
  says the current sign-in-time rule is a blunt substitute for. The withdrawn
  implementation is on the local-only branch `fix/manager-password-must-be-strong`.
- Hebrew RTL screens for invite, set-password, forgot-password. If an identity
  provider is used instead, its hosted screens still need their RTL behaviour
  checked by hand.
- **An e-mail sender is a new subprocessor** and belongs in
  `docs/data-flow-and-subprocessors.md` before it sends anything.

### Phase 3 — the audit log survives a restart

Moved ahead of role enforcement by the 2026-08-20 decision that the operator can
read any school. `InMemoryAuditLogRepository`
(`src/lib/auth/domain-contract.ts:134`) is what `getAuditLogRepository()`
returns, so audit events die with the container, and the `console.info` line
beside it lands in a log window nothing collects.

Once one person can open every school, that log is the only thing standing
between a legitimate support visit and an unaccountable one. It has to exist
before the role does, not after — a role whose use cannot be reconstructed is a
role nobody can defend having granted.

- A Prisma-backed `IAuditLogRepository` behind the interface that already exists.
- Reading another tenant's data is itself an audited action, which is a new event
  type: the current `AuditActionType` list covers writes only
  (`src/lib/auth/manager-audit-service.ts:4`).
- Who may read the log, and whether a school sees the visits made to it, is worth
  deciding with the role rather than later.

### Phase 4 — roles start being enforced

- `RolePermissionService` already defines nine actions across `admin` and
  `manager` (`src/lib/auth/roles-and-permissions.ts:3`) and has **zero production
  callers** — its only consumer is `slice-3-roles-audit-membership.test.ts`. The
  session carries `role`, and it is echoed back by `/api/auth/me` and the login
  response and used as an audit label, never as a gate.
- Map the nine actions onto the twelve manager routes and enforce at the same
  chokepoint the scope uses.
- **The operator role joins here**, and it is not a third value of `ManagerRole`:
  it is a property of the person rather than of a membership, so it sits on
  `Manager` and is consulted *before* the membership check phase 0 introduces —
  the one place that already decides whether a school may be opened.
- Note the asymmetry this reveals: the current `manager` role is read-only. The
  single deployed account is `admin`, so nobody has met that restriction yet.

### Phase 5 — the session gets short

The 2026-08-20 revocation decision. The 24-hour stateless session
(`login/route.ts:103`) becomes a short one with silent renewal, and the renewal
is where memberships, roles and the operator flag are re-read from the database.

- It can land any time after phase 1, and it is what makes suspension in phase 2
  mean anything within the quarter hour rather than within the day.
- The interval is also an idle-logout timer, so pick the number against how a
  manager actually works — reading a map and writing goals is not a keyboard-busy
  task, and a session that dies mid-reading is a worse defect than the one this
  fixes.

## 4. What this supersedes

Four documents jointly declare "one manager per deployment" a deliberate decision
and name multi-tenant hosting as the trigger that reopens it. They change
together, in the phase that makes each untrue — not all at once, and not before:

- `PROJECT_CONTEXT.md` ADR-013 — the decision itself. Superseded by phase 1; a new
  ADR should replace it rather than editing it, so the reasoning stays readable.
- `docs/product-behaviour-backlog.md` §8 — holds the proposal this plan expands,
  and the record of the withdrawn password enforcement.
- `ROADMAP.md`, "Conditional, not scheduled" — the long-term identity model moves
  to "Next architecture outcomes" when phase 0 lands.
- `PROJECT_CONTEXT.md` ADR-020 — not superseded. Phase 0 is the sentence it
  already promised, and its wording about a preference rather than a permission
  needs the update that phase makes true.

## 5. Open questions for the owner

Two of the original six were answered on 2026-08-20 and have moved to §5a below.

1. **Who may create a school?** The operator only, or a tenant admin? This decides
   whether `createOrganization` needs a permission above the tenant, and whether
   "school" and "tenant" are the same object at all.
2. **What happens to the current operator's credentials at phase 1?** The password
   is an environment variable today; after phase 1 it is a row. Seeded on first
   boot, migrated by a one-off script, or re-invited like anyone else — and
   `MANAGER_ADMIN_PASSWORD`/`MANAGER_ORGANIZATION_ID` either keep a bootstrap
   meaning or are retired.
3. **Own passwords or an identity provider?** The invitation decision implies own
   passwords, but an IdP is still compatible with invite-only and removes password
   reset, storage and their RTL screens. Many Israeli schools are on Google
   Workspace.
4. **Which e-mail provider**, given it becomes a subprocessor that sees a school
   staff member's address.


## 5a. Answered, 2026-08-20

**There is a role above the tenant, and it reads data as well as administering
it.** Of three options — no such role, administration without data access, or
full visibility — the owner took full visibility, for support and onboarding.
The agent had recommended the middle one. Recorded here with what the choice
carries, because the reasoning is what a later reader needs:

- **The promise to the respondent changes.** Today nobody outside a school can
  open its map. After this, someone can. That belongs in
  `docs/data-flow-and-subprocessors.md`, which is the factual basis every future
  legal document rests on, and it should be written there before the role exists
  rather than after.
- **The cross-tenant aggregate stays refused.** This was stated in all three
  options and is part of what was accepted. The k-anonymity guarantee is
  formulated for one population, so no screen and no export may combine several
  schools into one figure — small schools that are individually suppressed would
  otherwise become readable together.
- **The audit log becomes the only remaining accountability**, which moves it out
  of phase 4. If the operator can open any school, "who looked at whose data" is
  the sole record that the access was legitimate, and today that record is
  `InMemoryAuditLogRepository` and dies with the container. Persisting it should
  land with the role, not after it.
- The role is a property of the person, not of a membership, so it does not fit
  `OrganizationMembership` — it belongs on `Manager` or on a separate table.

**Revocation takes effect within about fifteen minutes.** Of three options — a
membership read on every request, a short session with silent renewal, or the
current 24 hours — the owner took the short session. A per-request read was
declined on cost: the database is in Seoul and the functions in Washington, about
180 ms per round trip, on every action. What this buys and costs:

- The window between removing someone's access and their losing it falls from 24
  hours to roughly one renewal interval.
- The renewal is the moment memberships are re-read, so it is also where a
  suspended membership, a changed role and a deleted school take effect.
- The user notices nothing while working. A session that is idle past the
  interval ends, so the interval is also a logout timer — worth confirming
  against how a manager actually uses these screens before fixing the number.

## 6. What does not change, and is worth stating so nobody redesigns it

- **The respondent path.** A share code is globally unique
  (`prisma/schema.prisma:29`) and is itself the credential; a respondent never
  authenticates and never names a school. Multi-tenancy does not reach it.
- **The privacy threshold and cell suppression.** Both are computed inside one
  round of one school, and more tenants do not weaken them. The operator role
  decided on 2026-08-20 does not change this either, and the reason is worth
  being precise about: that role may open each school's own map, which is the
  same view that school's own manager sees and is already suppressed. What it may
  not have is a figure computed **across** schools — the guarantee is formulated
  for one population, so two schools whose small groups are each suppressed can
  become readable when added together. Reading many schools one at a time is the
  decision that was taken; reading them as one number is not, and no screen or
  export may offer it.
- **The worker's shared secrets.** `AI_CALLBACK_SECRET` and `MCP_SHARED_SECRET`
  are the operator's own service reaching Core across all tenants by design. That
  stays a trust boundary rather than becoming per-tenant, and it is worth writing
  into the new ADR so it is not mistaken for an oversight.
