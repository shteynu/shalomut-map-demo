# The public repository grants nothing

## Metadata

- Branch: docs/the-public-repository-grants-nothing
- Base branch: main
- Base commit: `d6d6b13`
- Current HEAD: the single commit on this branch
- Status: implemented; owner confirmation wanted on one line
- Last updated: 2026-08-18
- Last agent/tool: Claude Code (Opus 5)

## Objective

Answer open owner decision 7 of `docs/product-strategy-axes-2026-08-10.md` —
*public repository with no licence, deliberate?* — with the answer the owner gave
on 2026-08-18: deliberate, all rights reserved, and say so in the repository
rather than leave a reader to infer it.

## User-visible outcome

None in the product. A `NOTICE` file at the root, a `Licence` section in
`README.md` pointing at it, and `"license": "UNLICENSED"` in `package.json`.

## Context

Verified on 2026-08-18: `gh repo view` reports `visibility: PUBLIC` and
`licenseInfo: null`, no `LICENSE` or `COPYING` file is tracked, and
`package.json` carried `"private": true` — an npm publish guard, not a statement
about rights. The repository has been public since its first commit on
2026-06-16.

The strategy sweep of 2026-08-10 raised this twice: as risk 4, *IP and
licensing*, on the grounds that what is public includes the Hebrew prompt set,
the questionnaire, the intervention catalogue and the eval corpus — the
non-obvious IP — and as open decision 7. The owner chose the notice rather than
a licence or a private repository.

## Non-goals

- **Not a licence.** Nothing here grants anyone anything; that is the point.
- Not making the repository private. That is an action in the owner's GitHub
  account and would not un-publish what has already been cloned.
- Not resolving who owns the copyright. See the question below.

## Decisions made

- **`NOTICE`, not `LICENSE`.** A file named `LICENSE` that grants nothing is a
  contradiction a reader has to resolve by reading it; GitHub would also try to
  detect a licence from it and report none.
- **State what visibility does grant.** GitHub's Terms of Service give any
  visitor the right to view and to fork within GitHub, and a notice that denies
  that reads as bluster and is wrong. The file says so explicitly and denies
  everything beyond it.
- **Carve out dependencies and quoted material.** A blanket claim over a tree
  containing npm and PyPI packages would be false on its face.
- **`"license": "UNLICENSED"`.** The npm-registry-defined spelling for
  proprietary, so tooling that reads the field is not left guessing.

## Assumptions

- The copyright line names the repository owner, taken from the Git author of
  691 of the 805 commits. See the open question.

## Completed

- `NOTICE`, `README.md` section, `package.json` field.

## Remaining

- Nothing an agent should do unilaterally. See the question below.

## Changed files

- `NOTICE`
- `README.md`
- `package.json`
- this file

## Verification evidence

### Passed

- `git diff --check` — clean.
- `package.json` parses, and the field is the only change to it.
- Every relative link in the touched files resolves; `README.md` → `NOTICE`
  resolves.
- `npm run lint:skills` — passes. Run because this adds a root-level file and
  that check sweeps the root for undeclared entrypoints; `NOTICE` is not one.

### Failed

- None.

### Blocked or not run

- Nothing else applies. No code, no schema and no contract is touched, and the
  `package.json` field is metadata that no build step reads.

### Environment

- Local.

### Residual risk

- A notice constrains only people who intend to be constrained. It is a
  statement of position, not enforcement, and the material has been publicly
  cloneable since 2026-06-16.

## Approval gates

- None crossed. Nothing is published, no credential and no deployment is
  touched.

## Questions requiring an owner decision

- **Is `Maxim Berenshtein` the right name on the copyright line, and 2026 the
  right year?** 88 of the 805 commits are authored from a `zoominfo.com`
  address, and employment agreements commonly assign work IP to the employer.
  The notice asserts personal ownership because that is the only reading an
  agent can take from the repository; whether it is correct is a question for
  the owner's own agreement, and it is one line to change.
- Should the notice carry a contact address? It names the issue tracker and
  "the owner" instead. The owner's e-mail is already public in every commit, so
  adding it exposes nothing new — it was left out because a notice that ages
  badly is worse than one that points at a durable place.

## Next concrete step

Confirm or correct the copyright line, then hand over
`git push origin docs/the-public-repository-grants-nothing:main`.
