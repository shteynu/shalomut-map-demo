from dataclasses import dataclass, asdict
from typing import Literal, Optional, Dict, Any

@dataclass
class WebhookEventPayload:
    event: Literal["round_closed", "analytics_requested"]
    roundId: str
    callbackUrl: Optional[str] = None
    timestamp: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "WebhookEventPayload":
        return cls(
            event=data.get("event", "round_closed"),
            roundId=data.get("roundId", ""),
            callbackUrl=data.get("callbackUrl"),
            timestamp=data.get("timestamp")
        )
