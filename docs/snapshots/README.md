# Released snapshots

A snapshot is a **translation of a source document, released at a date** — not a
second copy that is expected to stay in step by itself. Nothing synchronises
these files, and nothing should read them as current when they disagree with
their source.

## The rule

1. The source document is edited first. For everything here that is
   [`../platform-handbook.md`](../platform-handbook.md).
2. A snapshot is produced from the source and carries the date it was released
   and the commit it was released from, in its own header.
3. A snapshot is never edited to add content. A correction found while reading
   one goes into the source, and the snapshot is re-released.
4. When a snapshot is older than the source, the source wins. That is the normal
   state between releases, not a defect to be hidden.

## Why translations are snapshots rather than living documents

Keeping three languages continuously aligned costs a three-way review on every
edit, and the repository has no reviewer for two of the three. A dated release
states plainly what a silently drifting copy hides: this text was true at that
commit, and the English one is what has moved since.

## Where a snapshot may also be published outside the repository

A snapshot may be published as a page or a document for people who do not read
the repository — a school partner, a methodologist, an owner. Two constraints
hold there.

- A published copy is a copy. It does not become the source by being nicer to
  read, and comments left on it are folded back into the source document.
- Nothing published outside the repository may carry a secret, a credential, a
  respondent, or an operational address that is not already public. The
  handbook is written to that limit, which is why it names hosting providers and
  regions but no host names, keys or dashboards.

## Current snapshots

| File | Language | Source | Released |
| --- | --- | --- | --- |
| [`platform-handbook.ru.md`](platform-handbook.ru.md) | Russian | `platform-handbook.md` | 2026-08-18 |
| [`platform-handbook.he.md`](platform-handbook.he.md) | Hebrew | `platform-handbook.md` | 2026-08-18 |
