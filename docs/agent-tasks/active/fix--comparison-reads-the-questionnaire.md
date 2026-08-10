# The comparison reads the questionnaire it is comparing

## Metadata

- Branch: `fix/comparison-reads-the-questionnaire`
- Base branch: `main`
- Base commit: `d0121e7`
- Current HEAD: (this branch's commit, see `Changed files`)
- Status: implemented and tested; browser walk waiting on an owner sign-in
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

- The browser walk (below).

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
- `npm test` — 832 pass, 0 fail.
- `npm run typecheck` — clean.
- `npm run lint` — clean.
- `npm run build` — succeeded.

Environment: local.

### Blocked or not run

- **The browser walk.** The local database now holds the pair this needs: a
  scratch script seeded a second closed round, `round_local_1786442621191`
  ("סבב שני, שאלון מנוסח מחדש", 12 responses, one question reworded so the hash
  differs), one day after the seeded `round_local_1786356221191`. The script was
  deleted; the rounds are in the local database. `/dashboard` is behind the
  manager session and an agent does not enter passwords, so the walk needs the
  owner to sign in at `http://localhost:3000/login` first.

### Residual risk

- Low. The flag is a string comparison on a field both runtimes already refuse
  on mismatch; the rendered paragraph is covered by a render test. What no test
  covers is how the third paragraph sits in the real sidebar at real widths —
  that is exactly what the walk above is for.

## Approval gates

None.

## Questions requiring an owner decision

None for this slice.

## Next concrete step

Sign in at `http://localhost:3000/login`, open the dashboard on
`סבב שני, שאלון מנוסח מחדש`, and confirm the comparison block shows the delta,
both respondent counts and the questionnaire note together, at desktop and phone
widths. Then the branch is ready to land.
