import json
from pathlib import Path

import pytest
from src.schemas.mcp_types import RoundAnalyticsResult

def test_golden_corpus():
    corpus_path = (
        Path(__file__).resolve().parents[2]
        / "contracts"
        / "fixtures"
        / "golden_corpus.json"
    )
    with corpus_path.open("r", encoding="utf-8") as f:
        corpus = json.load(f)

    for version, cases in corpus.items():
        for pos_payload in cases["positive"]:
            try:
                parsed = RoundAnalyticsResult.from_dict(pos_payload)
                assert parsed.contractVersion == version
            except Exception as e:
                pytest.fail(f"Failed to parse positive payload for {version}: {e}")

        for neg_payload in cases["negative"]:
            with pytest.raises(Exception):
                RoundAnalyticsResult.from_dict(neg_payload)
