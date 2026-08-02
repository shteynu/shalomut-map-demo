# Product Behaviour Backlog

Date: 2026-07-03
Status: remaining product behaviour proposals after the redesign pass

## Completed In This Pass

- Centralized navigation and route/action metadata in `src/lib/navigation.ts`.
- Removed duplicated workflow navigation from setup and round next-step bands.
- Kept global navigation as the persistent route switcher and kept local CTAs only where they represent the next workflow action.

## Remaining Product Behaviour Work

### 1. Draft Persistence And Recovery

Current state: setup and survey-builder edits persist through the Data Layer into the current organization/round. The 24 canonical questions are protected from disabling or reassignment.

Remaining proposal:
- Add a visible "last saved" timestamp after save actions.
- Add explicit draft/version history if editors need recovery beyond the latest persisted definition.

Why it matters:
- Principals will expect setup and survey edits to survive accidental refreshes.
- Demo reviewers need clarity about whether "save" is a product promise or a prototype signal.

### 2. Save, Copy, And Clipboard Failure States

Current state: copy actions show success even if clipboard writing fails.

Proposal:
- Track copy success and failure separately.
- Show fallback instructions when clipboard access is blocked.
- Keep Hebrew, privacy-first copy and avoid exposing respondent identity.

Why it matters:
- Mobile browsers and embedded browsers often block clipboard access.
- A false success state can make the distribution flow feel unreliable.

### 3. Survey Builder Efficiency

Current state: the builder supports filtering by dimension, toggling required/enabled state, duplicating questions, and adding demo-bank questions.

Proposal:
- Add search across question text and dimension labels.
- Add bulk controls for enabling/disabling questions by dimension.
- Add explicit reorder support or remove drag affordances until reorder is implemented.
- Add keyboard-friendly edit actions for common builder operations.

Why it matters:
- A real 24-question instrument is small but still benefits from fast review and batch editing.
- Visible drag handles imply a behaviour that is not fully implemented yet.

### 4. Dashboard Map Accessibility

Current state: desktop stones can be dragged, mobile stones are tap-first, and reset is available on desktop.

Proposal:
- Add keyboard nudge controls for selected stones on desktop.
- Add an accessible "reset map arrangement" action reachable by keyboard.
- Add a reduced-motion treatment for drag and hover transitions.
- Consider saving customized map positions per session if rearrangement becomes a product feature.

Why it matters:
- The map is a core interaction, so keyboard and reduced-motion support should match its importance.
- If rearranging stones is meaningful, users will expect their arrangement to persist.

### 5. Dashboard Action Follow-Through

Current state: detail pages lead from summary to highlighted metrics to recommendations, with a back-to-map action.

Proposal:
- Define whether recommendations are only read-only guidance or can become tracked goals.
- If tracked goals are desired, add a goal selection state and a lightweight action plan surface.
- Keep results aggregated and never expose per-person data.

Why it matters:
- The product principle is "from picture to action"; tracked goals are the likely next step beyond visual diagnosis.

### 6. Privacy Threshold States Across Routes (completed 2026-08-02)

Current state: manager context exposes one persisted threshold/count model;
home, round, dashboard and dimension routes use it, and detailed analytics stay
locked below threshold. The round screen now explains the next step before the
threshold and distinguishes the persisted analysis lifecycle after it:
checking, queued/running, ready, question-level privacy lock, missing result and
failure. Ready and running states lead to the map; missing and failed states
lead to the existing analysis refresh action without exposing raw service
errors.

Why it matters:
- Privacy is a primary product promise.
- A consistent threshold model makes the system easier to trust.

### 7. Demo Data Boundaries

Current state: methodology source and visual metadata are separated from
runtime records. Manager routes use persisted organization/current-round data,
explicit empty onboarding states, real share codes and real round IDs. Demo
records are not a production fallback.

Remaining proposal:
- Keep only stone geometry and other non-record visual metadata in the mock
  layer.
- Keep scoring thresholds configurable and avoid hard-coding status assumptions in view components.

Why it matters:
- A zeroed mock screen can look correct while still not reflecting PostgreSQL.
- Runtime data provenance must be unambiguous for school leaders to trust the
  product.
