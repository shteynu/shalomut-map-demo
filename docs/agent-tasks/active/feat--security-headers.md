# The application sends security headers

## Metadata

- Branch: `feat/security-headers`
- Base branch: `fix/questionnaire-speaks-to-everyone` (**not** `main` — see
  Decisions). Written first against `test/respondent-path-e2e` and rebased on
  top of the wording branch afterwards, so the three land as fast-forwards in
  one order instead of colliding in `docs/shalomut-tracker-handoff.md`.
- Base commit: `5cf826e`
- Current HEAD: see `git log -1`
- Status: implementation complete, verified locally, waiting on a push
- Last updated: 2026-08-10
- Last agent/tool: Claude Code (Opus 5)

## Objective

Close Tier 0 item 1: the application sent no security headers at all.
`next.config.ts` had no `headers()` and there is no `vercel.json`.

## User-visible outcome

None visible. What changes is what a browser refuses on the product's behalf —
above all, framing a signed-in manager screen.

## Context

The manager screens carry one-click destructive actions: close a round, reset
an analysis, archive. With no `frame-ancestors` and no `X-Frame-Options`, any
page could load them in an invisible iframe over its own buttons and let a
signed-in manager click them.

## Scope

- `next.config.ts`: `headers()` with a CSP and five companion headers.
- A route-specific exception for `/api-docs`.
- `e2e/security-headers.spec.ts`: the regression guard.
- `docs/data-flow-and-subprocessors.md`: what the browser is told.

## Non-goals

- Nonce-based CSP. See Decisions.
- Self-hosting Swagger UI, which would remove the `/api-docs` exception. It is
  the better fix and it is a different task.
- `vercel.json`. Everything here is Next-level, so the headers travel with the
  application rather than with one host's configuration.

## Acceptance criteria

- Every route carries the headers; exactly one CSP header per response.
- No screen breaks — the whole product walked under the enforced policy with
  zero violations.
- `/api-docs` keeps working, and its exception does not leak.

## Relevant repository instructions

- `AGENTS.md`: verification in proportion to risk; auth/security changes get
  security-focused diff review.

## Decisions made

- **Enforced, not report-only.** The earlier plan was to ship
  `Content-Security-Policy-Report-Only` first. That was the wrong instinct:
  report-only with no collector writes violations to a teacher's console where
  nobody reads them. Instead the policy was verified directly — every manager
  screen, the docs screen and the respondent flow, driven in a real browser
  with a `securitypolicyviolation` listener attached — and shipped enforced.
- **`script-src` keeps `'unsafe-inline'`.** Next serves the RSC payload as
  inline script tags on every page. The only alternative is a per-request
  nonce, which Next reads from the request CSP header — and which makes every
  page dynamic. `/login`, `/_not-found` and `/api-docs` are statically
  rendered, and `/login` is the first screen a manager meets. So the policy
  stops a *foreign* script, not an injected one; the product renders no
  user-authored HTML, so that is the thinner half of the risk.
- **`/api-docs` gets its own header rather than unpkg going global.** It is the
  only screen in the product that runs someone else's code.
- **The exclusion is written into the general `source`, not left to order.**
  Two matching entries do not merge into the stricter policy — the later one
  replaces the earlier one's CSP outright, which silently undid the exception.
- **HSTS without `preload`.** Preload is a one-way door on a domain that is
  still an operational staging alias.
- **Stacked, not parallel.** The branch was written against
  `test/respondent-path-e2e` — the respondent walk is what proves the policy
  does not break hydration — and then rebased onto
  `fix/questionnaire-speaks-to-everyone`. Two branches off the same parent both
  editing `docs/shalomut-tracker-handoff.md` would have made the second push a
  non-fast-forward, so the stack is linear: item 4, then item 3, then item 1.

## Assumptions

- The deployed host adds no headers of its own that would conflict. Not checked
  against the deployment — see Blocked.

## Completed

- `next.config.ts`: CSP plus `X-Content-Type-Options`, `Referrer-Policy`,
  `X-Frame-Options`, `Permissions-Policy`, `Strict-Transport-Security`, with
  `'unsafe-eval'` and `ws:` added in development only, and a comment above each
  decision that would otherwise read as an oversight.
- `e2e/security-headers.spec.ts`: three tests, asserting on real responses from
  the production build rather than on the config object.
- `docs/data-flow-and-subprocessors.md`: a "What the browser is told" section
  and a fourth entry in its edit checklist.

## In progress

Nothing.

## Remaining

- Push, after `test/respondent-path-e2e`.
- Tier 0 item 2 (incoming rate limiting) is the last one open.

## Changed files

- `next.config.ts`
- `e2e/security-headers.spec.ts` (new)
- `docs/data-flow-and-subprocessors.md`
- `docs/agent-tasks/active/feat--security-headers.md` (this file)

## Verification evidence

### Passed

- `curl -I` on `/`, `/login/`, `/answer/<code>/` and `/api-docs/` against a
  production build: exactly one `Content-Security-Policy` per response, and
  only `/api-docs/` carries `https://unpkg.com`.
- Real browser walk under the enforced policy, signed in, with a
  `securitypolicyviolation` listener: `/`, `/round/`, `/survey/`, `/dashboard/`,
  `/goals/`, `/setup/`, `/api-docs/`, then the respondent link with the session
  cleared — consent accepted, question answered, progress advanced to 2 of 24.
  **Zero violations.** Answering proves hydration survives the policy.
- Falsification of the `/api-docs` exception: with the exception removed and
  rebuilt, the same walk reports `style-src-elem blocked
  https://unpkg.com/...swagger-ui.css` and `script-src-elem blocked
  https://unpkg.com/...swagger-ui-bundle.js` — the whole screen. Restored and
  rebuilt afterwards.
- Falsification of the header spec: it failed first, honestly — `request.get`
  followed the manager gate's redirect and read `/login`'s policy. Fixed with
  `maxRedirects: 0`, which is now commented in the test.
- `npm run test:e2e` — 13 passed under the enforced policy; the added spec
  brings it to 16 when run together.
- `npm test` — 844 pass. `npm run typecheck`, `npm run lint` — clean.
- Development mode: the dev server serves `'unsafe-eval'` and `ws: wss:`, and
  the browser logs `[HMR] connected` with no CSP refusals.

### Failed

None outstanding.

### Blocked or not run

- The deployed endpoint. Headers were not checked there, and cannot be until
  the branch is pushed and Vercel redeploys. First thing to check after the
  push: `curl -I` the deployed alias for one CSP header and `frame-ancestors`.
- A real cross-origin framing attempt. The policy is asserted, not attacked.

### Environment

Local. Production build served by `next start` on port 3210 with throwaway
credentials invented for the run, and by Playwright's own server on 3100.

### Residual risk

- `'unsafe-inline'` in `script-src`, discussed above and commented in the
  config. An injected string still runs; what it cannot do is call home,
  reframe, or repoint a form.
- `/api-docs` runs a CDN script under its own looser policy. Unreachable from
  this sandbox, so the screen was never seen rendering — only its script tag
  and the absence of a refusal were checked.
- HSTS for two years is a commitment to keep serving HTTPS on that host. Vercel
  does; a future custom domain must too.

## Failed approaches

- Relying on rule order for the `/api-docs` exception: the later rule replaces
  the earlier one's CSP, so `/api-docs` silently got the strict policy. Caught
  by `curl -I`, fixed with a negative lookahead in the general `source`.
- Changing `next.config.ts` and restarting `next start` without rebuilding:
  headers are baked into the build manifest, so the server kept serving the old
  policy. Both falsification runs above needed a rebuild.

## Known risks

`Independent review recommended.` — this is a security-surface change.

## Approval gates

None passed through. No secrets, credentials, aliases or deployed state.

## Questions requiring an owner decision

None.

## Next concrete step

Push `test/respondent-path-e2e`, then this branch; `curl -I` the deployed alias
to confirm the headers survived the platform. Then Tier 0 item 2 — incoming
rate limiting on `POST /api/auth/login` and the respondent submission, which
needs an owner decision about Upstash or an equivalent, because in-process
counters do not survive serverless.
