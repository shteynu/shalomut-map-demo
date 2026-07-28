"""Put the service root on `sys.path` for every pytest invocation.

The suites import `src.…` directly. That resolved only when pytest was started
as `python -m pytest` from this directory, because the interpreter itself adds
the working directory; a bare `pytest` failed to collect. A root conftest makes
the canonical command work either way.
"""

import sys
from pathlib import Path

SERVICE_ROOT = Path(__file__).resolve().parent

if str(SERVICE_ROOT) not in sys.path:
    sys.path.insert(0, str(SERVICE_ROOT))

import pytest  # noqa: E402

from tests.llm_stub import answering_llm_provider  # noqa: E402


@pytest.fixture
def answering_llm():
    """Let a test exercise the pipeline without a provider.

    See `tests/llm_stub.py` for what the stub answers and why a round now needs
    one at all.
    """
    with answering_llm_provider():
        yield
