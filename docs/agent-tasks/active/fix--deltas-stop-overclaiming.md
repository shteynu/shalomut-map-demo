# A delta stops being stated as a fact the sample cannot support

## Metadata

- Branch: `fix/deltas-stop-overclaiming`
- Base branch: `main`
- Base commit: `e1ef1e1`
- Current HEAD: `e1ef1e1` plus one commit on this branch.
- Status: complete and verified locally. Waits on a push.
- Last updated: 2026-08-10
- Last agent/tool: Claude Code (Opus 5)

## Objective

The first deliverable of axis 6 of `docs/product-strategy-axes-2026-08-10.md`:
round-over-round deltas rendered as stated fact, with no n, no resolution and no
suppression floor.

## User-visible outcome

A delta smaller than one respondent's width reads `≈` and "שינוי קטן מכדי לקרוא
בגודל המדגם הזה" instead of "עלייה של 3 נקודות", and both rounds' respondent
counts sit beside it. The map says, once, how many dimensions sit close enough
to a band edge that one respondent could have chosen their colour.

## Decisions made

- **The floor is one respondent's width, `scale range / n`, not a confidence
  interval.** Both scores are means over respondents, so one person carries
  `1/n` of the result; that is arithmetic the data supports. A significance test
  would need assumptions this instrument has not earned. The floor is therefore
  optimistic — the real detectable change is larger — and it is written down as
  such in the module.
- **The smaller round governs.** A comparison is only as readable as its weaker
  half.
- **The minimum is a required argument.** `describeDelta`, `formatDelta` and
  `deltaDirection` no longer have a one-argument form: an argument a caller can
  forget is the same defect with a longer name.
- **Zero stopped being a special case.** `±0` claimed "measured, unchanged",
  which at any real sample size is the same claim as "moved less than we can
  see". Both are `≈`. What still separates compared from not compared is whether
  the chip renders at all.
- **The band-edge fact is one sentence in the sidebar, not a marker per stone.**
  At ten respondents the width is ten points, so in a school scoring in the
  forties and fifties all eight stones qualify and eight identical warnings say
  less than one sentence. Each stone still carries it in its accessible name.

## Completed

`src/lib/dashboard/round-comparison.ts` — `minimumReadableDelta`,
`isDeltaReadable`, `isNearBandEdge`, the three presentation helpers, and three
new fields on `RoundComparison`. Wired through `dashboard-map-page.tsx` and
`dashboard-map-interactive.tsx`, with styles in `globals.css`.
`src/lib/dashboard/__tests__/round-comparison.test.ts` — 14 tests, six of them
new.

## Remaining, from the same axis and not in this slice

- Comparison ignores `surveyDefinitionHash`, so a school that rewrote its
  questions gets a delta rendered like a like-for-like one.
- A dimension score cannot see a split staff room: thirty yellows and eighteen
  green plus twelve red both score 60.
- No hysteresis on the band switch itself; this slice only reports proximity.

## Verification evidence

### Passed

- `npm test` — 822 tests, 0 failures.
- `npm run typecheck`, `npm run lint`, `npm run build`.
- `npx playwright test e2e/` — 11 passed.
- The map walked signed-in on the local stack: the band sentence reads "כל
  הממדים… פחות מ־10 נקודות מגבול הקטגוריה… ב־10 משיבים", and the stones stayed
  clean.

### Blocked or not run

- The delta rendering itself was not seen in a browser: the local school has no
  second round with an unlocked analysis, so no comparison renders. It is
  covered by unit tests only.
- `verify:db` and `verify:ai` were not run: no schema, contract, prompt or
  version changed.

## Approval gates

`git push origin fix/deltas-stop-overclaiming:main` is the owner's to run.

## Next concrete step

Push. Then either the rest of axis 6 above, or axis 7 — the staff-size floor and
the fair-use commitment — which is the other half of what a pilot in a real
school needs.
