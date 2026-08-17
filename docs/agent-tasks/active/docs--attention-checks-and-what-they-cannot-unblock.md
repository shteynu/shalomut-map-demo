# Attention checks, and what they cannot unblock

## Metadata

- Branch: `docs/attention-checks-and-what-they-cannot-unblock`
- Base branch: `feat/how-long-the-questionnaire-was-in-front-of-them` (task D), at `c5963d2`
- Base commit: `c5963d2`
- Current HEAD: `fa2e816`, this file
- Status: complete, unpushed
- Last updated: 2026-08-17
- Last agent/tool: Claude Code (Opus 5)

## Objective

Close task E of
[`response-quality-plan-2026-08-17.md`](../../response-quality-plan-2026-08-17.md)
in the only way it can be closed today: record what the plan got wrong about
what attention checks buy, and put the question the methodologist actually has
to answer where they will read it.

## User-visible outcome

None. Nothing in the product changes. What changes is that the owner can decide
whether to spend a methodologist's time on this, and that a positive answer
cannot arrive and be read as permission to build exclusion.

## Context

Task E is the last item of the response-quality plan, and the plan marks it
blocked on the methodologist. The owner asked for it on 2026-08-17, in the same
rhythm as B, C and D.

Every path it could take needs the same input — the text of a trap item and
whether trap items suit this population — and none of that can be invented. The
126-item instrument they also own is unfinished; its item-to-dimension mapping
still blocks phases 3 and 5. So nothing was buildable, and the owner chose
recording the decision and writing the brief over building plumbing against an
instrument that does not exist yet.

## Scope

- The correction to ADR-022.
- Question 6 in both methodologist files, kept in step.
- `docs/README.md` and the operational handoff, where they own this state.

## Non-goals

- No code. Deliberately: the item text is the whole of the feature, and there is
  none.
- No attention-check question kind, no schema change, no report field.
- Nothing that presumes the answer will be yes.

## Decisions made

1. **Attention checks do not unblock exclusion, and the plan was wrong to say
   they would.** The plan's reasoning was that trap items are the one
   careless-responding signal that is not directionally biased, so a positive
   answer would "make an exclusion feature defensible later". ADR-022, written
   on task B *after* that plan, closes exclusion on a different argument
   entirely: publishing two bases for one round leaks the difference between
   them, and that argument says nothing about how the second basis was chosen. A
   perfectly unbiased criterion produces exactly the same leak. Signal quality
   was never what was blocking.
2. **The shape ADR-022 does permit is a check at intake.** A respondent told on
   their own screen that they missed a trap item, and given the chance to fix it
   before sending, produces no second basis — there is one set of responses and
   it is the one published. It needs no manager decision and offers none. The
   other permitted shape is the descriptive one already built for filling times:
   a count beside the others, under the same floor, sanctioning a round-level
   action and nothing else.
3. **The question goes into the existing methodologist files rather than a new
   document.** They are already the outgoing channel, already in two languages,
   already listed in `docs/README.md` as "outgoing, not a specification". A
   sixth document would split the reply.
4. **Question 6 states the closed part first.** It says exclusion is already
   settled and why, before asking anything, so that "yes, use trap items" cannot
   come back meaning "yes, and now you may remove people".
5. **"Not worth it for this population" is named in the question as a full
   answer.** A trap item tells a teacher they are being tested, inside a survey
   that separately promises nobody looks at an individual. That may cost more
   trust than it buys accuracy, and the question says so rather than pressing
   for a yes.

## Assumptions

- The methodologist reads Russian or Hebrew; both files carry the same six
  questions and either may be the one answered.

## Completed

Everything in Scope.

- `PROJECT_CONTEXT.md` — ADR-022 gained the correction and the two permitted
  shapes.
- `docs/methodologist-questions-2026-08-15-ru.md` and `-he.md` — question 6,
  mirrored, with the priority list updated in both. Both intros now say six.
- `docs/README.md` — the entry describes six questions and says why question 6
  opens with what is already closed.
- `docs/shalomut-tracker-handoff.md` — a new entry under "Waits on an owner
  decision", carrying the two settled constraints and the fact that nothing is
  built against it.

## In progress

Nothing.

## Remaining

Push, which is the owner's. Sending the questions is the owner's too — this
repository only writes them.

## Changed files

Two commits on this branch, neither pushed. `origin` has never seen it.

- `c94891e` `PROJECT_CONTEXT.md`, both methodologist files, `docs/README.md`
  and `docs/shalomut-tracker-handoff.md`
- `fa2e816` this file

`next-env.d.ts` carries a pre-existing unstaged modification that predates this
branch. It is left alone.

## Verification evidence

### Passed

- `npm run verify:core` — exit 0 on the final tree.
- The claims the new text makes about the code were read rather than recalled:
  `src/app/api/rounds/[roundId]/survey-definition/route.ts:97` refuses a
  question change once `responseCount > 0`, and `hasSameQuestionSnapshot` in
  `src/lib/survey-definition.ts:463` compares `polarity` and `scaleId` for an
  analytic question.

### Failed

None.

### Blocked or not run

- No browser check. Nothing renders from any of this.
- Nothing deployed, no database touched.

### Environment

Local worktree only.

### Residual risk

- The two methodologist files can drift. They are kept in step by hand, and
  nothing checks it. A reply against one applies to both.
- If the answer is yes, question 6.3 forces a product decision — tell the
  respondent, or only count — that nobody has taken yet. It is asked now so the
  answer arrives with it rather than after it.

## Failed approaches

None. The alternative shapes were considered and put to the owner rather than
attempted; see Decisions made, 2.

## Known risks

- This branch is fifth in a stack — A, B, C, D, then this — and none has landed.
  `origin/main` is still `8231490`.

## Approval gates

- Sending the questions outside the repository is the owner's action. Nothing
  here contacts anyone.

## Questions requiring an owner decision

- Whether to send question 6 at all, given that its best case is a descriptive
  count or an intake-side prompt rather than the exclusion the original request
  asked about.

## Next concrete step

Push this branch —
`git push origin docs/attention-checks-and-what-they-cannot-unblock` — which is
the owner's to run. Then land the five stacked branches in order, A first.
