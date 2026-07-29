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

from src.config import settings  # noqa: E402
from src.services.provider_rate_limit import (  # noqa: E402
    provider_rate_limiter,
)
from tests.llm_stub import answering_llm_provider  # noqa: E402


@pytest.fixture(autouse=True)
def unpaced_provider(monkeypatch):
    """No suite waits on the deployed pace unless the pace is what it proves.

    The queue toward the provider is one per process — that is the whole point
    of it — so the default of five requests per minute would put twelve seconds
    between the provider calls of every test that reaches the transport. Tests
    that own the invariant set their own rate and reset the queue.
    """
    provider_rate_limiter.reset()
    monkeypatch.setattr(settings, "llm_max_requests_per_minute", 0.0)
    yield
    provider_rate_limiter.reset()


@pytest.fixture
def answering_llm():
    """Let a test exercise the pipeline without a provider.

    See `tests/llm_stub.py` for what the stub answers and why a round now needs
    one at all.
    """
    with answering_llm_provider():
        yield
