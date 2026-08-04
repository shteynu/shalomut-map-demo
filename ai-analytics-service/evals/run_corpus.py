"""Drive the real pipeline over the corpus and keep what it produced.

This is the step that costs money, so it is a separate command from scoring and
it is never run by a test. It calls the same graph the durable worker calls,
with the corpus case standing in for what Core would have sent, and writes each
finished Stone Map to a file for `evals.report` to score.

Everything about the provider comes from the environment the service already
uses. Nothing here reads, prints or writes a key.
"""

import argparse
import asyncio
import json
import os
import re
import sys
import time
from pathlib import Path
from typing import List, Optional

# Nothing from `src` or `evals.corpus` is imported at module level, and that
# is load-bearing: `src.config` builds its settings singleton at import time,
# and the provider service reads the key from it once. An import above the env
# load leaves the run keyless, which does not fail — it quietly produces
# deterministic copy with `attempts: 0` and calls the round a success.

ENV_LINE = re.compile(r"^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$")


def load_env_file(path: Path) -> List[str]:
    """Put an env file into this process, and report only the names.

    The service has no dotenv dependency — deployment supplies the environment
    directly — so a local run has to do it explicitly. Existing variables win,
    so an exported key is never overwritten by a stale file.
    """
    if not path.exists():
        return []
    names: List[str] = []
    for line in path.read_text(encoding="utf-8").splitlines():
        if line.lstrip().startswith("#"):
            continue
        match = ENV_LINE.match(line)
        if not match:
            continue
        name, value = match.group(1), match.group(2).strip("\"'")
        if name not in os.environ:
            os.environ[name] = value
        names.append(name)
    return names


async def run_case(case, out_dir: Path) -> dict:
    from src.pipeline_cli import run_pipeline

    started = time.monotonic()
    payload = await run_pipeline(case.to_analysis_input())
    elapsed = time.monotonic() - started

    target = out_dir / f"{case.case_id}.json"
    target.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True),
        encoding="utf-8",
    )
    return {
        "caseId": case.case_id,
        "status": payload.get("status"),
        "failureReason": payload.get("failureReason"),
        "seconds": round(elapsed, 1),
        "path": str(target),
    }


async def run(cases: List, out_dir: Path, skip_existing: bool) -> int:
    out_dir.mkdir(parents=True, exist_ok=True)
    failures = 0

    for index, case in enumerate(cases, start=1):
        target = out_dir / f"{case.case_id}.json"
        if skip_existing and target.exists():
            print(f"[{index}/{len(cases)}] {case.case_id}: kept existing")
            continue

        print(f"[{index}/{len(cases)}] {case.case_id}: running…", flush=True)
        try:
            outcome = await run_case(case, out_dir)
        except Exception as error:  # noqa: BLE001 - the report is the product
            failures += 1
            # The message, not the traceback: a provider error can carry a URL
            # and this output is meant to be pasteable.
            print(f"    failed: {type(error).__name__}: {error}", flush=True)
            continue

        # A locked round is supposed to come back locked; calling that a
        # failure would report the corpus's own privacy case as a defect.
        expected = "locked_error" if case.locked else "success"
        if outcome["status"] != expected:
            failures += 1
        print(
            f"    {outcome['status']}"
            + (f" ({outcome['failureReason']})" if outcome["failureReason"] else "")
            + f" in {outcome['seconds']}s",
            flush=True,
        )

    return failures


def main(argv: Optional[List[str]] = None) -> int:
    parser = argparse.ArgumentParser(
        prog="python -m evals.run_corpus",
        description=(
            "Run the eval corpus through the real pipeline. This calls a "
            "provider and costs money; scoring the results is a separate "
            "command."
        ),
    )
    parser.add_argument("--out", required=True, help="directory for the payloads")
    parser.add_argument(
        "--cases",
        help="comma-separated case ids; every case by default",
    )
    parser.add_argument(
        "--skip-existing",
        action="store_true",
        help="leave payloads that are already on disk alone",
    )
    parser.add_argument(
        "--env-file",
        default=".env",
        help="env file to load before running; existing variables win",
    )
    args = parser.parse_args(argv)

    loaded = load_env_file(Path(args.env_file))
    if loaded:
        print(f"loaded {len(loaded)} variables from {args.env_file}: "
              f"{', '.join(sorted(loaded))}")

    # Imported only now, with the environment already in place.
    from evals.corpus import CASES, CASES_BY_ID

    if args.cases:
        try:
            cases = [CASES_BY_ID[case_id] for case_id in args.cases.split(",")]
        except KeyError as missing:
            print(f"unknown case {missing}", file=sys.stderr)
            return 2
    else:
        cases = list(CASES)

    from src.config import settings

    print(
        f"provider {settings.resolved_llm_provider()} "
        f"({settings.llm_model_fast} / {settings.llm_model_heavy}), "
        f"key {'configured' if settings.llm_api_key else 'MISSING'}, "
        f"{settings.llm_max_requests_per_minute:g} requests/minute"
    )
    if not settings.llm_api_key:
        # Refusing beats producing a corpus of deterministic copy and filing
        # it as evidence about the prompts.
        print(
            "refusing to run: no provider key, so every round would come back "
            "as deterministic fallback",
            file=sys.stderr,
        )
        return 2

    failures = asyncio.run(run(cases, Path(args.out), args.skip_existing))
    if failures:
        print(f"{failures} of {len(cases)} case(s) did not come back successful")
    return 0


if __name__ == "__main__":  # pragma: no cover - CLI entry
    raise SystemExit(main())
