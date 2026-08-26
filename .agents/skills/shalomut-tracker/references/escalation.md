# Role or model escalation — the procedure

Open this file only when a trigger from the `Role or model escalation` section
of [../SKILL.md](../SKILL.md) has fired. Until one does, the policy is silent
and there is nothing here to read.

## What to do

1. Finish a safe bounded step first. An unfinished step makes the
   recommendation useless: the next agent does not know where you stopped.
2. Update the task file: findings, residual risk and one `Next concrete step`.
3. Recommend exactly one action:
   - continue with the current agent;
   - bring in the `strong reasoning model` role;
   - bring in the `independent reviewer` role;
   - split independent work across separate branches or worktrees.

Never switch model automatically. Never assert a model's availability,
superiority or remaining usage without evidence from the client.

## Output format

Do not add complexity scores, token estimates, model tables or comparisons of
commercial models. They look like measurement, and none of them is measured
here. Output only:

```text
Model recommendation: <one action>.
Reason: <one sentence>.
Handoff: <task file and next step>.
```

## The block in the task file

Only on a real escalation, add:

```md
## Agent recommendation

- Recommended role:
- Reason:
```
