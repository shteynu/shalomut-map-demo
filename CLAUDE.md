# Claude Code project instructions

@./AGENTS.md

Use the canonical Agent Skills stored in `.agents/skills/`. If skill discovery
is unavailable in the active Claude client, follow the direct-read fallback in
`AGENTS.md`, which also owns the rule for how much of a skill to read.

Do not create a `.claude/skills/` copy to make discovery work. `.gitignore`
ignores `.claude/`, so that copy would be invisible to Git and to every other
agent, and it would drift from the canonical file without ever showing a diff.
