# A screen that says "not found" should answer 404

## Metadata

- Branch: `fix/not-found-answers-404`
- Base branch: `chore/frontend-audit-minor-items` (a stack on top of `main` at
  `0cff722`; none of the seven branches is pushed)
- Base commit: `0291ce7`
- Current HEAD: `0291ce7` (working tree clean apart from two pre-existing
  unrelated files)
- Status: diagnosed, not started
- Last updated: 2026-08-08
- Last agent/tool: Claude Code (Opus 5)

## Objective

Every screen this product renders through `notFound()` answers HTTP 200. The
page is right, the status line contradicts it. Make the status agree with the
screen.

## User-visible outcome

Nothing a manager sees in a browser changes. What changes is what everything
that is not a browser sees: crawlers, uptime checks, link checkers, the
respondent's own share-link tooling, and any future monitoring that counts 4xx.
A dead share link currently reports itself as a healthy page.

## Context

Found during the frontend UI/UX audit of 2026-08-08, while building the failure
screens on `fix/error-and-not-found-screens`. It was recorded there as a known
risk rather than fixed, because it is not a styling problem and did not belong
in that branch.

Measured on a local production build (`npx next start`, signed in):

| Path | Status | Screen |
| --- | --- | --- |
| `/no-such-page` | **404** | הדף לא נמצא |
| `/dashboard/not-a-dimension` | **200** | הממד לא נמצא |
| `/dashboard/not-a-dimension/metrics` | **200** | הממד לא נמצא |
| `/dashboard/not-a-dimension/recommendations` | **200** | הממד לא נמצא |
| `/answer/NOT-A-CODE` | **200** | הקישור אינו פעיל |
| `/dashboard/balance` | 200 | (a real page, correct) |

So the rule is not "our 404 screens are broken". A route the router cannot
match answers 404 correctly. A route that matches and then calls `notFound()`
answers 200. Every one of the four `notFound()` call sites is affected:
`src/app/answer/[shareCode]/page.tsx:18`,
`src/app/dashboard/[dimension]/page.tsx:29`, and the same line in that
segment's `metrics/page.tsx` and `recommendations/page.tsx`.

### What has already been ruled out

Each of these was tested by changing one thing, rebuilding, and re-measuring.
All were restored afterwards; the worktree is clean.

1. **Our page code.** A throwaway route whose entire body is `notFound()` —
   no params, no data, no `await` — also answered 200.
2. **The order of `notFound()` against the data load.** Moving the `!entry`
   check above `await loadManagerContext()` in all three dimension pages
   changed nothing. (Tried on the earlier branch and reverted there.)
3. **The middleware.** Excluding the probe route from the matcher in
   `src/middleware.ts` changed nothing. `/no-such-page` passes through the same
   middleware and answers 404.
4. **`trailingSlash: true`.** Removing it from `next.config.ts` changed
   nothing.
5. **Our custom root `not-found.tsx`.** Renaming it away, so the framework's
   own default rendered, changed nothing.
6. **Static vs dynamic rendering.** The probe answered 200 both as a
   statically prerendered route (`○`) and with `export const dynamic =
   "force-dynamic"` (`ƒ`).

That leaves the framework itself: Next.js 16.2.9 on this configuration serves
`notFound()` with a 200. Which means the fix is probably not "call it
differently" but one of the options below.

## Scope

To be decided by whoever picks this up. The candidates:

- Confirm against Next.js: is this a known issue in 16.2.9, fixed in a later
  patch? Check the changelog and the issue tracker before writing any code.
  An upgrade that fixes it is worth more than a workaround.
- If it is not fixed upstream, the options are to set the status explicitly
  where the product controls the response, or to accept it and document it.

## Non-goals

- Redesigning any failure screen. They are done and verified; this is about
  the status line above them.
- Changing which paths call `notFound()`.

## Acceptance criteria

The table in Context re-measured, with every `notFound()` row reading 404 and
every real page still reading 200. `/answer/<a live share code>` must stay 200
— a respondent's working link is the thing most easily broken by a careless
fix here.

## Relevant repository instructions

- `AGENTS.md` — verify in proportion to risk; never record a check that did not
  run.
- `.agents/skills/shalomut-verification/SKILL.md`.

## Relevant architecture and contracts

- `src/middleware.ts` gates every manager surface and injects the school scope.
  Any change that touches the response path has to keep the signed-out redirect
  and the 401 JSON for `/api/*` exactly as they are.
- The respondent routes bypass manager scope; `/answer/[shareCode]` is the one
  `notFound()` a member of the public can reach.

## Decisions made

None yet. The diagnosis above is fact; the fix is open.

## Assumptions

None. Everything in Context was measured on this machine against a production
build.

## Completed

Nothing but the diagnosis.

## In progress

Nothing.

## Remaining

All of it.

## Changed files

None.

## Verification evidence

### Passed

Nothing to verify yet. The measurements in Context were taken with a throwaway
Playwright spec that signed in, visited each path with `waitUntil:
'domcontentloaded'`, and printed `response.status()` alongside the rendered
`h1`. The spec was deleted; reproducing it is a five-minute job and is the
first thing the next agent should do, because the fix has to be measured the
same way.

### Failed

None.

### Blocked or not run

Everything.

### Environment

Local; `npx next start` on port 3100 through the Playwright config's throwaway
credentials. Next.js 16.2.9.

### Residual risk

Unknown until an approach is chosen. The obvious risk in any fix is answering
404 on a page that is fine — `/answer/<live code>` above all.

## Failed approaches

None yet; see "What has already been ruled out" for six hypotheses that were
tested and eliminated. They are listed there rather than here because they were
diagnosis, not attempts at a fix.

## Known risks

The most likely honest outcome is "upstream behaviour, wait for the upgrade".
If so, this task ends by documenting that in `PROJECT_CONTEXT.md` rather than
by shipping a workaround — say so plainly instead of forcing a change.

## Approval gates

None.

## Questions requiring an owner decision

If it turns out that the only way to fix this is a workaround with real cost —
middleware that re-issues the response, or a per-route status shim — is a
correct status worth that, on a product with no crawlers and no monitoring yet?
Ask before building it.

## Next concrete step

Read the Next.js 16.2.x changelog and issue tracker for `notFound()` returning
200. That single answer decides whether this is an upgrade, a workaround, or a
documented limitation.
