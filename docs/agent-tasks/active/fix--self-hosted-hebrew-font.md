# The build stops fetching its own typeface

## Metadata

- Branch: `fix/self-hosted-hebrew-font`
- Base branch: `main`
- Base commit: `2bee97b`
- Current HEAD: the documentation commit carrying this file, whose parent is
  `2f21039` — read it from Git; a file cannot name its own hash. The first three
  commits are on `main` as of 2026-08-12.
- Status: landed, with the preload follow-up committed and not pushed
- Last updated: 2026-08-12
- Last agent/tool: Claude Code (Opus 5)

## Objective

Remove `fonts.gstatic.com` from the critical path of `next build`, and keep it
removed.

## User-visible outcome

None intended. The same typeface renders from the same glyphs; only where the
bytes come from has changed. What changes is that a build no longer fails for
reasons outside this repository.

## Context

`Core verification` run `31582875968` failed on `main` at `e9020f8` in
`npm run build`. The cause was upstream: `next/font/google` fetched a stylesheet
from Google naming five `.woff2` files under `…/notosanshebrew/v50/or3SQ7v3…`
that Google had already replaced with `or30Q7v3…`. All five returned 404 — still
404 when probed by hand an hour later — and Turbopack recorded each failed
download as a *warning* before failing the build with `Module not found: Can't
resolve '@vercel/turbopack-next/internal/font/google/font'`, a message naming
neither the font nor the network.

The same commit built cleanly in `Vercel Deployment & Pipeline Checks`
`31582876021` at the same minute, and `gh run rerun --failed` went green in one
try. So the gate was not broken, it was a coin toss — which is worse, because a
coin toss teaches people to re-run red builds without reading them.

## Scope

- `src/app/layout.tsx`: `next/font/google` → `next/font/local`.
- The font file itself, committed, with its provenance recorded.
- A fitness check so the loader cannot come back unnoticed.
- The CSP comment that described the old mechanism.

## Non-goals

- Changing `preload: false` was held back from the first three commits as a
  visible change nobody had asked for. The owner then asked for it, so it is in
  this branch's fourth commit rather than out of scope.
- Touching the font stack in `globals.css`. It needed no edit, which is the
  point of keeping the `--font-noto-hebrew` variable name.
- Any other `next/font/google` caller. There were none.

## Acceptance criteria

- `npm run build` completes with no network access to Google.
- The rendered face, weights and glyph coverage are unchanged.
- Re-introducing `next/font/google` fails a gate in `verify:core`.

## Relevant repository instructions

`AGENTS.md` branch-and-task-file protocol; `shalomut-map` (`Product и UI`, RTL
Hebrew as the primary experience); `shalomut-verification` for the evidence
below.

## Relevant architecture and contracts

`next.config.ts` sets `font-src 'self' data:`, so a Google host was never
reachable at runtime — only at build time. Nothing else changes.

## Decisions made

- **One file, not five.** Google serves the face split by `unicode-range`:
  Hebrew (12 212 B), Latin (20 056 B), Latin Extended (11 448 B), plus Cyrillic
  and Greek stubs of 1 196 B each — stubs because Noto Sans Hebrew has no glyphs
  for either script. `next/font/local` cannot express `unicode-range` per source
  file. Reproducing the split would have meant three `localFont()` calls, three
  CSS variables each needing a literal fallback for `global-error.tsx`, and
  `adjustFontFallback` disabled on all of them — the adjusted Arial face has no
  `unicode-range`, so it would swallow Latin before the Latin source was
  reached. One file costs 58 744 B against the ~32 KB this product fetched
  anyway to show Hebrew and digits together, and it keeps `globals.css`
  untouched and the CLS metrics intact.
- **Upstream bytes, not the CDN's.** The file is
  `googlefonts/variable-ttf/NotoSansHebrew[wdth,wght].ttf` v3.001 from the
  notofonts project — the build Google Fonts publishes — woff2-compressed and
  otherwise untouched. Verified to be a superset: zero codepoints of the three
  non-empty served subsets are missing from it.
- **`weight: "100 900"`**, the file's own `wght` axis, replacing three pinned
  static weights. Wider, not narrower.
- **The gate looks for three shapes**, because a font can return over the
  network three ways: the `next/font/google` loader, a Google host named in code
  or CSS, and a `next/font/local` source that does not exist. The third is what
  a half-finished move back would look like.
- **`fontTools` stays out of the repository.** The conversion was one-off; the
  artefact is what is version-controlled, and `src/app/fonts/README.md` records
  the command so the next person does not have to reverse-engineer it.

## Assumptions

- Google's v50 CDN build and upstream v3.001 render identically. They come from
  the same source project and the same `googlefonts/` build configuration.
  Checked at the level that matters — axes, coverage and rendering — not by
  byte comparison, which is impossible without Google's build.

## Completed

- `src/app/fonts/noto-sans-hebrew-variable.woff2` added (58 744 B, SHA-256
  `ad6faab9…f966af8`), with `src/app/fonts/README.md` recording source URL,
  conversion, and how to replace it.
- `src/app/layout.tsx` switched to `localFont()`.
- `scripts/check-local-fonts.mjs` + `scripts/check-local-fonts.test.mjs`
  (10 tests), wired as `lint:fonts` into `verify:core` before `typecheck`.
- `next.config.ts` CSP comment updated.
- `.agents/skills/shalomut-verification/SKILL.md`: a matrix row for font changes
  and a paragraph on the gate.

## In progress

Nothing.

## Remaining

Nothing in scope. Commit and push are the owner's.

## Changed files

Three commits on `fix/self-hosted-hebrew-font`, fast-forwarding from `2bee97b`:

- `61900c6` — the font file, `src/app/fonts/README.md`, `src/app/layout.tsx`,
  the `next.config.ts` CSP comment.
- `2f21039` — `scripts/check-local-fonts.mjs`, its 10 tests, `package.json`.
- the third, tip commit — this file, `docs/shalomut-tracker-handoff.md`,
  `.agents/skills/shalomut-verification/SKILL.md`.

Nothing staged, unstaged or untracked; confirmed with `git status --short` and
`git ls-files -o --exclude-standard`. `next-env.d.ts` was reverted rather than
committed: `next build` rewrites its route-types path and `next dev` rewrites it
back, so it is generated noise either way.

Visibility: the branch exists only in this worktree until it is pushed. Another
worktree can consume it now that commits exist; another machine cannot.

## Verification evidence

### Passed

- `npm run verify:core` — exit 0 as one chain, 895 `ok` assertions, with
  `GEMINI_API_KEY` stripped from the environment.
- Build output is self-contained: `.next/static/media/noto_sans_hebrew_variable-s.*.woff2`
  has the same SHA-256 as the committed file, and the only occurrence of a
  Google host anywhere under `.next/` is this task's own explanatory comment
  inside a server sourcemap.
- Generated CSS is what was intended:
  `@font-face{font-family:notoSansHebrew;src:url(../media/…woff2);font-display:swap;font-weight:100 900}`
  plus `notoSansHebrew Fallback` with `size-adjust:98.53%` and
  `ascent-override:108.4%` — the CLS metrics `next/font/google` used to
  generate, still generated.
- Browser, production build on `:3210`, `/login`: `document.fonts` reports
  `notoSansHebrew 100 900 loaded`; computed stack is
  `notoSansHebrew, "notoSansHebrew Fallback", Arial, system-ui, sans-serif`; the
  only font resource fetched is from `localhost`. Screenshot shows Hebrew and
  the Latin `admin@shalomut.edu.il` in one face with visible weight contrast.
- Preload, same page after the follow-up commit: the document carries
  `<link rel="preload" as="font" type="font/woff2" crossorigin="anonymous">` for
  the one file, and its resource entry now has `initiatorType: "link"` starting
  at 22 ms instead of being discovered through the stylesheet. Still exactly one
  font request, still local. `npm run build`, `npm run lint:fonts`,
  `npm run typecheck` and `npm run lint` all exit 0; the rest of `verify:core`
  was not re-run for a one-boolean change.
- Negative proof: the gate run against the real pre-change `src/app/layout.tsx`
  (`git show origin/main:src/app/layout.tsx`) reports `layout.tsx:3` — the exact
  line that shipped.

### Failed

None.

### Blocked or not run

- `verify:db` and `verify:ai` — no persistence, API or AI boundary in the diff.
- Playwright — the CI job runs it; nothing here touches a flow it covers.
- CI on this branch — nothing is pushed yet.

### Environment

macOS, worktree `.claude/worktrees/objective-aryabhata-af898c`, Node from the
repository's own toolchain, `ai-analytics-service/.venv` present (Python
3.14.6). `.claude/launch.json` gained a local-only `built-3210` entry for
`next start`; `.claude/` is gitignored, so it does not travel.

### Residual risk

The upstream build is not byte-identical to Google's v50, so a hinting-level
difference cannot be ruled out by inspection. It is bounded: same project, same
build configuration, same axes, no missing codepoints, and the rendered screen
was compared.

## Failed approaches

- Merging the three served subsets into one file. `pyftmerge` does not merge
  variable fonts, so the union had to come from the upstream full build rather
  than from Google's pieces.
- Three `localFont()` calls preserving `unicode-range` via `declarations`.
  Abandoned on the `adjustFontFallback` interaction described under
  `Decisions made`, not on effort.

## Known risks

`upload-artifact@v7` in `deploy-vercel.yml` is still unexercised — unrelated to
this task, carried over from the actions bump.

## Approval gates

None. No secrets, credentials, auth configuration or deployment alias is
touched.

## Questions requiring an owner decision

None. The one that stood — whether to preload — the owner answered yes on
2026-08-12.

## Next concrete step

Push the preload commit: `git push origin fix/self-hosted-hebrew-font:main`.
