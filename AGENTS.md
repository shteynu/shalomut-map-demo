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
- When both skills apply, use `shalomut-tracker` first to establish current
  state, then `shalomut-map` for implementation.
- If the current agent does not implement automatic Agent Skills discovery,
  open the matching `SKILL.md` files directly and follow them as repository
  instructions.

## Repository-wide safety gates

- Obtain explicit bounded approval before mutating production data, shared
  databases, credentials, secrets, authentication configuration, deployment
  aliases or production deployments.
- Do not apply a database migration until the exact environment, target and
  rollback/PITR path are confirmed.
- Never expose respondent identity or detailed results below the configured
  privacy threshold.
- Preserve unrelated user changes in a dirty worktree and verify changes in
  proportion to risk.

Direct system, developer and user instructions take precedence over this file.
