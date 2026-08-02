"""Delivery of a finished Stone Map to the Data Layer.

Lifted out of `AnalyticsRunnerService`, which had the HTTP call, the header
policy and the URL construction written into its own body. The run now knows
only that a payload belongs to a round; everything about how that reaches Core
lives here, behind the `ResultSink` port.
"""

import asyncio
import json
import logging
import urllib.request
from typing import Any, Dict, Optional
from urllib.parse import quote, urlsplit

from src.config import settings

logger = logging.getLogger(__name__)

CALLBACK_TIMEOUT_SECONDS = 5.0


def _url_origin(url: str):
    try:
        parsed = urlsplit(url)
        scheme = parsed.scheme.lower()
        if scheme not in {"http", "https"} or not parsed.hostname:
            return None
        port = parsed.port or (443 if scheme == "https" else 80)
        return scheme, parsed.hostname.lower().rstrip("."), port
    except ValueError:
        return None


class HttpResultSink:
    """Posts the payload to the configured Data Layer callback endpoint."""

    def callback_url(self, round_id: str) -> str:
        """The endpoint one round's result belongs to.

        The round id is escaped: it reaches this service from a job record, and
        a round whose id contains a slash must not be able to aim the callback
        at a different path.
        """
        callback_base = settings.data_layer_callback_url.rstrip("/")
        return f"{callback_base}/{quote(round_id, safe='')}/ai-insights/"

    async def deliver(
        self,
        round_id: str,
        payload: Dict[str, Any],
        *,
        run_id: Optional[str] = None,
        lease_token: Optional[str] = None,
    ) -> None:
        await self.post(
            self.callback_url(round_id),
            payload,
            run_id=run_id,
            lease_token=lease_token,
        )

    async def post(
        self,
        callback_url: str,
        payload: Dict[str, Any],
        *,
        run_id: Optional[str] = None,
        lease_token: Optional[str] = None,
    ) -> None:
        """Send one payload to one URL inside the configured Core origin."""
        callback_origin = _url_origin(callback_url)
        data_layer_origin = _url_origin(settings.data_layer_callback_url)
        if (
            callback_origin is None
            or data_layer_origin is None
            or callback_origin != data_layer_origin
        ):
            raise RuntimeError(
                "Refusing callback outside the configured Data Layer origin"
            )

        req_bytes = json.dumps(payload).encode("utf-8")
        headers = {"Content-Type": "application/json"}
        if run_id and lease_token:
            # Lease tokens are capabilities. Headers keep them out of proxy
            # and platform access-log URLs.
            headers["X-AI-Analysis-Run-Id"] = run_id
            headers["X-AI-Analysis-Lease-Token"] = lease_token
        if settings.ai_callback_secret:
            headers["Authorization"] = f"Bearer {settings.ai_callback_secret}"
        if settings.vercel_protection_bypass:
            headers["x-vercel-protection-bypass"] = (
                settings.vercel_protection_bypass
            )

        logger.info("[ResultSink] Posting final Stone Map payload")
        req = urllib.request.Request(
            callback_url,
            data=req_bytes,
            headers=headers,
            method="POST",
        )

        try:
            status = await asyncio.to_thread(self._post_callback, req)
            logger.info("[ResultSink] Callback response status: %s", status)
        except Exception as e:
            raise RuntimeError(
                f"Unable to deliver AI analytics callback: {e}"
            ) from e

    @staticmethod
    def _post_callback(req: urllib.request.Request) -> int:
        """Blocking delivery, executed in a worker thread so the event loop
        stays responsive while the Data Layer persists the Stone Map.
        """
        with urllib.request.urlopen(
            req,
            timeout=CALLBACK_TIMEOUT_SECONDS,
        ) as response:
            if response.status < 200 or response.status >= 300:
                raise RuntimeError(f"Callback returned HTTP {response.status}")
            return response.status
