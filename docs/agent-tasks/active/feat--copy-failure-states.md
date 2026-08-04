# Telling the truth about a blocked clipboard

## Metadata

- Branch: `feat/copy-failure-states`
- Base branch: `main`
- Base commit: `96400e9`
- Current HEAD: the branch's own commits; not pushed
- Status: implementation complete, awaiting the owner's push
- Last updated: 2026-08-04
- Last agent/tool: Claude Code (Opus 5)

## Objective

Close backlog `docs/product-behaviour-backlog.md` §2. `useClipboard` caught
every failure and called `setCopied(true)` anyway, so a browser that refused the
write produced the same green line as a browser that accepted it.

## User-visible outcome

Copying the share link now has three outcomes. Success says so and fades after a
few seconds. A refusal says the browser blocked the copy, names Ctrl+C/Cmd+C,
selects the link in its field, and stays on screen until the next attempt.

## Context

Distribution is the one flow where the manager leaves the app believing they
hold something. A false success there sends a principal to a staff meeting with
an empty clipboard.

## Scope

- `writeToClipboard`, which reports whether the text got there.
- `useClipboard` as a three-state machine returning the outcome.
- One shared `CopyLinkStatus` for both copy surfaces.
- Selecting the link on failure.

## Non-goals

- A `document.execCommand("copy")` fallback. It is deprecated, and in the
  browsers that block the modern API it is generally blocked too; the honest
  answer is to hand the selected text to the manager.
- The "last saved" timestamp, which is §1.

## Acceptance criteria

- A refused write never renders the success line.
- The failure note does not disappear on a timer.
- Both copy surfaces behave identically.

## Relevant repository instructions

`AGENTS.md` skill routing; branch-scoped task state; `git push` is the owner's
action in this environment.

## Relevant architecture and contracts

None affected. The copied value is the anonymous share URL, so no privacy
boundary is involved.

## Decisions made

- Success fades, failure persists. The success note has nothing left to say once
  the link is on the clipboard; the failure note is an instruction.
- `copy` returns the outcome as well as setting state, so the caller can select
  the input. Checking `navigator.clipboard` at the call site would have missed a
  denied permission, which is the common case.
- One presentational component rather than two copies of the Hebrew text.

## Assumptions

- Selecting the input is enough of a fallback for a keyboard user; no manual
  "copy by hand" dialog is needed.

## Completed

All of the scope above, with tests.

## In progress

Nothing.

## Remaining

Nothing on this branch.

## Changed files

- `src/lib/utils/clipboard.ts` — new: `writeToClipboard`.
- `src/lib/hooks/use-clipboard.ts` — `status: "idle" | "copied" | "failed"`,
  `copy` returns the outcome.
- `src/components/ui/copy-link-status.tsx` — new shared note.
- `src/components/round/round-controls.tsx`,
  `src/components/survey/survey-builder.tsx`,
  `src/components/survey/survey-builder/survey-builder-sidebar.tsx` — wired up,
  with a ref so the link can be selected.
- `src/app/globals.css` — `.copy-failure-note`.
- `src/lib/utils/__tests__/clipboard.test.ts` (3),
  `src/components/ui/__tests__/copy-link-status.test.tsx` (3).
- `PROGRESS.md`, `docs/product-behaviour-backlog.md` §2.

## Verification evidence

### Passed

- `npm run verify:core`: passed, 473 TypeScript tests.
- Browser, local dev server and the owner's authenticated session:
  - `/round?round=round_local_1785676013225` — the real browser refused the
    write from a scripted click, and the screen showed
    `.copy-failure-note` with `role="alert"` and the Ctrl+C wording. This is the
    exact case that used to render the green success line.
  - The share input was fully selected at that moment.
  - With a stubbed `navigator.clipboard` that resolves, the same button produced
    `.success-note` with `role="status"`, and it was gone 2.6 seconds later.
  - `/survey?round=…` — the builder's copy button behaved identically:
    `.copy-failure-note`, `role="alert"`, link selected. Screenshot taken.

### Failed

None.

### Blocked or not run

- The failure was produced by the browser refusing a scripted click rather than
  by a denied permission prompt or an embedded webview. The code path is the
  same one, but those two environments were not themselves exercised.
- Mobile viewport not checked, as in the previous slices.
- `npm run verify:db` and `npm run verify:ai`: not run, nothing they cover
  changed.

### Environment

Local: `next dev` on `:3000`, Docker PostgreSQL on `127.0.0.1:5433`.

### Residual risk

None identified.

## Failed approaches

The first wiring decided whether to select the input by testing
`navigator.clipboard` for existence, which would have been wrong exactly when a
permission was denied — the API is present and the write still fails.

## Known risks

`--danger-surface` is referenced by `.survey-submit-error` in
`src/app/globals.css` but never defined, so that border falls back to the
initial colour. Pre-existing and outside this slice; noted rather than fixed.

## Approval gates

`git push` is blocked for the agent in this environment.

## Questions requiring an owner decision

None.

## Next concrete step

Owner runs:

```bash
git push origin feat/copy-failure-states:main
```
