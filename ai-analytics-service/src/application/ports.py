"""What the analysis run needs from the world, named.

Stage 4 of the refactoring plan: the runner used to reach for module-level
singletons — an MCP client, a graph, an HTTP call written into its own body —
so there was no way to say what it depends on other than pointing at imports.
These protocols say it. The concrete objects are still the same ones; what
changed is that they arrive through a constructor.

Nothing here imports an implementation, so a port stays cheap to satisfy: a
test double is any object with the right methods.
"""

from typing import Any, Dict, Optional, Protocol

from src.agents.state import AnalyticsState
from src.schemas.mcp_types import RoundAnalyticsResult


class AnalyticsSource(Protocol):
    """Where the round's aggregates come from."""

    async def fetch_round_analytics(
        self,
        round_id: str,
    ) -> RoundAnalyticsResult: ...


class StoneMapPipeline(Protocol):
    """What turns a prepared state into a finished Stone Map."""

    async def ainvoke(self, state: AnalyticsState) -> AnalyticsState: ...


class ResultSink(Protocol):
    """Where a finished payload goes.

    The sink owns the address as well as the delivery: a round id is all the
    caller knows, and how that becomes a URL is transport detail.
    """

    async def deliver(
        self,
        round_id: str,
        payload: Dict[str, Any],
        *,
        run_id: Optional[str] = None,
        lease_token: Optional[str] = None,
    ) -> None: ...


class JobStore(Protocol):
    """The durable job state the worker leases work from."""

    async def claim(self, worker_id: str) -> Optional[Any]: ...

    async def heartbeat(self, run_id: str, lease_token: str) -> bool: ...

    async def fail(
        self,
        run_id: str,
        lease_token: str,
        failure_code: str,
    ) -> bool: ...


class AnalysisRunner(Protocol):
    """One round, analysed and delivered."""

    async def process_round(
        self,
        round_id: str,
        *,
        run_id: Optional[str] = None,
        lease_token: Optional[str] = None,
    ) -> Dict[str, Any]: ...
