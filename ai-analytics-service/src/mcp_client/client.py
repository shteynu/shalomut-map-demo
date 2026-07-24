import json
import logging
import urllib.request
from typing import Optional, Dict, Any
from src.schemas.mcp_types import RoundAnalyticsResult
from src.mcp_client.mock_server import mock_mcp_server
from src.config import settings

logger = logging.getLogger(__name__)

class MCPClientManager:
    """
    MCP Client Manager.
    Calls `get_round_analytics(roundId)` on the Data Layer MCP Server.
    Falls back to local mock MCP server when offline or in dev mode.
    """
    def __init__(self, mcp_server_url: Optional[str] = None):
        self.mcp_server_url = mcp_server_url or settings.data_layer_mcp_url

    async def fetch_round_analytics(self, round_id: str) -> RoundAnalyticsResult:
        """
        Invokes MCP tool `get_round_analytics(roundId)`
        """
        # In mock/dev environment or if URL is local fallback, use mock_mcp_server directly
        if settings.env == "development" or "localhost" in self.mcp_server_url:
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

            req = urllib.request.Request(
                self.mcp_server_url,
                data=req_payload,
                headers={"Content-Type": "application/json"},
                method="POST"
            )

            with urllib.request.urlopen(req, timeout=5.0) as response:
                if response.status == 200:
                    data = json.loads(response.read().decode("utf-8"))
                    result_content = data.get("result", {}).get("content", [{}])[0].get("text", "{}")
                    parsed_json = json.loads(result_content)
                    return RoundAnalyticsResult.from_dict(parsed_json)
        except Exception as e:
            logger.warning(f"[MCP Client] Remote MCP call failed ({e}), using mock server fallback.")

        return mock_mcp_server.get_round_analytics(round_id)

mcp_client_manager = MCPClientManager()
