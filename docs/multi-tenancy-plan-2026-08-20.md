# Multi-tenancy plan — many schools, each with its own users

Owner decisions, 2026-08-20: the product becomes **multi-tenant with per-tenant
users**, and access is granted by **invitation** rather than by open
registration. This document is the plan those two decisions open. It is a live
plan, not a specification: phase 0 is unblocked, everything after it carries open
questions listed at the end.

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

### Phase 3 — roles start being enforced

- `RolePermissionService` already defines nine actions across `admin` and
  `manager` (`src/lib/auth/roles-and-permissions.ts:3`) and has **zero production
  callers** — its only consumer is `slice-3-roles-audit-membership.test.ts`. The
  session carries `role`, and it is echoed back by `/api/auth/me` and the login
  response and used as an audit label, never as a gate.
- Map the nine actions onto the twelve manager routes and enforce at the same
  chokepoint the scope uses.
- Note the asymmetry this reveals: the current `manager` role is read-only. The
  single deployed account is `admin`, so nobody has met that restriction yet.

### Phase 4 — the audit log survives a restart

`InMemoryAuditLogRepository` (`src/lib/auth/domain-contract.ts:134`) is what
`getAuditLogRepository()` returns, so audit events die with the container. The
`console.info` line beside it lands in a log window nothing collects — the open
operational decision recorded in the handoff. For a product where one tenant's
admin can change another user's access, this stops being optional.

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

1. **Is there a role above the tenant?** Today `MANAGER_ORGANIZATION_ID` makes
   the operator an ordinary member of one school. Support, onboarding and
   debugging across schools need someone who can see more than their own
   memberships — and that role is also the one that can read any school's
   respondent aggregates, so it is a privacy decision, not a convenience.
2. **Who may create a school?** The operator only, or a tenant admin? This decides
   whether `createOrganization` needs a permission above the tenant, and whether
   "school" and "tenant" are the same object at all.
3. **How fast must revocation take effect?** The session is a stateless 24-hour
   JWT (`login/route.ts:103`), and the provider's own comment names the choice:
   *"revocation can be handled via short TTL or a token blacklist"*
   (`jwt-session-provider.ts:233`). A revoked member keeps access for up to a day
   unless something changes — a per-request membership read, a short TTL with
   refresh, or a token version column.
4. **What happens to the current operator's credentials at phase 1?** The password
   is an environment variable today; after phase 1 it is a row. Seeded on first
   boot, migrated by a one-off script, or re-invited like anyone else — and
   `MANAGER_ADMIN_PASSWORD`/`MANAGER_ORGANIZATION_ID` either keep a bootstrap
   meaning or are retired.
5. **Own passwords or an identity provider?** The invitation decision implies own
   passwords, but an IdP is still compatible with invite-only and removes password
   reset, storage and their RTL screens. Many Israeli schools are on Google
   Workspace.
6. **Which e-mail provider**, given it becomes a subprocessor that sees a school
   staff member's address.

## 6. What does not change, and is worth stating so nobody redesigns it

- **The respondent path.** A share code is globally unique
  (`prisma/schema.prisma:29`) and is itself the credential; a respondent never
  authenticates and never names a school. Multi-tenancy does not reach it.
- **The privacy threshold and cell suppression.** Both are computed inside one
  round of one school. More tenants do not weaken them — but note that the
  k-anonymity guarantee is stated for one population, so an operator-level role
  that reads across schools must not be given a cross-tenant aggregate.
- **The worker's shared secrets.** `AI_CALLBACK_SECRET` and `MCP_SHARED_SECRET`
  are the operator's own service reaching Core across all tenants by design. That
  stays a trust boundary rather than becoming per-tenant, and it is worth writing
  into the new ADR so it is not mistaken for an oversight.
