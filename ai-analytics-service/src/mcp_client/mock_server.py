from typing import Dict, Any
from src.schemas.mcp_types import RoundAnalyticsResult, RoundDimensionScore
from src.contracts import AI_ANALYTICS_DIMENSION_IDS

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
                    "self-expression": {
                        "dimensionId": "self-expression",
                        "averageScore": 61.5,
                        "computedStatus": "yellow"
                    },
                    "professional-competence": {
                        "dimensionId": "professional-competence",
                        "averageScore": 77.0,
                        "computedStatus": "green"
                    },
                    "social-resource": {
                        "dimensionId": "social-resource",
                        "averageScore": 84.0,
                        "computedStatus": "green"
                    },
                    "balance": {
                        "dimensionId": "balance",
                        "averageScore": 42.5,
                        "computedStatus": "red"
                    },
                    "management-support": {
                        "dimensionId": "management-support",
                        "averageScore": 58.0,
                        "computedStatus": "yellow"
                    },
                    "certainty": {
                        "dimensionId": "certainty",
                        "averageScore": 52.0,
                        "computedStatus": "yellow"
                    },
                    "organizational-climate": {
                        "dimensionId": "organizational-climate",
                        "averageScore": 48.0,
                        "computedStatus": "red"
                    },
                    "meaning": {
                        "dimensionId": "meaning",
                        "averageScore": 88.5,
                        "computedStatus": "green"
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
                    "self-expression": RoundDimensionScore(
                        dimensionId="self-expression", averageScore=61.0, computedStatus="yellow"
                    ),
                    "professional-competence": RoundDimensionScore(
                        dimensionId="professional-competence", averageScore=75.0, computedStatus="green"
                    ),
                    "social-resource": RoundDimensionScore(
                        dimensionId="social-resource", averageScore=81.0, computedStatus="green"
                    ),
                    "balance": RoundDimensionScore(
                        dimensionId="balance", averageScore=45.0, computedStatus="red"
                    ),
                    "management-support": RoundDimensionScore(
                        dimensionId="management-support", averageScore=62.0, computedStatus="yellow"
                    ),
                    "certainty": RoundDimensionScore(
                        dimensionId="certainty", averageScore=52.0, computedStatus="yellow"
                    ),
                    "organizational-climate": RoundDimensionScore(
                        dimensionId="organizational-climate", averageScore=48.0, computedStatus="red"
                    ),
                    "meaning": RoundDimensionScore(
                        dimensionId="meaning", averageScore=85.0, computedStatus="green"
                    )
                },
                organizationContext={"schoolType": "Comprehensive", "staffCount": 35}
            )

        data = self._rounds_db[round_id]
        scores_dict = {}
        for dim_id, s in data.get("dimensionScores", {}).items():
            scores_dict[dim_id] = RoundDimensionScore(**s)

        if data["isLocked"] and not scores_dict:
            scores_dict = {
                dimension_id: RoundDimensionScore(
                    dimensionId=dimension_id,
                    averageScore=0,
                    computedStatus="yellow",
                )
                for dimension_id in AI_ANALYTICS_DIMENSION_IDS
            }

        if set(scores_dict) != set(AI_ANALYTICS_DIMENSION_IDS):
            raise ValueError("Mock round does not match the canonical AI analytics dimensions.")

        return RoundAnalyticsResult(
            roundId=data["roundId"],
            totalResponses=data["totalResponses"],
            privacyThreshold=data["privacyThreshold"],
            isLocked=data["isLocked"],
            dimensionScores=scores_dict,
            organizationContext=data.get("organizationContext", {})
        )

mock_mcp_server = MockDataLayerMCPServer()
