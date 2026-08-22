# The hygiene findings of the audit

## Metadata

- Branch: `fix/the-hygiene-findings-of-the-audit`
- Base branch: `main`
- Base commit: `262583a`
- Current HEAD: `b50247a` is the last of the six fixes; `57c9e58` is the tip,
  and it is now also `origin/main`
- Status: closed — landed on `main` as `57c9e58` and deployed to Core
- Last updated: 2026-08-23
- Last agent/tool: Claude Code (Opus 5)

## Objective

Close the hygiene cluster of the 2026-08-21 audit — seven low findings that
share nothing but their size — in one pass, one commit each.

## User-visible outcome

One line of Hebrew under the background-note field on the round setup screen,
saying that the note is sent verbatim to the model and asking for no names.
Everything else is invisible to a manager and to a respondent.

## Context

Each of these was re-read at its anchor before it was touched; the audit's own
rule for the medium and low entries is that they were restored as written and
may have closed by accident since. None had. Six were real at the line the
audit named, and the seventh — the temporary password door — was left alone
because it has its own branch and because the owner's 2026-08-20 decision that
identity comes from Google supersedes rather than repairs it.

## Scope

- `src/lib/services/round.service.ts` and its tests — rejection sampling.
- `src/lib/server/rate-limit.ts`, `src/app/api/survey/[shareCode]/attempt/route.ts`
  and its tests — a bucket for the funnel beacon.
- `src/lib/deployment-runtime.ts` (new), `src/lib/server/shared-secret.ts`,
  `src/lib/auth/jwt-session-provider.ts`, `src/lib/auth/manager-auth-service.ts`
  and a new test — one deployed predicate, constant-time comparison.
- `scripts/clear-db.ts`, `src/lib/repositories/prisma/managed-tables.ts` (new)
  and its tests — clear the whole schema.
- `src/app/api-docs/page.tsx` — subresource integrity.
- `src/components/round/background-note-warning.tsx` (new),
  `src/components/round/setup-form.tsx` and its test — the warning.
- `docs/critical-audit-2026-08-21.md`, `PROGRESS.md`, this file.

## Non-goals

- **The temporary password door** (`manager-auth-service.ts:60`). It is the
  seventh finding in the cluster and stays open here: `fix/manager-password-
  must-be-strong` exists for it, and the identity decision of 2026-08-20 may
  remove the door rather than harden it.
- Vendoring `swagger-ui-dist` into the repository. The audit offered it as the
  alternative to SRI; SRI is the smaller change and closes the stated risk,
  which is integrity rather than availability.
- Diagnosing why `/api-docs` does not initialize Swagger UI in local
  development. Found on the way through, pre-existing, and not this task — see
  "Verification evidence".

## Acceptance criteria

- Every character of a share code is equally likely, and the comment says only
  what is true.
- The funnel beacon cannot be used to write rows without bound, and refusing
  one costs a respondent nothing.
- No runtime that is deployed can be authorized by an unset shared secret.
- `npm run db:clear` leaves no table with rows, and says so only when true.
- The Swagger UI bundle is refused if its bytes change.
- A manager cannot type the background note without being told where it goes.

## Relevant repository instructions

`AGENTS.md`: respondent identity is a product invariant, which is what the
beacon limit and the background-note warning are both about. Nothing here
changes a credential, a secret or a deployment variable.

## Relevant architecture and contracts

ADR-039 already says the round ceiling bounds rows rather than the ratio; the
beacon bucket is the same shape of answer for the funnel table. No contract
changes; `background_context.notes` still reaches the prompt exactly as before,
which is the fact the new warning describes rather than alters.

## Decisions made

- **Rejection sampling rather than a 32nd share-code character.** The alphabet
  omits `0/O` and `1/I/L` because the code is read off a slide and typed by
  hand; adding one back costs more than discarding 3% of bytes.
- **`generateShareCode` takes a byte source.** A statistical test of uniformity
  is either slow or flaky; a scripted `250` proves the rejection rule exactly.
- **Six hundred beacons per five minutes**, derived from the legitimate side —
  about five per filling session, a hundred and twenty simultaneous
  respondents — rather than from what an attacker would need.
- **The beacon refuses with the same `204` as everything else it refuses.** A
  `429` would locate the ceiling for anyone probing and the real client never
  reads the reply.
- **One `isDeployedRuntime`, in `src/lib/`.** Three copies existed and the one
  guarding the machine door had drifted into asking only about `VERCEL_ENV`.
  The build phase stays excluded, exactly as the two correct copies had it.
- **Digests, not raw strings, into `timingSafeEqual`.** It throws on unequal
  lengths, so comparing raw values would answer "wrong length" instantly and
  "wrong bytes" slowly. Two SHA-256 digests are always 32 bytes.
- **`TRUNCATE ... CASCADE` over a hand-ordered `deleteMany` chain**, with the
  table list derived from Prisma's DMMF. The old script's reliance on cascades
  reaching what it had not named is why `audit_events` — which has no incoming
  foreign key — was never cleared.
- **SRI rather than vendoring**, with digests taken from the npm registry
  tarball rather than from the CDN. A hash taken from the same place the risk
  comes from proves nothing.
- **The warning is a component with a test**, following `StaffFloorWarning`:
  the sentence is a rule the product makes about itself.

## Assumptions

- `swagger-ui-dist@5.11.0` on npm is immutable, so the digests stay valid until
  somebody moves the version. The comment says to recompute from the registry
  when they do.

## Completed

Everything in scope.

## In progress

Nothing.

## Remaining

Nothing on this branch. The push is the owner's.

## Changed files

- `src/lib/services/round.service.ts`, `src/lib/services/__tests__/share-code.test.ts`
- `src/lib/server/rate-limit.ts`, `src/app/api/survey/[shareCode]/attempt/route.ts`,
  `src/app/api/__tests__/survey-attempt.test.ts`
- `src/lib/deployment-runtime.ts` (new), `src/lib/server/shared-secret.ts`,
  `src/lib/server/__tests__/shared-secret.test.ts` (new),
  `src/lib/auth/jwt-session-provider.ts`, `src/lib/auth/manager-auth-service.ts`
- `scripts/clear-db.ts`, `src/lib/repositories/prisma/managed-tables.ts` (new),
  `src/lib/repositories/prisma/__tests__/managed-tables.test.ts` (new)
- `src/app/api-docs/page.tsx`
- `src/components/round/background-note-warning.tsx` (new),
  `src/components/round/setup-form.tsx`,
  `src/components/round/__tests__/background-note-leaves-the-platform.test.tsx` (new)
- `docs/critical-audit-2026-08-21.md`, `PROGRESS.md`, this file

## Verification evidence

### Passed

- **Every finding was re-read at its anchor first.** All six were still true as
  the audit described them; the line numbers had not even moved.
- **`npm run verify:core`, unpiped, `REAL_EXIT=0`.** 1452 Node tests — 17 more
  than the 1435 this branch started from — plus 576 Python tests and the build.
  Run twice: once with all six fixes in place, and again after the working tree
  had been stashed and restored during the browser work.
- **Subresource integrity, in a real browser, with a negative control.** A
  standalone page served over `http://localhost` loaded both files from unpkg
  with the shipped digests: stylesheet accepted, script accepted,
  `SwaggerUIBundle` is a function. The same page loaded a third file from the
  same host with one deliberately wrong digest and the browser refused it — so
  the check is enforced here rather than silently ignored.
- **The digests are the registry's, and the CDN agrees.** `npm pack
  swagger-ui-dist@5.11.0`, SHA-384 of the two files; `curl` of the same two
  files from unpkg hashes to the same values, and unpkg answers
  `Access-Control-Allow-Origin: *`, which `crossOrigin="anonymous"` needs.
- **The background-note warning, on the running application, signed in.** On
  `/setup/` the paragraph reads
  "ההערה נשלחת כלשונה למודל שכותב את המפה, ולכן היא יוצאת מהפלטפורמה…", it lays
  out at 1130x26 in the flow, and the textarea's `aria-describedby` resolves to
  its id — so a screen reader reaches the warning from the field it is about.
- **The share code's rejection rule, deterministically.** A scripted byte
  source beginning `250, 251, 255, 248` produces `SHALOM-ABCDEFGHJK`: the four
  rejected bytes are discarded rather than folded, where `250 % 31` would have
  written `C`. A second test pins that 248 is the ceiling by showing every one
  of the 31 characters owns exactly eight bytes below it.
- **The beacon limit, through the real route.** 605 requests from one address
  write exactly 600 rows, each with a distinct token hash so the repository's
  upsert is not what bounds them, and every one of the 605 answers `204`. A
  neighbouring address still writes after the first is exhausted.
- **The deployed predicate, in the direction that was broken.**
  `NODE_ENV=production` with no `VERCEL_ENV` now refuses an unconfigured
  secret; local development still passes; the production build still does not
  count as deployed.
- **The clear-db table list against the schema itself.** The derived list
  equals every `@@map` in `prisma/schema.prisma`, including the six the old
  script never named, and `_prisma_migrations` is not on it.

### Failed

None.

### Blocked or not run

- **None of the six was walked on the deployment.** They are in the deployed
  tree — `GET /api/health/` answers `57c9e58` — and each was proved locally.
  Walking the beacon limit there would mean writing six hundred fabricated
  funnel rows into the deployed database to watch the six hundred and first be
  refused, which costs the demo round's funnel more than the check is worth;
  the rest are invisible from outside.
- **`npm run db:clear` was never executed.** It is an owner action in this
  environment. What was proved instead is the half that was wrong — the table
  list — plus the statement it builds; the `TRUNCATE` itself is one ordinary
  statement. Someone should run it once against the local database before
  trusting the new closing message.
- **The Swagger UI attributes were not observed on `/api-docs` itself**, for
  the reason under "Failed approaches".

### Environment

Local. `npm run dev` on :3000 against the local Postgres container, signed in
through the local password door (`admin123`, the in-source default for a
non-deployed runtime). A static server on :8099 for the integrity harness. Both
stopped afterwards. Nothing was written to any deployed system.

### Residual risk

The beacon limit is per-instance without Upstash configured, like every other
policy in that module — so on the serverless deployment the real ceiling is 600
times however many instances are warm. That is a property of the limiter rather
than of this bucket, and the module says so at the top.

## Failed approaches

- **Observing the SRI attributes on `/api-docs` in local development.** The
  page never injects the script: no request to unpkg appears, `SwaggerUIBundle`
  stays `undefined`, no console error is logged, and `#swagger-ui` renders
  empty. The effect simply does not run. **This is pre-existing** — the same
  probe on the stashed, unmodified file behaves identically — so it is a
  separate defect rather than a regression from this branch, and the attributes
  were proved on a standalone harness instead. Worth its own look: the page is
  the only surface that documents this API.
- **A unit test rendering `SetupForm`.** It calls `useRouter`, and no test in
  this repository has ever needed an app-router harness. Extracting the warning
  into its own component — which is what `StaffFloorWarning` already does on
  this screen — was cheaper than the harness and is the better shape anyway.
- **Tampering one hash to prove `--require-hashes`-style enforcement**, carried
  over from the previous task and repeated here in the SRI harness: one wrong
  digest among the permitted set changes nothing. The negative control has to
  be a resource whose *only* digest is wrong.

## Known risks

The Swagger digests are pinned to a version. Moving `swagger-ui-dist` without
recomputing them leaves a page that silently fails to load its own
documentation — the same failure mode as today's local behaviour, which is
exactly why that behaviour is worth diagnosing separately.

## Approval gates

The push. `git push` is an owner action here.

## Questions requiring an owner decision

- **The temporary password door.** Harden it on
  `fix/manager-password-must-be-strong`, or remove it because identity comes
  from Google now? The audit's seventh hygiene finding stays open until that is
  answered.
- Standing: rotate `GEMINI_API_KEY` before any paid round; the server-issued
  attempt token; pagination and server-side search in the administration
  console; the unverified `prisma migrate deploy` path from ADR-040.

## Git state

Read 2026-08-23, after the push:

- `origin/main` is `57c9e58`, which is this branch's tip: the seven commits are
  landed and this file joins the archive.

  | commit | |
  | --- | --- |
  | `4774f11` | the share code's uniformity claim becomes true |
  | `c08b074` | the funnel beacon gets a bucket of its own |
  | `9619ab7` | one predicate for "deployed", and a constant-time machine door |
  | `a3c156f` | clearing the database clears all of it |
  | `9829c3a` | the CDN script is checked before it runs |
  | `b50247a` | the background note says where it goes |
  | `341f6ca`, `57c9e58` | the documentation for both |

- Worktree clean apart from ` M next-env.d.ts`, which is generated and belongs
  to the owner. Nothing staged. `git ls-files -o --exclude-standard` is empty.
- Vercel built it; `GET /api/health/` answers `57c9e58`. Render did not build,
  and that is the correct outcome — see "Next concrete step".

## Next concrete step

None on this branch. Two things are true after it and belong to whoever reads
this next:

- **The two halves are deliberately at different commits.** Core is `57c9e58`
  and the AI service is `262583a`, because nothing here touches
  `render.yaml`'s `buildFilter` paths. That is a service that was correctly not
  rebuilt, not a missed deploy — the prediction was made before the push and
  the endpoint confirmed it after.
- **`npm run db:clear` still wants one run** against the local database. It is
  an owner action in this environment, so the rewritten script's closing
  message has never been printed by the script itself.
