# The public repository grants nothing

## Metadata

- Branch: docs/the-public-repository-grants-nothing
- Base branch: main
- Base commit: `d6d6b13`
- Current HEAD: `3b7b58c`, which is `origin/main`
- Status: landed and public. Archived on 2026-08-18; one line still waits on
  the owner and is carried in `docs/shalomut-tracker-handoff.md`
- Last updated: 2026-08-18
- Last agent/tool: Claude Code (Opus 5)

## Objective

Answer open owner decision 7 of `docs/product-strategy-axes-2026-08-10.md` —
*public repository with no licence, deliberate?* — with the answer the owner gave
on 2026-08-18: deliberate, all rights reserved, and say so in the repository
rather than leave a reader to infer it.

## User-visible outcome

None in the product. A `NOTICE` file at the root, a `Licence` section in
`README.md` pointing at it, `"license": "UNLICENSED"` in `package.json`, and a
`.mailmap` that reports one contributor as one contributor.

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
- **Not rewriting history.** `.mailmap` changes what Git reports, never what it
  stored. See the decision below for why the alternative was refused.
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
- **`.mailmap` rather than `git-filter-repo`.** Three addresses in this history
  belong to one person: `shteynumaks@gmail.com` (692 commits),
  `maxim.berenshtein@zoominfo.com` (88, from the first commit on 2026-06-16
  until the setting was changed on 2026-07-25) and the GitHub `noreply` address
  used from the web interface (17). Author and committer are the corporate
  address on all 88, so it was a configured `user.email` and not a web-interface
  artifact. Rewriting them was refused on its cost: it changes those 88 commits
  and, with them, every descendant hash in a repository whose documentation
  cites hashes on nearly every page, it needs a force-push to a public
  repository that breaks existing clones and forks, and it erases nothing —
  the old objects survive in forks and in every clone already taken.
- **The canonical name stays `maxim.berenshtein`.** It is what `git config`
  actually says, and normalizing it to the `Maxim Berenshtein` of `NOTICE` is a
  presentation choice that touches the same open question as the copyright line.
  One line, whenever that is answered.
- **`Claude <noreply@anthropic.com>` is left alone.** Nine commits by a
  different author, and merging them into one identity would misreport who
  wrote what.

## Assumptions

- The copyright line names the repository owner, taken from the Git author of
  691 of the 805 commits. See the open question.

## Completed

- `NOTICE`, `README.md` section, `package.json` field.
- `.mailmap` with the two mappings and the comment explaining the corporate
  address, so the next reader does not have to re-derive it from `git log`.

## Remaining

- Nothing an agent should do unilaterally. See the question below.

## Changed files

- `NOTICE`
- `README.md`
- `package.json`
- `.mailmap`
- this file

## Verification evidence

### Passed

- `git diff --check` — clean.
- `package.json` parses, and the field is the only change to it.
- Every relative link in the touched files resolves; `README.md` → `NOTICE`
  resolves.
- `npm run lint:skills` — passes. Run because this adds root-level files and
  that check sweeps the root for undeclared entrypoints; neither `NOTICE` nor
  `.mailmap` is one.
- `git shortlog -sne` went from four identities — 692, 88, 17, 9 — to two: 797
  for the owner and 9 for `Claude`. `git check-mailmap` resolves both old
  addresses to the canonical one and leaves `Claude` untouched. `git rev-parse
  HEAD` is unchanged by the file, which is the property that distinguishes this
  from a rewrite.

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
- **GitHub's web interface ignores `.mailmap`.** Commit pages there still show
  the address each commit was authored with, so this tidies local Git tooling
  and not the public view. Anyone reading the repository on github.com sees what
  they saw before.

## Approval gates

- None crossed. Nothing is published, no credential and no deployment is
  touched.

## Questions requiring an owner decision

- **Is `Maxim Berenshtein` the right name on the copyright line, and 2026 the
  right year?** 88 of the 805 commits are authored from a `zoominfo.com`
  address, and employment agreements commonly assign work IP to the employer.
  The notice asserts personal ownership because that is the only reading an
  agent can take from the repository; whether it is correct is a question for
  the owner's own agreement, and it is one line to change. `.mailmap` does not
  touch it: consolidating a display name is not a claim about ownership.
- Should the notice carry a contact address? It names the issue tracker and
  "the owner" instead. The owner's e-mail is already public in every commit, so
  adding it exposes nothing new — it was left out because a notice that ages
  badly is worse than one that points at a durable place.

## Next concrete step

None here. Both commits are on `main` and the notice is public. The copyright
line still waits on the owner's employment agreement; it moved to the open items
in `docs/shalomut-tracker-handoff.md` when this file was archived, because an
open question that matters is not one to leave in an archive.
