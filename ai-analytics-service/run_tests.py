"""Compatibility entry point for the AI analytics service test suite.

The canonical command is `python -m pytest` from this directory. This wrapper
only forwards to it, so an older runbook that still calls `run_tests.py`
cannot report a green run over a subset of the tests: until 2026-07-27 the
file held its own sixteen tests and never touched `tests/`, which is where the
contract 5.0 suite lives. Those sixteen now live in
`tests/test_service_integration.py`.
"""

import subprocess
import sys
from pathlib import Path


def main() -> int:
    service_root = Path(__file__).resolve().parent
    print("run_tests.py delegates to pytest — canonical: python -m pytest")
    return subprocess.call(
        [sys.executable, "-m", "pytest", *sys.argv[1:]],
        cwd=service_root,
    )


if __name__ == "__main__":
    raise SystemExit(main())
