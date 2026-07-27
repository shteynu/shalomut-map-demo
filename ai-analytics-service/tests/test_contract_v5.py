import unittest
import hashlib
import json
from src.contracts import (
    AI_ANALYTICS_V5_CONTRACT_VERSION,
    AI_ANALYTICS_SUPPORTED_CONTRACT_VERSIONS,
    AI_ANALYTICS_DYNAMIC_CONTRACT_VERSIONS,
)
from src.schemas.mcp_types import RoundAnalyticsResult


class TestContractV5(unittest.TestCase):
    def test_version_constants(self):
        self.assertEqual(AI_ANALYTICS_V5_CONTRACT_VERSION, "5.0")
        self.assertIn("5.0", AI_ANALYTICS_SUPPORTED_CONTRACT_VERSIONS)
        self.assertIn("5.0", AI_ANALYTICS_DYNAMIC_CONTRACT_VERSIONS)

    def test_parse_v5_payload_with_valid_distribution(self):
        dimensions = [
            "self-expression",
            "professional-competence",
            "social-resource",
            "balance",
            "management-support",
            "certainty",
            "organizational-climate",
            "meaning",
        ]
        question_aggregates = {}
        projection = []
        for i, dim in enumerate(dimensions):
            qid = f"q-{i+1}"
            q_item = {
                "questionId": qid,
                "dimensionId": dim,
                "questionText": "שאלה בעברית לתשובה",
                "averageScore": 70.0,
                "responseCount": 20,
                "scoreDistribution": {"green": 10, "yellow": 8, "red": 2},
            }
            question_aggregates[qid] = q_item
            projection.append({
                "questionId": qid,
                "dimensionId": dim,
                "questionText": "שאלה בעברית לתשובה",
            })

        serialized = json.dumps(projection, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
        hash_val = f"sha256:{hashlib.sha256(serialized).hexdigest()}"

        payload = {
            "contractVersion": "5.0",
            "roundId": "round-v5-python",
            "organizationId": "org-v5",
            "calculatedAt": "2026-07-27T12:00:00Z",
            "surveyDefinitionHash": hash_val,
            "totalResponses": 20,
            "privacyThreshold": 1,
            "isLocked": False,
            "dimensionScores": {
                dim: {
                    "dimensionId": dim,
                    "averageScore": 70.0,
                    "computedStatus": "yellow",
                    "responseCount": 20,
                }
                for dim in dimensions
            },
            "questionAggregates": question_aggregates,
        }

        res = RoundAnalyticsResult.from_dict(payload)
        self.assertEqual(res.contractVersion, "5.0")
        self.assertEqual(res.questionAggregates["q-1"]["scoreDistribution"], {"green": 10, "yellow": 8, "red": 2})

    def test_reject_v5_payload_with_invalid_sum(self):
        dimensions = [
            "self-expression",
            "professional-competence",
            "social-resource",
            "balance",
            "management-support",
            "certainty",
            "organizational-climate",
            "meaning",
        ]
        question_aggregates = {}
        for i, dim in enumerate(dimensions):
            qid = f"q-{i+1}"
            question_aggregates[qid] = {
                "questionId": qid,
                "dimensionId": dim,
                "questionText": "שאלה בעברית לתשובה",
                "averageScore": 70.0,
                "responseCount": 20,
                "scoreDistribution": {"green": 10, "yellow": 8, "red": 5}, # sum = 23 != 20
            }

        payload = {
            "contractVersion": "5.0",
            "roundId": "round-v5-python",
            "organizationId": "org-v5",
            "calculatedAt": "2026-07-27T12:00:00Z",
            "surveyDefinitionHash": "sha256:0000000000000000000000000000000000000000000000000000000000000000",
            "totalResponses": 20,
            "privacyThreshold": 1,
            "isLocked": False,
            "dimensionScores": {},
            "questionAggregates": question_aggregates,
        }

        with self.assertRaises(ValueError):
            RoundAnalyticsResult.from_dict(payload)


if __name__ == "__main__":
    unittest.main()
