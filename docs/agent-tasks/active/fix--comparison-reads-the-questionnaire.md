# The comparison reads the questionnaire it is comparing

## Metadata

- Branch: `fix/comparison-reads-the-questionnaire`
- Base branch: `main`
- Base commit: `d0121e7`
- Current HEAD: (this branch's commit, see `Changed files`)
- Status: implemented, tested and walked in the browser; ready to land
- Last updated: 2026-08-10
- Last agent/tool: Claude Code (Opus 5)

## Objective

Close the first of the two remaining items of axis 6 in
`docs/product-strategy-axes-2026-08-10.md`: `surveyDefinitionHash` is computed on
both runtimes and refused on mismatch everywhere in the system, and the round
comparison was the one place that never read it. A school that rewrote half its
questionnaire got a delta rendered identically to a school that changed nothing.

## User-visible outcome

When the two compared rounds carry different `surveyDefinitionHash` values, the
dashboard sidebar says so, beside the delta: *"השאלון השתנה בין הסבבים. ההשוואה
היא ברמת הממדים, שנשארים זהים, אבל חלק מהשינוי יכול לנבוע מניסוח אחר של השאלות
ולא משינוי בבית הספר."* Nothing changes for a like-for-like pair.

## Scope

- `RoundComparison` gains `questionnaireChanged`, computed in
  `toRoundComparison` from the two analytics' hashes.
- The sidebar comparison block moved out of `dashboard-map-page.tsx` into
  `dashboard-round-comparison.tsx` so it can be rendered in a test, following
  the `DashboardPartialMapNotice` pattern. No markup or wording changed in the
  move except the added paragraph.

## Non-goals

- Refusing or suppressing the comparison on a hash mismatch. Dimensions are the
  stable taxonomy across rounds by design (ADR-004, and the doc comment at the
  top of `round-comparison.ts`), so the delta stays and the reader is told what
  it rests on. Suppression would be a methodology change, not a disclosure fix.
- The other remaining axis-6 item — the dimension score cannot see a split
  staff room. Separate slice, separate branch.

## Decisions made

- Disclosure, not refusal, for the reason above.
- The note is a third paragraph inside the existing comparison block rather than
  a banner: it qualifies that number and nothing else on the screen.

## Completed

- `questionnaireChanged` on `RoundComparison`, computed and documented.
- `DashboardRoundComparison` extracted and rendering the note.
- Two unit tests on the flag, four render tests on the component.

## Remaining

- Nothing.

## Changed files

- `src/lib/dashboard/round-comparison.ts`
- `src/lib/dashboard/__tests__/round-comparison.test.ts`
- `src/components/dashboard/dashboard-map-page.tsx`
- `src/components/dashboard/dashboard-round-comparison.tsx` (new)
- `src/components/dashboard/__tests__/dashboard-round-comparison.test.tsx` (new)

## Verification evidence

### Passed

- `npx tsx --test src/lib/dashboard/__tests__/round-comparison.test.ts` — 16/16.
- `npx tsx --test src/components/dashboard/__tests__/dashboard-round-comparison.test.tsx`
  — 4/4.
- `npm test` — 844 pass, 0 fail.
- `npm run typecheck` — clean.
- `npm run lint` — clean.
- `npm run build` — succeeded.

Environment: local.

- **Browser walk, signed in, against a production build served on port 3210.**
  The local database holds the pair this needs: `round_local_1786442621191`
  ("סבב שני, שאלון מנוסח מחדש", 12 responses, one question reworded so the hash
  differs), one day after `round_local_1786356221191`. On that round the sidebar
  renders all three paragraphs together — the delta, the two respondent counts
  with the resolution sentence, and "השאלון השתנה בין הסבבים…" — and no console
  errors. The comparison on the other seeded round, which shares its hash, shows
  the first two paragraphs and not the third.

### Blocked or not run

- Nothing. The deployed endpoint has no round to render, as the handoff records.

### Residual risk

- Low. The flag is a string comparison on a field both runtimes already refuse
  on mismatch, the rendered paragraph is covered by a render test, and the
  sidebar was read on screen.

## Approval gates

None.

## Questions requiring an owner decision

None for this slice.

## Next concrete step

Land this branch first — `feat/a-split-staff-room-is-visible` is stacked on it:
`git push origin fix/comparison-reads-the-questionnaire:main` (the owner runs
the push).
