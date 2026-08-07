# Product Roadmap — Shalomut Map (מפת שלומות)

Updated: 2026-08-05. This roadmap summarizes outcomes; detailed session history
belongs in archived task files and Git.

## Completed platform foundation

- Hebrew RTL-first, warm organic Stone Map UI with explicit status labels,
  privacy-locked states and WCAG AA targets.
- Persisted organizations, configurable survey rounds, dynamic questionnaires,
  anonymous response submission and PostgreSQL-backed aggregation.
- Application-level manager login and server-owned organization scope; machine
  endpoints use separate shared-secret boundaries.
- Privacy threshold of ten as both default and minimum, with lifecycle-aware
  manager messaging before and after the threshold.
- Database-enforced response idempotency and durable AI analysis jobs with
  queue/lease/heartbeat/retry/callback state.
- Versioned AI analytics contracts `1.0`–`6.0`, shared capability metadata,
  callback cross-runtime corpora and fail-closed validation.
- Dynamic exact-question analytics, background context, score distributions,
  partial-map history, structured V6 summaries, narrative metrics and five
  recommendations per stone.
- AI-assisted questionnaire suggestions that identify their source and require
  a manager edit before joining the questionnaire.
- Canonical Core analytics separated from wire encoding; Python parsing/output
  adapters and application ports for source, sink, job store and text generator.
- Full TypeScript, PostgreSQL and Python verification in CI, plus an opt-in
  Stryker mutation-testing pilot for the AI-contract validator and the shared
  scoring bands one of its rules moved into.

## Next product outcomes

None open. All five outcomes this section listed were delivered or decided
between 2026-08-02 and 2026-08-05, and the list is recorded here as shipped
rather than deleted, so nobody rebuilds it from an old copy of this file.
`docs/product-behaviour-backlog.md` is the living record of each; this is the
summary.

1. **Comparative multi-round analytics** — shipped as the deterministic
   dimension delta the map carries per stone, plus the round switcher, second
   rounds and the read-only archive. AI analysis *across* rounds was decided
   against on 2026-08-04 and is a hold, not a gap (backlog §10).
2. **From recommendations to action** — decided on 2026-08-04: a recommendation
   becomes a tracked goal with three states and no form to fill. Since
   2026-08-05 a school also reads its goals in one place, across every round
   (backlog §5, ADR-015). Owners, due dates and plans of steps remain a separate
   decision that has not been taken.
3. **Survey-builder recovery and efficiency** — shipped whole: search, bulk
   enable/hide, real reordering, keyboard accelerators read from the physical
   key, a save time that survives a reload, and the version history with restore
   that closed the "optional" half on 2026-08-05 (backlog §1, §3, ADR-019).
4. **Dashboard interaction accessibility** — shipped: keyboard stone movement,
   focus returned and announced on reset, reduced-motion coverage. Two items
   stay deliberately undone and are reasoned in backlog §4 — no announcement per
   nudge while rearranging is cosmetic, and screen-reader output that has been
   read as markup but never heard.
5. **Clipboard failure honesty** — shipped on 2026-08-04: three outcomes, a
   refusal that names Ctrl+C/Cmd+C and selects the link, shared by both copy
   surfaces (backlog §2).

What is left in the product backlog is gated rather than queued: a second
manager per school (§8) and repeat-measurement reminders (§11) both wait on
being requested, and §5's remaining question — whether a goal gains an owner, a
due date or a plan — is a decision rather than work.

## Next architecture outcomes

None open. The last item — classifying high-value surviving mutants before
expanding mutation scope — was closed on 2026-08-03; what it found is in
`docs/agent-tasks/archive/test--classify-surviving-mutants.md`.

## Conditional, not scheduled

- Widening mutation scope to a subject beyond the AI-contract validator. The
  precondition this item carried — that the older contracts had no payload
  fixtures of their own, so a new target would be measured against the same
  blind spot — was met on 2026-08-07: `1.0`–`3.0` now have valid payloads and a
  refusal test per rule, and their validators hold single-digit survivor counts
  instead of roughly three fifths of the total. What remains unmeasured is the
  same shape one version up, in the `4.0`/`5.0` stone and provenance rules, so
  giving those their refusing half is the cheaper next slice than a second
  subject. The pilot stays opt-in and non-blocking either way. Following a rule
  out of the validator — as `src/lib/scoring-bands.ts` was followed on
  2026-08-05 — is not this item: it keeps one subject whole rather than adding
  a second.

- A mutation score threshold in CI stays closed rather than conditional, and
  is recorded here so it is not reopened by habit. The score is not stable
  under changes that leave test strength alone: on 2026-08-05 it moved down
  when `statusForScore` changed file and up when two test files rejoined the
  runner's list, and 42 of the bands' mutants are excluded from it entirely
  because they crash module initialization. A threshold would fail honest work
  and pass the refactor that removed a rule from measurement. What CI does
  enforce is that the runner starts (`--dryRunOnly`) and that the test list
  matches the repository (`npm run lint:mutation-config`) — both facts about
  the instrument, not about the number it produces.

- The long-term identity model, when a second manager per school, multi-tenant
  hosting or real respondents is actually requested. One manager per deployment
  is the current product shape and a deliberate decision, not unfinished work;
  see `PROJECT_CONTEXT.md` ADR-013 and
  `docs/product-behaviour-backlog.md` §8.
- Nx monorepo migration only if the product is actually split into independently
  built applications such as survey, admin and mobile.
- Additional deployed environments only when product operations require them;
  today the supported environments are local and deployed.
