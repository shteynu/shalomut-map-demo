import asyncio
import json
import logging
import urllib.request
from typing import Optional, Dict, Any
from src.schemas.mcp_types import RoundAnalyticsResult
from src.mcp_client.mock_server import mock_mcp_server
from src.config import settings

logger = logging.getLogger(__name__)

MCP_REQUEST_TIMEOUT_SECONDS = 5.0

class MCPClientManager:
    """
    MCP Client Manager.
    Calls `get_round_analytics(roundId)` on the Data Layer MCP Server.
    Falls back to local mock MCP server when offline or in dev mode.
    """
    def __init__(self, mcp_server_url: Optional[str] = None):
        configured_url = mcp_server_url or settings.data_layer_mcp_url
        self.mcp_server_url = f"{configured_url.rstrip('/')}/"

    async def fetch_round_analytics(self, round_id: str) -> RoundAnalyticsResult:
        """
        Invokes MCP tool `get_round_analytics(roundId)`
        """
        if settings.use_mock_mcp:
            logger.info(f"[MCP Client] Using Mock Data Layer MCP Server for round: {round_id}")
            return mock_mcp_server.get_round_analytics(round_id)

        try:
            req_payload = json.dumps({
                "jsonrpc": "2.0",
                "id": "1",
                "method": "tools/call",
                "params": {
                    "name": "get_round_analytics",
                    "arguments": {"roundId": round_id}
                }
            }).encode("utf-8")

            headers = {"Content-Type": "application/json"}
            if settings.mcp_shared_secret:
                headers["Authorization"] = f"Bearer {settings.mcp_shared_secret}"
            if settings.vercel_protection_bypass:
                headers["x-vercel-protection-bypass"] = settings.vercel_protection_bypass

            req = urllib.request.Request(
                self.mcp_server_url,
                data=req_payload,
                headers=headers,
                method="POST"
            )

            body = await asyncio.to_thread(self._read_response, req)

            data = json.loads(body)
            result_content = data.get("result", {}).get("content", [{}])[0].get("text")
            if not result_content:
                error = data.get("error", {}).get("message", "missing tool result")
                raise RuntimeError(f"MCP server returned an invalid response: {error}")

            parsed_json = json.loads(result_content)
            return RoundAnalyticsResult.from_dict(parsed_json)
        except Exception as e:
            raise RuntimeError(
                f"Unable to fetch round analytics from MCP server: {e}"
            ) from e

    @staticmethod
    def _read_response(req: urllib.request.Request) -> str:
        """
        Blocking transport, executed in a worker thread so the event loop
        stays responsive while the Data Layer answers.
        """
        with urllib.request.urlopen(req, timeout=MCP_REQUEST_TIMEOUT_SECONDS) as response:
            if response.status != 200:
                raise RuntimeError(f"MCP server returned HTTP {response.status}")
            return response.read().decode("utf-8")

mcp_client_manager = MCPClientManager()
