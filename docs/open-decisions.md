# What still needs a human

Everything in this repository that no agent can finish alone, in one place. Two
kinds of thing are here and nothing else: a decision only the owner can take,
and an input that has to arrive from outside — a methodologist's answer, a
credential rotated in a dashboard, a school that says yes.

**This file carries no reasoning.** Every entry names what is wanted, who can
supply it, and what it unblocks, then points at the document that owns the
argument. When an entry and its source disagree, the source wins and this line
is the one to fix — the same rule the 2026-08-21 audit states for its own
abandoned feed, and for the same reason: two ledgers of one fact drift, and the
one nobody re-derives is the one that lies.

**It is not a queue.** Nothing here is ranked, and picking work means picking
which of these to ask for rather than which to start. Engineering work that an
agent can begin without any of this does not belong here; when there is any, it
is in the active task file or in `PROGRESS.md`.

Compiled 2026-08-25 by reading every source named below.

## Only the owner's hands, outside the repository

These need a dashboard, an account or a signature. Nothing in the repository can
do them and nothing in it can verify them either.

1. **Rotate `GEMINI_API_KEY`.** It was printed in full into an agent session
   transcript. This is the billed key, so the exposure is a spending risk as well
   as an access one. **Unblocks:** any paid analysis round.
   → handoff, *External blockers and approval gates* 1.
2. **Rotate the four credentials** exposed earlier in a private design-stage
   transcript. **Unblocks:** the first real respondents.
   → handoff, same section, 2.
3. **Create uptime monitors** on `/api/health`, `/api/health/ai-queue` and
   `/api/health/observability`. All three are anonymous for exactly this. The
   third answers `503` when a submission was lost, when the suggestion button
   keeps failing, when analyses are written without the model, or when the AI
   service returns a payload the contract refuses — and that `503` is the
   notification, so it reaches nobody until something watches it.
   **Unblocks:** noticing any of the above. → handoff, same section, 4 and 5.
4. **Read the provider tier**: does the real account allow more than 30 requests
   a minute? It is the ceiling above every pool number, and raising lanes past
   three without raising the pace buys nothing. **Unblocks:** any decision about
   analysis throughput. → handoff, same section, 9.
5. **The copyright line in `NOTICE`.** Whether personal ownership is the correct
   claim depends on an employment agreement no agent can read. A one-line change
   to a public file. **Unblocks:** nothing technical; it is a correctness claim
   about a public repository. → handoff, same section, 6.

## Waiting on somebody outside the project

6. **The methodologist's item-to-dimension mapping and the reverse-scored list.**
   The largest single unblock in the repository: the machinery for the 126-item
   research instrument is built and its content does not exist. Six questions are
   written and ready to send in both languages, with a section saying which to
   answer first if answering in parts. **Unblocks:** phases 5 and 6 of the
   instrument replacement, and the instrument itself.
   → [`methodologist-questions-2026-08-15-ru.md`](methodologist-questions-2026-08-15-ru.md),
   [`-he.md`](methodologist-questions-2026-08-15-he.md),
   [instrument plan](default-research-instrument-plan-2026-08-14.md) §7.1.
7. **Name a pilot school, with a date.** It converts half the 2026-08-10 strategy
   sweep from theory into a schedule. Two wordings travel with it and are
   editorial rather than engineering: the Chief Scientist directive (axis 1) and
   the fair-use commitment, including how small a staff room is too small to
   measure safely (axis 7). **Unblocks:** the strategy sweep, and bulk onboarding
   below. → [`product-strategy-axes-2026-08-10.md`](product-strategy-axes-2026-08-10.md).
8. **Which e-mail provider**, given it becomes a subprocessor that sees a school
   staff member's address. **Unblocks:** nothing — an invitation is an
   entitlement and needs no delivery, so this buys a notification rather than a
   mechanism. → [multi-tenancy plan](multi-tenancy-plan-2026-08-20.md) §6.2.

## Product decisions that are holding code

Each of these has an implementation waiting behind it. None can be guessed.

9. **Retention.** How long do `audit_events` rows, the full result JSON in
   `ai_analysis_runs`, and answer rows after a round closes actually live? The
   consent screen promises nothing about it. **Unblocks:** the remaining halves
   of two audit records. → `PROJECT_CONTEXT.md` ADR-049; audit records
   *«`ai_analysis_runs` хранит каждый полный результат вечно»* and *«События
   аудита и результаты ИИ-прогонов копятся вечно»*; strategy axis 6.
10. **Bind a submission to a server-issued signed attempt token?** The ceiling on
    answers per round shipped; binding is the other half, and it changes the
    respondent flow. Even bound, it bounds rows rather than the ratio of
    fabricated answers to real ones. **Unblocks:** the rest of that record.
    → `PROJECT_CONTEXT.md` ADR-039; audit record *«У анонимного сабмита нет
    серверной защиты от накрутки»*.
11. **Bulk onboarding** — a CSV or mass API path. The console no longer degrades
    as schools are added, but hundreds of schools are still hundreds of
    submissions. **Unblocks:** provisioning at scale; gated in practice on item 7.
    → `PROJECT_CONTEXT.md` ADR-052; audit record *«Онбординг сотен школ»*.
12. **Upstash, or not.** Without it the submission rate limiter's counter stays
    per-instance — a property of the module rather than a defect.
    **Unblocks:** the remainder of the IP-limit record. → audit record
    *«Лимит на IP может отказать большой школе»*.
13. **Is a printable report a product deliverable?** `הורדת דוח` on the map screen
    is `window.print()` and nothing else — verified in
    [`dashboard-map-page.tsx:284`](../src/components/dashboard/dashboard-map-page.tsx#L284)
    on 2026-08-25. If yes, it is the highest-value thing not yet built; if no,
    the button should go, because a broken one is worse than none.
    **Unblocks:** either building it or deleting it.
    → `product-strategy-axes-2026-08-10.md`, open decision 4.
14. **Does a goal ever gain an owner, a due date or a plan of steps?** The
    minimal version shipped and deliberately left this undecided.
    **Unblocks:** anything past the minimal goals screen.
    → [`product-behaviour-backlog.md`](product-behaviour-backlog.md) §5.
15. **Attention-check items.** Until they exist, "let the manager exclude some
    respondents" stays refused: a round publishes on exactly one basis of
    calculation (owner decision 2026-08-17). **Unblocks:** any per-respondent
    exclusion. → [instrument plan](default-research-instrument-plan-2026-08-14.md),
    and question 6 of the methodologist letter.
16. **Should the overview banner fire on a fallback, not only on `unavailable`?**
    On contract `6.0` a silent provider does not raise: all three per-dimension
    generators fall back and label themselves, so the banner stays quiet through
    the failure that is actually common. Open and unrequested.
    **Unblocks:** disclosure on the most common AI failure.
    → `PROGRESS.md`, *AI analytics*.
17. **Preview deployments: mandate the identity provider, or keep the password
    door?** Production signs in with Google and refuses a password before reading
    it. The four `OIDC_*` values are Production-only because a preview URL is
    generated per build and cannot be registered with Google, so the password
    door is alive on Preview exactly as the audit describes, and
    `MANAGER_ADMIN_EMAIL` still defaults to a well-known address. This is
    environment scope, not code. **Unblocks:** the last half of that record.
    → audit record *«Временная дверь-пароль на деплое»*.

## Methodology, for the owner together with the methodologist

These four travel with item 6 and are listed separately because answering the
mapping does not answer them.

18. **Do the scoring bands stay as they are** once answers are normalised Likert
    values? → [instrument plan](default-research-instrument-plan-2026-08-14.md) §7.3.
19. **Do background (demographic) items cross the AI boundary?** → §7.4.
20. **Are the allocation grids analysed at all**, or collected and shown without
    reaching a stone? → §7.5.
21. **The six defects in the source document.** → §7.2 and §4.

## Operational, and an agent can do it with one input

22. **Republish the three HTML documents** through `npm run docs:publish`. It
    removes the `claude-mermaid-runtime` block whole, which is what ends the
    duplicated `<style>` two published pages have carried since 2026-08-20. The
    input needed is the URL of each existing artifact; without it a republish
    creates a second artifact instead of updating the first.
    → [`README.md`](README.md) owns the publishing rule; the handoff's *Published
    documents* section records what the hand version left behind.

## Decided or conditional — listed so they are not reopened

Nothing here is waiting for anyone. Each was decided, deferred on purpose, or
recorded as a considered hold, and each has cost a re-litigation at least once.

- **AI analysis across rounds** — refused by the owner 2026-08-04. Deterministic
  deltas yes, cross-round narrative no.
- **Widening mutation scope to a second subject** — conditional, and nothing has
  asked for it. → `ROADMAP.md`, *Conditional, not scheduled*.
- **Repeat-measurement reminders** — future work, and the proposal names the
  manager as the only reachable party so that a reminder feature cannot quietly
  introduce respondent contact details. → `product-behaviour-backlog.md` §11.
- **More than one manager per school** — not requested. → §8.
- **A session revocation list.** A token already in a revoked person's browser
  outlives the revocation by at most fifteen minutes. Closing that is a different
  design from the one phase 5 asked for. → `PROJECT_CONTEXT.md` ADR-028.
- **The breakdown screen's second read of responses.** Closing it means passing
  responses out of `ManagerContextService.load`, widening a seam seven other
  screens use, for a case that is now conditional. → ADR-050.
- **A mutation score threshold in CI** — closed rather than conditional; the
  score moves under changes that leave test strength alone. → `ROADMAP.md`.
- **Own passwords** — superseded 2026-08-20: identity comes from the provider and
  no password hash is stored, so "replace SHA-256" is moot rather than pending.
- **Arabic localization** — closed by owner decision 2026-08-10.
- **A licence file** — deliberate. `NOTICE` states the repository is publicly
  readable and not open source; item 5 above is about attribution, not licensing.
