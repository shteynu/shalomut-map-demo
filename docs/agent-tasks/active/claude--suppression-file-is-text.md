# The suppression module stops being a binary file

## Metadata

- Branch: `claude/suppression-file-is-text`
- Base branch: `claude/builder-for-background-questions` (phase 4)
- Base commit: `8b2e95c`
- Status: complete and verified
- Last updated: 2026-08-15
- Last agent/tool: Claude Code (Opus 5)

## Objective

`src/lib/privacy/cell-suppression.ts` carried one literal NUL byte, so Git
classified the whole file as binary. Replace it with the `\u0000` escape, which
is the same string value and leaves the file as text.

## User-visible outcome

None. This is a repository-legibility fix with no runtime effect.

## Context

The NUL is a deliberate separator in the cross-tab cell key: an id may contain
any printable character, so no printable delimiter is safe. The choice is right;
only the way it was written was wrong. Written as a raw byte it cost the file
its diff, its `git blame` and any chance of resolving a merge conflict in it —
the phase 2 commit shows it as `Bin 0 -> 12015 bytes`.

This was found while checking whether the cross-tab screen was blocked, and it
matters now because that screen is the next task and will read this file often.

## Decisions made

- **Keep NUL as the separator.** The collision argument is sound and unchanged.
  Only the encoding of the literal changed.
- **A comment states why the escape is required**, so the next reader does not
  "simplify" it back to a raw byte or to a printable delimiter. Both would be
  regressions, and only one of them would be visible.

## Completed

- `cell-suppression.ts` — `cellKey` uses `\u0000`; a comment explains both the
  choice of NUL and why it must stay an escape.

## Remaining

Nothing on this branch. Next task is the manager-facing cross-tab screen, which
is the first caller `suppressCrossTab` and `suppressFrequency` will ever have.

## Changed files

Modified: `src/lib/privacy/cell-suppression.ts`. New: this file.

`.idea/shalomut-map-demo.iml` is a pre-existing user modification and stays
unstaged. `next-env.d.ts` churned under `build` and was reverted, per the known
risk recorded on the phase 4 branch.

## Verification evidence

### Passed

- `npm run verify:core` — exit 0. **980 tests pass, 0 fail**, the same count as
  the phase 4 baseline; this change adds no test and removes none.
- **The escape is the same value as the byte**, shown directly rather than
  assumed: a template literal using `\u0000` compares `===` to the same string
  built with `String.fromCharCode(0)`, and `charCodeAt` at the separator is `0`.
- **The file is text again**: `file` reports UTF-8 where it reported `data`, the
  source holds zero NUL bytes, and a line-level diff against a modified copy
  renders as `-`/`+` lines instead of "Binary files differ".

### Failed

None.

### Blocked or not run

- `verify:db` and `verify:ai` — not run and not applicable; no schema, query,
  prompt or contract changed.
- No browser walk. Nothing this branch touches reaches a screen: the module
  still has no caller outside its own tests.

### A caveat on the diff of this very commit

The commit that lands this fix still shows as binary, because the *old* blob
contains the NUL and Git judges a diff by both sides. Every diff after it is
text. That was checked, not assumed.

## Known risks

- Nothing guards against a raw NUL returning. A `scripts/check-*.mjs` guard in
  the style of `lint:fonts` would, and was deliberately not built here to keep
  the fix one commit. It is worth doing only if this recurs.

## Approval gates

- `git push` is an owner action. This branch sits on top of the four-branch
  stack, which is already on `origin`.

## Next concrete step

Start the manager-facing cross-tab screen on a branch off this one. It is the
only unblocked item in the plan: it needs demographic questions, which the
builder can author since phase 4, and dimension scores, which the current
24-question instrument already produces — not the methodologist's item mapping.
