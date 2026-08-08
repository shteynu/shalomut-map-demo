# A screen that says "not found" should answer 404

## Metadata

- Branch: `fix/not-found-answers-404`
- Base branch: `chore/frontend-audit-minor-items` (a stack on top of `main` at
  `0cff722`; none of the seven branches is pushed)
- Base commit: `0291ce7`
- Current HEAD: `0291ce7` (working tree clean apart from two pre-existing
  unrelated files)
- Status: closed as decided — the cause is proved and the owner chose not
  to buy the fix. Landed as ADR-021 in `PROJECT_CONTEXT.md`.
- Last updated: 2026-08-08
- Last agent/tool: Claude Code (Opus 5)

## Objective

Every screen this product renders through `notFound()` answers HTTP 200. The
page is right, the status line contradicts it. Find out why, and decide whether
to make the status agree with the screen.

Answered on 2026-08-08: the cause is `loading.tsx`, the fix costs the product's
route-level loading skeletons, and the owner chose not to pay that yet. The
behaviour is now recorded as ADR-021 in `PROJECT_CONTEXT.md`, which is the
living home for it; this file keeps the measurements behind that decision.

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

### The cause: `loading.tsx`

Found on 2026-08-08 after the list above, and then proved by removing files and
re-measuring rather than by reading about it.

A `loading.tsx` in a segment wraps everything below it in a Suspense boundary.
A Suspense boundary makes the response stream. A streamed response sends its
status line with the first byte, long before the page body runs — so by the
time `notFound()` is called the response is already committed as 200, and
nothing downstream can change it. A route the router cannot match never gets
that far: it is decided before rendering, which is why `/no-such-page` is the
one path that answers 404.

This repository has **nine** `loading.tsx` files, and one of them is
`src/app/loading.tsx` — the root. It wraps every route in the product.

The proof, three builds:

| Build | `/no-such-page` | `/dashboard/not-a-dimension` | `/dashboard/not-a-dimension/metrics` | `/answer/NOT-A-CODE` |
| --- | --- | --- | --- | --- |
| As shipped | 404 | 200 | 200 | 200 |
| Root + `dashboard/` + `[dimension]/` + `[shareCode]/` loading removed | 404 | **404** | 200 | **404** |
| Only the root loading put back | 404 | 200 | 200 | 200 |

Row two is the mechanism: exactly the routes whose `loading.tsx` was removed
started answering 404, and `metrics` stayed at 200 because it has a
`loading.tsx` of its own that was left in place. Row three is the cost: the
root file alone is enough to hold every route at 200.

Real pages were 200 in all three builds, as they should be.

This is documented Next.js behaviour rather than a bug in 16.2.9, so an upgrade
will not deliver it. The web is full of the same report going back to Next 13.

## Scope

The fix is not a line of code, it is a trade. To make a `notFound()` answer
404, its route must not be inside a Suspense boundary that opens before the
check runs. That means:

- Deleting `src/app/loading.tsx`, and the `loading.tsx` of every segment on the
  way to a `notFound()` — at minimum `dashboard/`, `dashboard/[dimension]/`,
  `dashboard/[dimension]/metrics/`, `dashboard/[dimension]/recommendations/`
  and `answer/[shareCode]/`. That is five of the nine, plus the root.
- Putting the skeleton back **inside** each page, in a `<Suspense fallback>`
  placed after the validation that can call `notFound()`. The page then
  validates first, streams second.

What that costs: today every screen in the product shows a route-level skeleton
the instant a navigation starts, with no work from the page. Moving to in-page
Suspense means each of those pages owns its own loading state, and any page
that forgets one shows nothing until its data arrives.

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

- **Not now.** Owner decision, 2026-08-08. The status stays 200 and the
  route-level loading skeletons stay. The reasoning is in ADR-021 and is not
  duplicated here.
- **The record lives in `PROJECT_CONTEXT.md`, not in this file.** A branch task
  file is not somewhere a future reader looks before writing a page; an ADR is.
  This file keeps the measurements the ADR rests on.

## Assumptions

None. Everything in Context was measured on this machine against a production
build.

## Completed

The diagnosis, to the point where the cause is proved and the cost of the fix
is known. No product code changed; everything moved during the experiments was
put back and the tree rebuilt and re-tested.

## In progress

Nothing.

## Remaining

Nothing. Revisit only when something machine-readable starts reading these
responses — search indexing, uptime monitoring, or a client that branches on
`response.ok`.

## Changed files

- `PROJECT_CONTEXT.md` — ADR-021.

No product code. Every file moved during the experiments was put back.

## Verification evidence

### Passed

- The three-build table in Context. Each row is a real production build,
  measured by a throwaway Playwright spec that signed in, visited each path
  with `waitUntil: 'domcontentloaded'`, and printed `response.status()`
  alongside the rendered `h1`. The spec was deleted; rebuilding it is a
  five-minute job and the fix has to be measured the same way.
- After restoring every moved file: `npm run build` clean, `npx playwright
  test` 6/6, `git status` showing only the two pre-existing unrelated files.

### Failed

None.

### Blocked or not run

The fix itself, declined rather than blocked. `verify:core` was not re-run after
the restore: the restore returned the files to their committed contents and the
build and e2e both pass.

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

- Moving a skeleton from `loading.tsx` into a page's own `<Suspense>` is not a
  like-for-like swap. A route-level `loading.tsx` also shows during client-side
  navigation, before the server is even asked. An in-page boundary does not.
  Whoever does this must check the navigation feel, not only the status code.
- Six of the nine `loading.tsx` files would go. The remaining three
  (`setup/`, `survey/`, `round/`) have no `notFound()` below them and can stay,
  which leaves the product with two different loading patterns. That is worse
  documentation debt than it sounds.

## Approval gates

None.

## Questions requiring an owner decision

None open. The one below was asked and answered "not now" on 2026-08-08.

**Was a correct 404 worth giving up route-level loading skeletons?**

Nothing else buys it. The status is locked by streaming, streaming is caused by
`loading.tsx`, and the root file alone holds every route at 200. There is no
setting, no upgrade and no call-it-differently.

What is actually at stake: today no crawler indexes this product, no monitor
counts 4xx, and the only public URL affected is a dead share link — which shows
a respondent the right screen either way. Against that, six `loading.tsx` files
would be rewritten as in-page Suspense on screens whose loading behaviour is
currently free and consistent.

The answer was "not now": recorded in `PROJECT_CONTEXT.md` as ADR-021, a known
consequence of the loading pattern, to be revisited when something
machine-readable actually starts reading these responses.

## Next concrete step

Nothing on this branch but the push. It carries one documentation change,
ADR-021, and this record behind it.
