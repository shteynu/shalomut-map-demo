# The manager guide in three languages

## Metadata

- Branch: `claude/manager-help-languages`
- Base branch: `main`
- Base commit: `3bf903a`
- Current HEAD: this commit
- Status: delivered; unreviewed by a native reader in any of the three languages
- Last updated: 2026-08-18
- Last agent/tool: Claude Code

## Objective

Let the guide be read in Russian and English as well as Hebrew, switched from
the badge and from the screen, without the product itself changing language.

## User-visible outcome

The badge panel carries three language links above its topic list. Each opens
`/help` in that language: the whole screen — heading, topics, summaries, points —
translated, with its own `lang` and writing direction. The rest of the product
stays Hebrew for everyone.

## Context

Owner request 2026-08-18, pointing at the top of the badge panel. The guide had
shipped in Hebrew on `acd854d`; the platform handbook already existed in three
languages under `docs/`, but that is a different, longer document for a different
reader.

## Scope

- `src/lib/help/locales.ts` — the three locales, their labels, their direction,
  and reading `?lang=`.
- `src/lib/help/types.ts` — the shape a translation fills in, including the
  numbers it is handed and may not invent.
- `src/lib/help/topics/{he,ru,en}.ts` — the three translations.
- `src/lib/help/manager-help.ts` — facade: computes the numbers once, dispatches
  by locale.
- `src/components/help/help-language-switcher.tsx` — three links.
- `src/components/help/manager-help-board.tsx`, `manager-help-badge.tsx`,
  `src/app/help/page.tsx` — locale plumbing.
- `src/lib/navigation.ts` — `helpRoute(anchor, lang)`; the badge no longer
  follows a manager onto the guide.
- `src/components/layout/app-header.tsx` — the guide link is gone from the
  header, owner request 2026-08-18.
- `src/app/globals.css` — the switcher and the badge's head.

## Non-goals

- **The product does not become multilingual.** Only the guide switches. Every
  other screen stays Hebrew, for everyone, always.
- No cookie, session or preference. The language is a URL and nothing else.
- No translation of the platform handbook into the product; that document names
  hosting providers and queue mechanics a principal has no use for, and a test
  fails if those words reach the guide in any language.

## Acceptance criteria

- The three translations carry the same seven topics in the same order, so an
  anchor means the same answer in each.
- No translation contains a figure of its own: the threshold and the bands are
  computed once and handed in.
- A translation declares its own `lang` and direction; the document is Hebrew
  and right-to-left, and an inherited direction breaks a Latin sentence.
- An unrecognised `?lang=` renders Hebrew rather than failing.

## Relevant repository instructions

`.agents/skills/shalomut-map/SKILL.md` — `Product и UI`: RTL first, WCAG AA,
existing tokens, no threshold literals in code.

## Decisions made

- **The language lives in the URL.** A cookie would decide the language of
  screens nobody asked to translate, and would make every page dynamic.
- **The badge stays Hebrew.** It is part of the product; what its links open is
  a document. A badge that changed language under a manager because somebody
  once opened a translation would be worse than a monolingual one.
- **Hebrew carries no parameter.** `/help` is Hebrew; naming it in a link would
  suggest the other two are equally the default.
- **The switcher appears once per screen, not under every topic.** Seven of them
  would be seven navigation landmarks between a screen reader and its answer.
- **The badge is now hidden on `/help` itself** — it offered the way to the
  screen already open, and covered the text it was advertising.
- **The header link is gone, owner request.** It was the guide's first entry
  point, added before the badge existed; once the badge reached every screen —
  including the dashboard, where the header does not render at all — the two
  were doors to one room, and one of them stood in the part of the screen a
  manager reads first. The badge is the one that stayed, because it is the one
  that is everywhere.
- **The Hebrew colour words still come from `statusColorLabels`; the Russian and
  English ones are local to their files.** Only the Hebrew set is rendered
  elsewhere in the product, so only it can drift.

## Completed

- All of the above, with tests.

## Remaining

- A native reader for each language. The tests prove the numbers, the topic set
  and the direction; they cannot prove the sentences read well.

## Verification evidence

### Passed

- `npm run verify:core` — exit 0; `npm run verify:db` — exit 0. Counts in the
  commit message.
- **Run in a browser**, signed in against the production build: `/help/`,
  `/help/?lang=ru` and `/help/?lang=en` each render seven topics, declare
  `lang`/`dir` (`he`/`rtl`, `ru`/`ltr`, `en`/`ltr`), and mark the current
  language in the switcher. Horizontal overflow `0` in all three.
- The badge was opened on the dashboard and shows the three languages above its
  topic list.
- After removing the header link, the home screen was re-rendered in the
  browser: zero `a[href^="/help"]` inside `.site-header`, badge still present;
  and on `/help` itself, zero of each.

### Failed

- None outstanding. Three defects were found by looking at the rendered screen:
  the page heading kept the document's RTL direction while its body was
  translated, so a Russian sentence ended with its full stop at the wrong end;
  the badge overlapped the guide's own text on `/help`; and the badge's head put
  a heading and three chips on one line, wrapping both.

### Blocked or not run

- `npm run test:e2e` — the pinned Playwright expects a browser build the image
  does not carry.

### Residual risk

- **`/help` is no longer statically prerendered.** Reading `?lang=` makes it
  server-rendered on demand — one function invocation per view instead of a
  cached file. It reads no data, so the cost is small, but it is a change from
  what landed on `acd854d` and is stated here rather than discovered in a build
  log.
- Three languages is three times the copy that can go stale against the product,
  and only the Hebrew is the original.

## Approval gates

- None consumed.

## Questions requiring an owner decision

- None open.

## Next concrete step

Merge, or have someone read the Russian and English first. The copy is three
files under `src/lib/help/topics/`.
