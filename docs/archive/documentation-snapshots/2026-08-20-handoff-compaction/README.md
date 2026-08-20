# Documentation snapshot before the 2026-08-20 handoff compaction

This directory preserves the operational handoff as it stood before it was
compacted. The payload file is an exact copy taken from `17792be`, the commit
immediately before the compaction.

What was compacted, and why: the file had reached 3116 lines and 195 KB, of
which the first 1940 lines were thirty-seven dated session entries under no
heading at all. Its own closing paragraph — and the `shalomut-tracker` skill —
say it owns cross-task operational state, deployed state, external blockers and
approval gates, and nothing else. The journal was neither of those, and it was
ordered worst-first: the newest entry had been appended at line 2988 while the
top of the file still named `2b87836` as `origin/main`, four commits stale.

The compaction kept every durable fact it could identify — deployed readings,
monitor identifiers, provider-account state, owner decisions, approval gates and
the operational lessons that had cost a session each — and replaced the
session-by-session narrative with a dated chronology that points at commits and
archived task files. Facts about commits no longer deployed were dropped, which
the original file had already marked as "kept for what it exercised, not as the
current deployed commit".

That was a judgment call about which sentences were durable. This copy is what
it was judged against, and `git show 17792be:docs/shalomut-tracker-handoff.md`
is the same bytes if this file is ever in doubt.

These files are historical evidence, not current instructions or sources of
truth. Commands, test counts, contract status, environment names and next steps
inside them may be obsolete. Use [`../../../README.md`](../../../README.md) to
find the corresponding living document.

## Snapshot contents

- [`docs/shalomut-tracker-handoff.md.txt`](docs/shalomut-tracker-handoff.md.txt)
  — the operational handoff with its full session journal.

The `.md.txt` suffix is intentional: it keeps the contents byte-for-byte
recoverable while preventing old relative Markdown links and guidance from
being treated as current documentation.
