# Product Behaviour Backlog

Date: 2026-07-03
Status: remaining product behaviour proposals after the redesign pass

## Completed In This Pass

- Centralized navigation and route/action metadata in `src/lib/navigation.ts`.
- Removed duplicated workflow navigation from setup and round next-step bands.
- Kept global navigation as the persistent route switcher and kept local CTAs only where they represent the next workflow action.

## Remaining Product Behaviour Work

### 1. Draft Persistence And Recovery

Current state: setup and survey-builder edits are demo-local React state. Refreshing the page resets the form.

Proposal:
- Decide whether this demo should behave as an ephemeral prototype or persist manager draft state.
- If persistence is desired, store setup and survey-builder drafts in `localStorage` with an explicit demo-only namespace.
- Add a visible "last saved" timestamp after save actions.
- Add a reset-to-demo-data action so reviewers can recover the original demo state.

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

### 6. Privacy Threshold States Across Routes

Current state: the dashboard has a locked state when responses are below the threshold, while setup/round explain the threshold.

Proposal:
- Add one shared threshold state model for all manager-facing routes.
- Make the round page explicitly show when the dashboard is locked vs ready.
- Add a clear "what happens next" message when the threshold is reached.

Why it matters:
- Privacy is a primary product promise.
- A consistent threshold model makes the system easier to trust.

### 7. Demo Data Boundaries

Current state: methodology source and demo runtime data are separated, but the app still runs entirely on mock data.

Proposal:
- Add a small docs note or UI badge clarifying which values are mock demo data.
- Prepare an adapter boundary for future pilot data ingestion.
- Keep scoring thresholds configurable and avoid hard-coding status assumptions in view components.

Why it matters:
- The demo is closer to a real product now, so mock-data boundaries need to stay visible to maintain trust.
