"""One scored report, stable enough to subtract one run from another.

The output is sorted, rounded and free of timestamps on purpose: two reports
from the same payloads are byte-identical, so `diff` shows what a prompt or a
model change did and nothing else. Whatever varies per run — when it ran, which
model answered — belongs in the caller's notes, not in the thing being compared.
"""

import argparse
import json
import sys
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional

from evals.corpus import CASES, CorpusCase, case_for_round_id
from evals.graders import grade


def grade_payload(payload: Dict[str, Any], case: CorpusCase) -> Dict[str, Any]:
    """One case's scores, plus what the case was built to catch."""
    results = grade(payload, case)
    scores = {result.name: result for result in results}
    return {
        "caseId": case.case_id,
        "challenge": case.challenge,
        "status": payload.get("status"),
        "isLocked": bool(payload.get("isLocked")),
        "meanScore": round(
            sum(result.score for result in results) / len(results), 4
        ),
        "graders": [scores[name].to_dict() for name in sorted(scores)],
    }


def build_report(graded: Iterable[Dict[str, Any]]) -> Dict[str, Any]:
    cases = sorted(graded, key=lambda entry: entry["caseId"])
    if not cases:
        return {"cases": [], "graderMeans": {}, "meanScore": 0.0, "findings": 0}

    grader_totals: Dict[str, List[float]] = {}
    findings = 0
    for case in cases:
        for grader in case["graders"]:
            grader_totals.setdefault(grader["name"], []).append(grader["score"])
            findings += len(grader["findings"])

    return {
        "cases": cases,
        "graderMeans": {
            name: round(sum(scores) / len(scores), 4)
            for name, scores in sorted(grader_totals.items())
        },
        "meanScore": round(
            sum(case["meanScore"] for case in cases) / len(cases), 4
        ),
        "findings": findings,
    }


def render(report: Dict[str, Any]) -> str:
    return json.dumps(report, ensure_ascii=False, indent=2, sort_keys=True)


def _load_payloads(paths: Iterable[str]) -> List[Dict[str, Any]]:
    payloads: List[Dict[str, Any]] = []
    for raw_path in paths:
        loaded = json.loads(Path(raw_path).read_text(encoding="utf-8"))
        payloads.extend(loaded if isinstance(loaded, list) else [loaded])
    return payloads


def _case_of(payload: Dict[str, Any]) -> Optional[CorpusCase]:
    return case_for_round_id(str(payload.get("roundId") or ""))


def main(argv: Optional[List[str]] = None) -> int:
    parser = argparse.ArgumentParser(
        prog="python -m evals.report",
        description=(
            "Score Stone Map payloads produced from the eval corpus. Each "
            "payload is matched to its case by the round id it carries."
        ),
    )
    parser.add_argument(
        "payloads",
        nargs="*",
        help="JSON files, each one payload or an array of payloads",
    )
    parser.add_argument(
        "--list-cases",
        action="store_true",
        help="print the corpus cases and what each one is built to catch",
    )
    parser.add_argument(
        "--emit-inputs",
        metavar="DIR",
        help="write each case's contract input to DIR, to feed a real run",
    )
    args = parser.parse_args(argv)

    if args.list_cases:
        for case in CASES:
            print(f"{case.case_id}\n    {case.challenge}\n")
        return 0

    if args.emit_inputs:
        target = Path(args.emit_inputs)
        target.mkdir(parents=True, exist_ok=True)
        for case in CASES:
            path = target / f"{case.case_id}.json"
            path.write_text(
                json.dumps(
                    case.to_analysis_input(),
                    ensure_ascii=False,
                    indent=2,
                    sort_keys=True,
                ),
                encoding="utf-8",
            )
            print(f"wrote {path}")
        return 0

    if not args.payloads:
        parser.print_help()
        return 2

    graded: List[Dict[str, Any]] = []
    unmatched: List[str] = []
    for payload in _load_payloads(args.payloads):
        case = _case_of(payload)
        if case is None:
            unmatched.append(str(payload.get("roundId")))
            continue
        graded.append(grade_payload(payload, case))

    print(render(build_report(graded)))
    if unmatched:
        # Loud, because a silently skipped payload would read as a clean run.
        print(
            f"skipped {len(unmatched)} payload(s) with no matching corpus case: "
            + ", ".join(sorted(unmatched)),
            file=sys.stderr,
        )
    return 0


if __name__ == "__main__":  # pragma: no cover - CLI entry
    raise SystemExit(main())
