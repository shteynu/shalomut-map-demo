# Multi-tenancy plan — many schools, each with its own users

Owner decisions, all taken on 2026-08-20. The product becomes multi-tenant with
per-tenant users, in a specific shape: **about four platform administrators who
see and do everything**, and **exactly one user per school** who sees only their
own. Access is granted by **invitation** — an administrator creates the school
and invites its user; there is no open registration. **Revocation takes effect
within about fifteen minutes** rather than the current day. What a school user
may *not* do is deliberately left undecided.

§3 is the model and what was decided with it. §4 is the work, in the order it
should happen. §6 is what is still open — phase 0 waits on none of it.

The two questions the first draft of this plan called load-bearing are answered
in §3: there **is** a role above the tenant and it reads data as well as
administering it, chosen over the narrower option the agent recommended; and
revocation is bought with a short session rather than a database read on every
request, which was declined on latency — the database is in Seoul and the
functions in Washington, roughly 180 ms per action.

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
| (a) | one school, several staff | `docs/product-behaviour-backlog.md` §8, and **not** what was chosen — a school gets one user |
| (b) | several schools, one operator | **built** |
| (c) | several schools, each with its own user, isolated, plus administrators above them | **chosen 2026-08-20** — nothing built |

Worth noticing that (a) is not on the way to (c). A second person inside one
school is a different feature from a second school with its own person, and the
decision took the second without the first.

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

**Both `findAll` calls are gone as of 2026-08-23** (`perf/the-scope-asks-for-the-schools-it-needs`,
not on `main` when this line was written). Phase 0 closed the disclosure by
filtering the list after reading it; this closed the read itself. The resolver
now asks `findByIds` for the session's own schools, or — with no memberships —
`findById` and `listIds(2)`, and `loadSchools` narrows in the query rather than
in memory. The diagnosis above is why the boundary had to move and stands as
written; the cost it describes is no longer there.

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

## 3. The model, decided 2026-08-20

Two kinds of person, and the second one is simpler than the types in the
repository currently assume.

| | Who | Attached to | Sees |
| --- | --- | --- | --- |
| **Platform administrator** | about four people | no school | every school, every round, every school's results; creates schools and issues invitations |
| **School user** | exactly one per school | one school | that school only |

Three consequences, and each of them removes work rather than adding it.

**Roles inside a school are not needed yet.** One person per school means there
is nobody to separate. The owner's restrictions on what a school user may do are
deliberately deferred — see phase 6 — and until they are decided a school user
does everything today's manager does, inside their own school.

**Only administrators issue invitations.** There is no "the head teacher invites
a colleague" flow to build, which is most of what phase 2 would otherwise have
been.

**Administrator is a property of the person, not a membership.** An administrator
is not a member of every school; they are outside that system entirely. In the
schema that is a flag on `Manager`, not a row per school — which also means the
number of schools never changes what an administrator's session carries.

One limit follows from the k-anonymity guarantee and is not negotiable by
convenience: an administrator may open **each school's own results**, which is
the same suppressed view that school's own user sees. A figure computed **across**
schools is a different object and stays refused — two schools whose small groups
are each suppressed become readable when added together. Counts are safe: how
many schools, how many rounds, how many responses are cardinalities, not
aggregates over people.

### Decided with it

- **Identity comes from an external provider — Google Workspace / OIDC — and the
  product stores no passwords at all** (owner, 2026-08-20). Many Israeli schools
  are already on Workspace, the whole population is four administrators and one
  person per school, and what this removes is a credential store, a password
  reset, its Hebrew screens, a strength policy and the consequences of a breach.
  It also settles what ADR-013 left open: the SHA-256 hash is not replaced by
  Argon2, it is removed along with the thing it was hashing.
  - The accepted risk is named rather than mitigated: **a school not on Google
    cannot sign in** until a second path exists. The obvious one is an e-mailed
    sign-in link, which needs the same e-mail provider invitations need, so it
    stays available as a later addition rather than a redesign.
  - An invitation stops being a credential and becomes an entitlement: this
    address may sign in, and to what.
- **The first administrator is seeded from the environment**
  (`MANAGER_ADMIN_EMAIL`, and `MANAGER_ADMIN_PASSWORD` only for as long as the
  password path exists at all), and invites the other three through the same
  mechanism that invites school users. One invitation flow serves both,
  differing only in what the invitation grants.
- **An administrator creates the school first, then invites its user.** The
  school exists in the administrator's list before anyone has accepted, and the
  staff size — which sets the floor under the privacy threshold — is set by the
  administrator rather than by the school describing itself.
- **A school user starts with everything today's manager has**, scoped to their
  school: setup, the questionnaire builder, rounds, the map, the breakdown and
  goals.

Assumed rather than asked, and cheap to change: a school may temporarily have no
user, and replacing one is revoke-then-invite rather than a transfer.

## 4. Phases

### Phase 0 — the boundary closes before there is anything to protect

**Implemented 2026-08-20** on `feat/a-chosen-school-needs-a-membership`, which
had not reached `main` when this line was written. Needed none of the open
questions.

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

One caveat the implementation found: unchanged means unchanged *for the deployed
runtime*, which holds one school. A runtime holding more schools than the session
is a member of does behave differently, and visibly — the local database has two
schools, and the setup screen's switcher, which listed both, now lists the one.
That is the disclosure this phase was meant to close, arriving a phase earlier
than the model that makes it matter.

The administrator bypass is **not** part of this phase, because there are no
administrators until phase 1. It arrives as one additional branch in the same
place, which is the argument for putting the check there rather than spreading it.

### Phase 1 — identity becomes a row

**Implemented 2026-08-20** on `feat/identity-becomes-a-row`, which had not
reached `main` when this line was written. Two things landed differently from
the text below and both are marked where they happened; a third, the OAuth
client itself, is the owner's to create and is what the deployed runtime is
waiting for.

- `Manager` and `OrganizationMembership` tables, and repositories behind the
  interfaces that already exist in `src/lib/auth/domain-contract.ts`.
- A platform-administrator flag on `Manager`. The middleware check from phase 0
  gains its second branch: an administrator may open any school that exists.
- ~~`authenticateCredentials` reads the repository instead of building
  `defaultAccounts()`.~~ **Not done, deliberately.** It would have been work on
  a path being deleted, and it would have broken the local accounts that method
  exists to serve, which have no rows. What replaced the intent is stricter:
  where a provider is configured, `authenticateCredentials` refuses outright
  with `PROVIDER_REQUIRED`, so the password path cannot outlive its successor.
  Two ways in never exist at once.
- **Sign-in moves to the identity provider** (decided 2026-08-20). The password
  path is deleted rather than hardened: `hashPassword`, `timingSafeEqualStrings`
  and `authenticateCredentials`'s comparison go with it, and `Manager` never
  gains a credential column. What the callback establishes is an e-mail address;
  what turns it into a session is a `Manager` row and its memberships, which is
  the part this phase builds.
  - The login rate limit stays. It stops guarding a password and starts guarding
    the callback and the session endpoint, which is a different reason for the
    same control.
  - An address with no `Manager` row is refused. Signing in with Google is not a
    way to acquire access; an administrator's invitation is.
- Bootstrap: **on first sign-in rather than on first start**, because there is
  no start — the deployed runtime is functions that come and go, and a cold
  start that writes to the database is a write nobody asked for on every
  scale-up. The occasion is an address the provider has just verified: if it is
  `MANAGER_ADMIN_EMAIL` and no administrator exists, one row is created. It
  grants no school by itself, it creates nobody else, and it stops existing the
  moment an administrator does. The variable becomes a seed and stops being a
  credential, which is also when the outstanding `MANAGER_ADMIN_PASSWORD`
  rotation gate changes meaning and should be re-read.
- The three hardcoded local accounts became the second: two of them already
  could not exist in a deployed runtime, and the third — the operator account
  built from `MANAGER_ADMIN_PASSWORD` — is now unreachable on any runtime that
  has a provider. They are deleted with the password path, once no runtime is
  on it.

What phase 1 does **not** do, and phase 2 must: there is no screen that creates
a school or issues an invitation, so a school user's membership row is written
by hand. An administrator can sign in and read any school; they cannot yet make
one.

`OrganizationMembership` keeps its many-to-many shape even though today every
school user has exactly one school. The types and the JWT already carry a list
(`src/lib/auth/types.ts`), the product constrains it to one, and nothing has to
be migrated the day that constraint is relaxed.

### Phase 2 — the administrator area, and invitations

**Implemented 2026-08-20** on `feat/a-school-gets-its-person`, which had not
reached `main` when this line was written. Half the list below did not survive
the identity decision taken the same day, and each of those is struck through
where it stood.

This is the piece the owner asked for directly, and the minimum useful version is
small: an administrator cannot invite a school user without first seeing the
schools.

- A new `/admin` section, reachable only by a platform administrator. It lists
  the schools and offers **create school** and **invite this school's user**.
  Done, plus a third list: people with a row and nowhere to go, who would
  otherwise be invisible and uncleanable.
- ~~Invitations: signed token → e-mail → the invitee sets their own password.~~
  **None of that exists, because none of it can.** There is no password to set,
  so an invitation carries no credential and needs no delivery: §3 of this
  document already called it an entitlement. The membership is written
  `invited`, the person signs in with their organizational account, and arriving
  is the acceptance — the row becomes `active` on the first successful sign-in.
  `MembershipStatus` was already named for this and had never been used.
  Keeping the state rather than inviting straight into `active` is what lets the
  screen show an invitation nobody used, which is the only way to notice a
  mistyped address.
- The same screen invites another administrator, which is how the remaining three
  arrive. Done. They get no membership and nothing to accept: the flag is the
  entitlement.
- Revocation sets `suspended`. Done, and it is a status rather than a delete
  because the audit log's `manager_id` points at that row. **It is not
  immediate**: the session token carries its memberships for a day, so a revoked
  person keeps working until it expires. That is exactly the gap phase 5 exists
  to close, and until it does, revocation means "from their next sign-in".
- ~~Password strength enforced where a password is set.~~ **No longer
  applicable.** There is no such point. `fix/manager-password-must-be-strong`
  stays withdrawn.
- ~~Hebrew RTL screens for invite, set-password and forgot-password.~~ Two of
  the three do not exist. What was built is the administrator area itself, in
  Hebrew and RTL. The provider's own sign-in screens still need their RTL
  behaviour checked by hand, and have not been — there is no OAuth client yet.
- **An e-mail sender is a new subprocessor** and belongs in
  `docs/data-flow-and-subprocessors.md` before it sends anything. **Off this
  phase's critical path**, and that is the main thing the identity decision
  bought: e-mail is now a notification — "you have been given a school" — rather
  than the way access is delivered, so an administrator can say it out of band
  and nothing waits on the choice of provider.
- **Not in this list, and done anyway: opening a school stopped being something
  any manager can do.** It is this section's own model — the administrator
  creates the school, then invites its user — and it had been quietly broken
  since phase 0: the creator got no membership, so the boundary refused them the
  school they had just opened and the screen bounced them back without saying
  why. The setup screen no longer offers it and the route refuses it with a
  reason.

### Phase 3 — the audit log survives a restart

**Implemented 2026-08-20** on `feat/the-audit-log-survives-a-restart`, which had
not reached `main` when this line was written. One thing landed that the list
below does not ask for, and the third bullet is still open on purpose.

Moved ahead of everything optional by the decision that an administrator reads
any school. `InMemoryAuditLogRepository` (`src/lib/auth/domain-contract.ts:134`)
is what `getAuditLogRepository()` returns, so audit events die with the
container, and the `console.info` line beside it lands in a log window nothing
collects.

Once four people can open every school, that log is the only thing standing
between a legitimate support visit and an unaccountable one. It has to exist
before the administrators do, not after — a role whose use cannot be
reconstructed is a role nobody can defend having granted.

- A Prisma-backed `IAuditLogRepository` behind the interface that already exists.
  Done: `audit_events`, `PrismaAuditLogRepository`, and the repository resolved
  through the composition root — which also removed the one exception
  `check-composition-root.mjs` was carrying, exactly as that exception said it
  would be.
- **An administrator reading another school is itself an audited action**, which
  is a new event type: the current `AuditActionType` list covers writes only
  (`src/lib/auth/manager-audit-service.ts:4`). Done as
  `ADMINISTRATOR_SCHOOL_VISIT`, recorded at `authorizeManagerRound` and
  `loadManagerContext` — the two chokepoints every manager path passes through —
  and **failing closed**: a visit that cannot be written refuses the read, which
  is the only place in the product that refuses on an audit failure. One visit is
  one row per fifteen minutes per administrator per school, because a screen is a
  dozen requests.
- **Not in this list, and done anyway: the writes that were declared and never
  recorded.** Five action types were named when the audit service was written in
  slice 3 and exactly one — `ROUND_RESET` — was ever recorded, so a durable table
  would have been a durable empty table. `ROUND_CREATED`,
  `ROUND_STATUS_UPDATED`, `SETUP_SAVED`, `SURVEY_DEFINITION_UPDATED` and
  `AI_TRIGGERED` now record where they happen. The two membership actions wait
  for the phase 2 screens that raise them.
- Who may read the log, and whether a school can see the visits made to it, is
  worth deciding with the administrators rather than later. **Still open, and
  deliberately.** `getOrganizationAuditLogs` lets an administrator read any
  school's log and a school user their own, and nothing renders either: there is
  no screen and no endpoint. Reading the log today means reading the table.

### Phase 4 — what the administrator can see about every school

The fuller half of the owner's description: how many schools, how many rounds
each has, and the results of any school's round.

- Counts and lists are cardinalities and carry no privacy question.
- Opening one school's results reuses the existing manager screens under an
  administrator's scope, so it is mostly routing rather than new analytics.
- **No screen and no export combines schools into one figure.** This is the
  k-anonymity limit above, and it is the one thing in this phase that has to be
  designed in rather than checked afterwards.

### Phase 5 — the session gets short

The 2026-08-20 revocation decision. The 24-hour stateless session
(`login/route.ts:103`) becomes a short one with silent renewal, and the renewal
is where memberships, the administrator flag and a suspended account are re-read
from the database.

- It can land any time after phase 1, and it is what makes suspension in phase 2
  mean anything within the quarter hour rather than within the day.
- The interval is also an idle-logout timer, so pick the number against how a
  manager actually works — reading a map and writing goals is not a
  keyboard-busy task, and a session that dies mid-reading is a worse defect than
  the one this fixes.

### Phase 6 — what a school user may not do

Deliberately deferred by the owner on 2026-08-20: the restrictions exist in
principle and their content is undecided. Recorded as a phase so that "we will
decide later" stays visible instead of becoming an assumption that no
restrictions were ever wanted.

The machinery is already written and unused: `RolePermissionService` defines nine
actions across `admin` and `manager` (`src/lib/auth/roles-and-permissions.ts:3`)
and has **zero production callers** — its only consumer is
`slice-3-roles-audit-membership.test.ts`. The session carries `role`, and it is
echoed back by `/api/auth/me` and the login response and used as an audit label,
never as a gate. Whatever is decided, the place to enforce it is the chokepoint
phases 0 and 1 already use.

## 5. What this supersedes

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
- `docs/data-flow-and-subprocessors.md` — gains two things before they exist: that
  a platform administrator can read any school's results, and the e-mail
  subprocessor.

## 6. Still open

1. **The OAuth client itself.** Phase 1 is written and verified against a
   stand-in provider; the deployed runtime signs in through Google only once a
   Web application client exists in Google Cloud Console and its four `OIDC_*`
   values are set, with
   `https://<deployment>/api/auth/oidc/callback` listed verbatim as an
   authorized redirect URI. Until then the deployment keeps the password screen.
   This is the owner's to create, and it falls under the standing approval gate
   on authentication configuration.
2. **Which e-mail provider**, given it becomes a subprocessor that sees a school
   staff member's address. Less urgent than it was twice over: with sign-in on
   the identity provider, e-mail carries an invitation and not a credential — and
   phase 2 then shipped without it, because an entitlement needs no delivery. It
   buys a notification rather than a mechanism, so it is now a convenience and
   not a blocker for anything.
3. **What a school user may not do** — phase 6, deferred on purpose.

**Own passwords or an identity provider** was the question that blocked phase 1,
and the owner answered it on 2026-08-20: the identity provider, with no passwords
stored. It is recorded in §3. The provider became a subprocessor in
`docs/data-flow-and-subprocessors.md` in the same task, before anyone signed in
through it.

## 7. What does not change, and is worth stating so nobody redesigns it

- **The respondent path.** A share code is globally unique
  (`prisma/schema.prisma:29`) and is itself the credential; a respondent never
  authenticates and never names a school. Multi-tenancy does not reach it.
- **The privacy threshold and cell suppression.** Both are computed inside one
  round of one school, and more tenants do not weaken them. The administrator
  role does not change this either, and the reason is worth being precise about:
  that role may open each school's own map, which is the same view that school's
  own user sees and is already suppressed. What it may not have is a figure
  computed **across** schools.
- **The worker's shared secrets.** `AI_CALLBACK_SECRET` and `MCP_SHARED_SECRET`
  are the operator's own service reaching Core across all tenants by design. That
  stays a trust boundary rather than becoming per-tenant, and it is worth writing
  into the new ADR so it is not mistaken for an oversight.
