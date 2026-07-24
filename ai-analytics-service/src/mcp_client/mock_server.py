from typing import Dict, Any
from src.schemas.mcp_types import RoundAnalyticsResult, RoundDimensionScore

class MockDataLayerMCPServer:
    """
    Mock Data Layer MCP Server for local isolated dev/testing of AI analytics.
    Exposes `get_round_analytics(roundId)`.
    """
    def __init__(self):
        # Sample rounds
        self._rounds_db: Dict[str, Dict[str, Any]] = {
            "round-unlocked-sample": {
                "roundId": "round-unlocked-sample",
                "totalResponses": 24,
                "privacyThreshold": 10,
                "isLocked": False,
                "dimensionScores": {
                    "workload_balance": {
                        "dimensionId": "workload_balance",
                        "averageScore": 42.5,
                        "computedStatus": "red"
                    },
                    "management_support": {
                        "dimensionId": "management_support",
                        "averageScore": 58.0,
                        "computedStatus": "yellow"
                    },
                    "peer_relationships": {
                        "dimensionId": "peer_relationships",
                        "averageScore": 84.0,
                        "computedStatus": "green"
                    },
                    "psychological_safety": {
                        "dimensionId": "psychological_safety",
                        "averageScore": 61.5,
                        "computedStatus": "yellow"
                    },
                    "professional_growth": {
                        "dimensionId": "professional_growth",
                        "averageScore": 77.0,
                        "computedStatus": "green"
                    },
                    "work_environment": {
                        "dimensionId": "work_environment",
                        "averageScore": 48.0,
                        "computedStatus": "red"
                    },
                    "sense_of_meaning": {
                        "dimensionId": "sense_of_meaning",
                        "averageScore": 88.5,
                        "computedStatus": "green"
                    },
                    "recognition_compensation": {
                        "dimensionId": "recognition_compensation",
                        "averageScore": 54.0,
                        "computedStatus": "yellow"
                    }
                },
                "organizationContext": {
                    "schoolType": "High School",
                    "staffCount": 45,
                    "district": "Central"
                }
            },
            "round-locked-sample": {
                "roundId": "round-locked-sample",
                "totalResponses": 4,
                "privacyThreshold": 10,
                "isLocked": True,
                "dimensionScores": {},
                "organizationContext": {
                    "schoolType": "Elementary School",
                    "staffCount": 20
                }
            }
        }

    def get_round_analytics(self, round_id: str) -> RoundAnalyticsResult:
        """
        MCP tool invocation simulation for `get_round_analytics(roundId)`
        """
        if round_id not in self._rounds_db:
            # Generate a default unlocked round for arbitrary IDs
            return RoundAnalyticsResult(
                roundId=round_id,
                totalResponses=18,
                privacyThreshold=10,
                isLocked=False,
                dimensionScores={
                    "workload_balance": RoundDimensionScore(
                        dimensionId="workload_balance", averageScore=45.0, computedStatus="red"
                    ),
                    "management_support": RoundDimensionScore(
                        dimensionId="management_support", averageScore=62.0, computedStatus="yellow"
                    ),
                    "peer_relationships": RoundDimensionScore(
                        dimensionId="peer_relationships", averageScore=81.0, computedStatus="green"
                    ),
                    "psychological_safety": RoundDimensionScore(
                        dimensionId="psychological_safety", averageScore=59.0, computedStatus="yellow"
                    ),
                    "professional_growth": RoundDimensionScore(
                        dimensionId="professional_growth", averageScore=75.0, computedStatus="green"
                    ),
                    "work_environment": RoundDimensionScore(
                        dimensionId="work_environment", averageScore=52.0, computedStatus="yellow"
                    ),
                    "sense_of_meaning": RoundDimensionScore(
                        dimensionId="sense_of_meaning", averageScore=85.0, computedStatus="green"
                    ),
                    "recognition_compensation": RoundDimensionScore(
                        dimensionId="recognition_compensation", averageScore=40.0, computedStatus="red"
                    )
                },
                organizationContext={"schoolType": "Comprehensive", "staffCount": 35}
            )

        data = self._rounds_db[round_id]
        scores_dict = {}
        for dim_id, s in data.get("dimensionScores", {}).items():
            scores_dict[dim_id] = RoundDimensionScore(**s)

        return RoundAnalyticsResult(
            roundId=data["roundId"],
            totalResponses=data["totalResponses"],
            privacyThreshold=data["privacyThreshold"],
            isLocked=data["isLocked"],
            dimensionScores=scores_dict,
            organizationContext=data.get("organizationContext", {})
        )

mock_mcp_server = MockDataLayerMCPServer()
