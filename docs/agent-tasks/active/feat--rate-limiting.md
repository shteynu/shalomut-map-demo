# Incoming requests are rate limited, and ready for Upstash

## Metadata

- Branch: `feat/rate-limiting`
- Base branch: `main`
- Base commit: `230ee44`
- Current HEAD: see `git log -1`
- Status: implementation complete, verified locally, waiting on a push
- Last updated: 2026-08-10
- Last agent/tool: Claude Code (Opus 5)

## Objective

Close Tier 0 item 2, the last of the four: nothing counted incoming requests.
`POST /api/auth/login` accepted password guesses as fast as they arrived.

## User-visible outcome

Nothing, until someone misbehaves: the eleventh sign-in attempt from one
address inside five minutes is answered `429` with `Retry-After`, in Hebrew.

## Context

One deployment has one manager account (ADR-020), so an attacker's entire
search space is that account's password. The respondent submission is the only
unauthenticated write in the product and is limited too, far more loosely —
see Decisions.

## Scope

- `src/lib/server/rate-limit.ts`: policies, address resolution, two stores.
- The two route handlers.
- Unit tests, endpoint tests, one browser spec.
- `docs/openapi.yaml` `429` on the submission, `.env.example`, three docs.

## Non-goals

- `POST /api/survey/{shareCode}/attempt`, the funnel beacon. It fires three
  times per attempt, so a staffroom generates hundreds legitimately and the
  number needs its own thinking rather than a copied policy. Left deliberately,
  named here so it is not mistaken for an oversight.
- Middleware-wide limiting. It would put a network call in front of every
  request including static navigation; the two endpoints that can be abused
  are the two that pay for it.
- A dashboard or alert for refusals. Refusals are logged, nothing aggregates
  them.

## Acceptance criteria

- The limit holds per address, per policy, and does not leak between them.
- An unreachable store does not lock anyone out.
- The browser suite does not rate-limit itself.
- Turning on Upstash requires two environment variables and nothing else.

## Decisions made

- **Upstash over its REST API, not the client library.** `fetch` to
  `/pipeline` with `INCR` and `EXPIRE ... NX` adds no dependency, needs no
  install, and works on every runtime the app deploys to. Set
  `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` and the counters move
  to shared Redis; unset, they are per-instance and the module says so.
- **The submission limit is 60 per five minutes, which is loose on purpose.**
  A staffroom answers from one school address. The realistic burst is a staff
  meeting where forty teachers answer at once, and a limit tuned for a script
  would refuse exactly when the product is working. The narrow defence against
  stuffing is the per-attempt token the round already refuses a repeat of.
- **Sign-in is limited before the password is read**, so the refusal is
  identical whether the guess was right or wrong and cannot be used as an
  oracle.
- **Loopback is not a client identity.** See Failed approaches — this was
  found by the suite going red, not reasoned out in advance.
- **Addresses are hashed and salted before they are stored.** The consent
  screen promises a respondent that their address is not kept beside their
  answers; a bucket of plain addresses in Redis would be a list of who opened
  the questionnaire and when. Salt is `RATE_LIMIT_KEY_SALT` or `SESSION_SECRET`.
- **Fail open.** A limiter that cannot reach its store can either let guesses
  through or lock the school's only manager out of their dashboard because
  Redis is having an afternoon. The second is an outage the product caused
  itself.

## Assumptions

- On Vercel `x-forwarded-for` is written by the platform and cannot be spoofed
  by the caller. If the app is ever served from an origin reachable without
  that proxy, the header becomes attacker-controlled and this needs revisiting.

## Completed

- `src/lib/server/rate-limit.ts` — `RATE_LIMITS`, `clientAddress`,
  `consumeRateLimit`, `getRateLimitResponse`, in-memory and Upstash stores, and
  a `resetRateLimitStore` seam.
- `POST /api/auth/login` and `POST /api/survey/{shareCode}/submit` call it.
- `src/lib/server/__tests__/rate-limit.test.ts` — 9 tests.
- `src/app/api/__tests__/rate-limited-endpoints.test.ts` — 3 tests, proving the
  handlers call it and that a staffroom's forty answers pass.
- `e2e/rate-limit.spec.ts` — both directions through a real server.
- `docs/openapi.yaml` `429` plus `Retry-After`, regenerated
  `public/openapi.json`.
- `.env.example`, `docs/local-environment.md`,
  `docs/data-flow-and-subprocessors.md` (including that Upstash would be a
  fourth processor), `PROGRESS.md`.

## In progress

Nothing.

## Remaining

- Push. Optionally provision Upstash — see Questions.

## Changed files

- `src/lib/server/rate-limit.ts` (new)
- `src/app/api/auth/login/route.ts`
- `src/app/api/survey/[shareCode]/submit/route.ts`
- `src/lib/server/__tests__/rate-limit.test.ts` (new)
- `src/app/api/__tests__/rate-limited-endpoints.test.ts` (new)
- `e2e/rate-limit.spec.ts` (new)
- `docs/openapi.yaml`, `public/openapi.json`
- `.env.example`, `docs/local-environment.md`,
  `docs/data-flow-and-subprocessors.md`, `PROGRESS.md`
- `docs/agent-tasks/active/feat--rate-limiting.md` (this file)

## Verification evidence

### Passed

- `npm test` — 856 pass, 0 fail (844 before this branch).
- `npm run typecheck`, `npm run lint` — clean.
- `npm run test:e2e` — 18 passed.
- `npx tsx --test src/app/api/__tests__/openapi.test.ts` — 8 pass after
  `npm run openapi:generate`.
- Over HTTP against a production build, with the limiter's own numbers:
  twelve sign-in attempts from loopback answered `401` twelve times; the same
  twelve carrying `x-forwarded-for: 203.0.113.77` answered `401` ten times then
  `429`, with `retry-after: 300`.

### Failed

- The full browser suite went red before the loopback rule existed:
  `mobile-chrome` respondent spec failed at sign-in after the earlier specs had
  spent the bucket. Fixed, and both directions are now asserted in
  `e2e/rate-limit.spec.ts`.

### Blocked or not run

- **Upstash itself was never contacted.** The REST store is written and typed
  but no credentials exist, so its code path has run only in the sense that it
  is never selected. Its first real execution will be the first request after
  the variables are set — check for `Rate limit store unavailable` in the logs
  at that moment, which is what a wrong URL or token looks like.
- The deployed endpoint: not checked, same as the headers branch.
- Behaviour under real concurrency: the in-memory store is not atomic across
  simultaneous requests in one instance. `INCR` is atomic, so Upstash does not
  share this.

### Environment

Local. Production build on port 3210 with throwaway credentials, and
Playwright's own server on 3100.

### Residual risk

- Without Upstash this is a speed bump: on serverless the effective ceiling is
  the limit times however many instances are warm. That is stated in the module
  and in `.env.example`, and it is the reason the Upstash path exists.
- The in-memory store grows with distinct addresses inside a window and is
  swept only on write. A flood from many addresses would hold memory for one
  window. Upstash removes this too.

## Failed approaches

- **Assuming a server with no proxy sends no `x-forwarded-for`.** Next's own
  server fills it in from the socket, so every request to a locally served
  build arrived as `::1`, the whole browser suite counted as one caller, and it
  started refusing itself at the eleventh sign-in. The unit tests could not see
  this — they choose their own headers. Loopback is now treated as no client
  identity, which is also correct on the deployment, where the platform writes
  a real address and loopback never appears.

## Known risks

`Independent review recommended.` — an authentication-adjacent security
control.

## Approval gates

- Provisioning Upstash means creating an account and storing two credentials in
  the deployment. That is the owner's, and nothing here does it.

## Questions requiring an owner decision

- Switch Upstash on, or leave the in-memory speed bump until there are real
  respondents? Nothing in the code changes either way; it is a question of
  whether a fourth processor is worth adding before a pilot, and it belongs in
  the subprocessor list the moment it is.

## Next concrete step

Push `feat/rate-limiting` to `main`. All four Tier 0 code items are then
closed; what remains of the readiness list is outside the repository —
credential rotation, the legal artifacts, the availability monitor, and the
`שימוש הוגן` wording.
