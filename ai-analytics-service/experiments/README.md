# Prompt experiments

Two standalone scripts kept from the prompt-depth work of 2026-07-28. They are
not tests and nothing in the pipeline imports them.

- `prompt_depth_overall_summary.py` prints the raw provider output for the
  overall summary and for one dimension, with the acceptance predicate wrapped
  so each verdict is visible.
- `prompt_depth_raw_answers.py` tries a richer per-dimension prompt that
  carries question texts and individual answers, and asks for three
  interpretations per dimension.

Both use invented data — no respondent input, real or seeded — and both call a
live provider, so running one spends quota.

Run them from the service root, which is where their `load_dotenv(".env")`
looks:

```bash
.venv/bin/python experiments/prompt_depth_overall_summary.py
```

They used to sit at the service root as `test_prompt.py` and
`test_raw_answers.py`. The names put them in pytest's collection path, and
`prompt_depth_overall_summary.py` calls a provider at import, so
`python -m pytest ai-analytics-service` ended in a collection error unrelated
to whatever the person running it had changed. The configured run was never
affected — `pyproject.toml` sets `testpaths = ["tests"]`.
