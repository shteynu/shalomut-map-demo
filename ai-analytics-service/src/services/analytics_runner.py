import json
import logging
import urllib.request
from typing import Dict, Any, Optional
from src.mcp_client.client import mcp_client_manager
from src.agents.graph import analytics_graph
from src.agents.state import AnalyticsState
from src.config import settings

logger = logging.getLogger(__name__)

class AnalyticsRunnerService:
    async def process_round(self, round_id: str, callback_url: Optional[str] = None) -> Dict[str, Any]:
        """
        Executes the end-to-end AI analytics workflow:
        1. Fetch round data via MCP Client
        2. Run LangGraph Multi-Agent pipeline
        3. Deliver compiled Stone Map JSON payload back to Data Layer
        """
        logger.info(f"[AnalyticsRunner] Starting processing for round: {round_id}")

        # Step 1: Fetch data via MCP Client
        round_analytics = await mcp_client_manager.fetch_round_analytics(round_id)

        # Step 2: Initialize LangGraph State
        initial_state: AnalyticsState = {
            "round_data": round_analytics.model_dump() if hasattr(round_analytics, "model_dump") else round_analytics.to_dict(),
            "org_context": round_analytics.organizationContext or {},
            "interpretations": {},
            "recommendations": {},
            "safety_status": "pending",
            "safety_feedback": None,
            "retry_count": 0,
            "final_payload": {}
        }

        # Step 3: Execute StateGraph
        final_state = await analytics_graph.ainvoke(initial_state)
        final_payload = final_state.get("final_payload", {})

        # Step 4: Callback / Output delivery
        target_callback = callback_url or f"{settings.data_layer_callback_url}/{round_id}/ai-insights"
        await self._send_callback(target_callback, final_payload)

        return final_payload

    async def _send_callback(self, callback_url: str, payload: Dict[str, Any]):
        """
        Sends the compiled payload back to the Data Layer HTTP callback endpoint.
        """
        try:
            logger.info(f"[AnalyticsRunner] Posting final Stone Map payload to {callback_url}")
            req_bytes = json.dumps(payload).encode("utf-8")
            req = urllib.request.Request(
                callback_url,
                data=req_bytes,
                headers={"Content-Type": "application/json"},
                method="POST"
            )
            with urllib.request.urlopen(req, timeout=5.0) as response:
                logger.info(f"[AnalyticsRunner] Callback response status: {response.status}")
        except Exception as e:
            logger.warning(f"[AnalyticsRunner] Callback post failed (offline/demo mode): {e}")

analytics_runner_service = AnalyticsRunnerService()
