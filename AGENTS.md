# Shalomut Map — instructions for AI coding agents

These instructions apply to every coding agent working in this repository.
Treat the version-controlled skills under `.agents/skills/` as the canonical
agent guidance. Do not prefer user-local or ignored copies of the same skills.

## Required skill routing

- For every task that changes or reviews Shalomut product behavior, code,
  tests, UI, methodology, API, persistence, AI integration or documentation,
  read `.agents/skills/shalomut-map/SKILL.md` fully before substantial work.
- When the user asks to start, continue or resume work, report project status,
  choose next steps, save progress, close a session or prepare a handoff, read
  `.agents/skills/shalomut-tracker/SKILL.md` fully.
- When the user asks to verify, test, prove a fix, check readiness or review
  evidence, or before claiming a substantive change is complete, read
  `.agents/skills/shalomut-verification/SKILL.md` fully.
- When multiple skills apply, use `shalomut-tracker` first to establish state,
  `shalomut-map` for implementation and `shalomut-verification` for evidence.
- If the current agent does not implement automatic Agent Skills discovery,
  open the matching `SKILL.md` files directly and follow them as repository
  instructions.

## Repository-wide safety gates

- The project is at the design stage: one environment, no real respondents and
  no production data. The Vercel alias named `Production` is an operational
  staging endpoint. Treat database contents as disposable — clearing, reseeding,
  resetting the schema and applying migrations are ordinary work and need no
  approval ritual, backup or PITR checkpoint. Confirm the target environment
  because a write to the wrong place wastes time, not because the data is
  precious.
- Obtain explicit bounded approval before changing credentials, secrets or
  authentication configuration, and before repointing deployment aliases.
- Never expose respondent identity or detailed results below the configured
  privacy threshold. This is a product invariant, not an environment gate.
- Preserve unrelated user changes in a dirty worktree and verify changes in
  proportion to risk.

Direct system, developer and user instructions take precedence over this file.
