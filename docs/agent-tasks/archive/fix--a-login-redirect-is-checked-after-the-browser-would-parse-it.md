# A login redirect is checked in the words the browser will read it in

## Metadata

- Branch: `fix/a-login-redirect-is-checked-after-the-browser-would-parse-it`
- Base branch: `main`
- Base commit: `b78a9fb`
- Current HEAD: `92d8cc2` plus the documentation commit that follows it
- Status: code complete, verified, awaiting the owner's push
- Last updated: 2026-08-22
- Last agent/tool: Claude Code (Opus 5)

## Objective

Close the authz medium of the 2026-08-21 audit: `resolveLoginRedirect` rejected
an off-product destination by its first two characters, which is not how a
browser reads the value.

## User-visible outcome

`/login?next=<anything naming another host>` lands on this product's home
screen. Nothing else changes for a manager: an in-product destination is still
honoured, now in the parser's normalised spelling.

## Context

`middleware.ts` writes the pathname a manager was heading for into `next`, and
the login screen sends them back there afterwards. The value reaches the screen
through the query string, so it is attacker-controlled regardless of what the
middleware writes.

## Scope

- `src/lib/navigation.ts` — `resolveLoginRedirect`.
- `src/app/api/auth/oidc/callback/route.ts` — re-check at the point of use.
- Tests in `src/lib/__tests__/navigation.test.ts` and
  `src/app/api/auth/oidc/__tests__/oidc-sign-in.test.ts`.
- ADR-038, `PROGRESS.md`, the audit file, this file, the handoff.

## Non-goals

- Signing the OIDC handshake cookie. The re-check makes its `next` harmless;
  whether `state`, `nonce` and the code verifier want a signature is a separate
  question about a separate threat.
- Any other redirect in the product. The middleware's own redirect is built
  from `request.nextUrl.pathname`, which is already parsed.

## Acceptance criteria

- A destination naming another host is refused whole, however it spells the
  host.
- What is honoured comes back parsed, so no control character survives into a
  `Location` header.
- The OIDC callback refuses a smuggled destination even though the start route
  already checked one.

## Relevant repository instructions

`.agents/skills/shalomut-map`, `.agents/skills/shalomut-verification`,
`.agents/skills/shalomut-tracker`.

## Relevant architecture and contracts

`PROJECT_CONTEXT.md` ADR-025 to ADR-027 (identity and sign-in), and the new
ADR-038.

## Decisions made

- Parse against `https://login-redirect.invalid` and require the origin back,
  rather than adding `/[\x00-\x1f]/` to the prefix rule. Both were offered by
  the audit; the parser is the stronger of the two because it is the thing
  performing the normalisations a prefix rule would have to enumerate.
- Return the parser's output rather than the candidate.
- Refuse a host-naming candidate whole rather than reducing it to its path.
- Keep the `startsWith("/")` gate, which the parser does not need but the
  contract does.
- Re-check in the OIDC callback. The handshake cookie is unsigned JSON.

## Assumptions

- Node's WHATWG `URL` and the browsers this product supports agree on which
  characters are stripped before parsing. This is specified behaviour, not an
  implementation detail.

## Completed

Everything in scope.

## In progress

Nothing.

## Remaining

Nothing on this branch. The push is the owner's.

## Changed files

- `src/lib/navigation.ts`
- `src/lib/__tests__/navigation.test.ts`
- `src/app/api/auth/oidc/callback/route.ts`
- `src/app/api/auth/oidc/__tests__/oidc-sign-in.test.ts`
- `PROJECT_CONTEXT.md`, `PROGRESS.md`, `docs/critical-audit-2026-08-21.md`,
  `docs/shalomut-tracker-handoff.md`, this file

## Verification evidence

### Passed

- The finding was reproduced before the fix, not assumed: a probe applying the
  old rule and then `new URL(candidate, origin)` showed `/<LF>/evil.example`,
  `/<CR>/evil.example` and `/<TAB>\evil.example` all passing the gate and all
  landing on `https://evil.example`.
- `npm run verify:core`, unpiped, `REAL_EXIT=0`. 1424 tests, no failures.
- Five mutations, each caught:
  1. back to the prefix check → 3 failures
  2. origin check removed → 2 failures
  3. echo the candidate instead of the parsed path → 1 failure
  4. callback trusts the handshake again → 1 failure
  5. leading-slash gate removed → 1 failure
  The tree was restored from a scratchpad copy after each; the focused suite is
  green again (43/43).
- Signed-in browser walk on `next start -p 3210`: signing in from
  `/login/?next=%2F%0A%2Fevil.example` landed on `http://localhost:3210/`. No
  console errors.

### Failed

None.

### Blocked or not run

- `npm run verify:db` — not run. No repository, schema or migration code
  changed.

### Environment

Local. The walk used the interim password door, with `OIDC_*` blank and a
throwaway `MANAGER_ADMIN_PASSWORD` and `MANAGER_ADMIN_EMAIL` in the child
environment only.

### Residual risk

Low. The change only narrows what is accepted, and the one behaviour change for
a legitimate destination is that it comes back normalised — which is where a
browser would have taken it anyway.

## Failed approaches

- Mutation 2 survived the first attempt. Removing the origin check caught
  nothing, because every test candidate that named a host had `/` for its path,
  so the parser's `pathname` was the fallback by coincidence. Fixed by adding
  `//example.com/goals` and `/<LF>/example.com/goals`, which distinguish
  "refused whole" from "reduced to its path".
- The first draft of the parser test asserted `/round<0x01>` came back as
  `/round%01`. It comes back as `/round`: the parser removes leading and
  trailing C0 controls outright. The test now puts the control character in the
  middle, and says why.

## Known risks

None identified.

## Approval gates

The push. `git push` is an owner action here.

## Questions requiring an owner decision

None from this slice. Standing: rotate `GEMINI_API_KEY` before any paid round;
decide whether pagination and server-side search in the administration console
are worth a slice.
