import asyncio
import json
from unittest.mock import patch

from src.config import settings
from src.mcp_client.client import MCPClientManager
from src.mcp_client.mock_server import mock_mcp_server


def _fetch_from_response(response: dict):
    previous_use_mock = settings.use_mock_mcp
    settings.use_mock_mcp = False
    client = MCPClientManager("https://data-layer.example/api/mcp")
    try:
        with patch.object(client, "_read_response", return_value=json.dumps(response)):
            return asyncio.run(client.fetch_round_analytics("round-unlocked-sample"))
    finally:
        settings.use_mock_mcp = previous_use_mock


def test_reads_standard_call_tool_result_structured_content():
    payload = mock_mcp_server.get_round_analytics(
        "round-unlocked-sample"
    ).to_dict()

    parsed = _fetch_from_response({
        "jsonrpc": "2.0",
        "id": "1",
        "result": {
            "content": [{"type": "text", "text": "not valid JSON"}],
            "structuredContent": payload,
        },
    })

    assert parsed.roundId == payload["roundId"]
    assert parsed.contractVersion == payload["contractVersion"]


def test_falls_back_to_text_content_during_consumer_first_rollout():
    payload = mock_mcp_server.get_round_analytics(
        "round-unlocked-sample"
    ).to_dict()

    parsed = _fetch_from_response({
        "jsonrpc": "2.0",
        "id": "1",
        "result": {
            "content": [{"type": "text", "text": json.dumps(payload)}],
        },
    })

    assert parsed.roundId == payload["roundId"]
    assert parsed.contractVersion == payload["contractVersion"]
