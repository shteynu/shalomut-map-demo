import json
import pytest
from src.schemas.mcp_types import RoundAnalyticsResult

def test_golden_corpus():
    with open("../contracts/fixtures/golden_corpus.json", "r") as f:
        corpus = json.load(f)

    for version, cases in corpus.items():
        if version not in ["4.0", "5.0"]:
            continue # We only test parsing of versions that are actively handled as dynamic payloads in Python

        for pos_payload in cases["positive"]:
            try:
                RoundAnalyticsResult.from_dict(pos_payload)
            except Exception as e:
                pytest.fail(f"Failed to parse positive payload for {version}: {e}")

        for neg_payload in cases["negative"]:
            with pytest.raises(Exception):
                RoundAnalyticsResult.from_dict(neg_payload)
