import json
from pathlib import Path

from src.schemas.contract_registry import load_contract_registry
from src.schemas.contract_registry import CONTRACT_REGISTRY
from src.contracts import AI_ANALYTICS_SUPPORTED_CONTRACT_VERSIONS


def test_python_support_matches_the_shared_capability_manifest():
    assert set(AI_ANALYTICS_SUPPORTED_CONTRACT_VERSIONS).issubset(CONTRACT_REGISTRY)
    assert "6.0" in CONTRACT_REGISTRY
    assert "6.0" in AI_ANALYTICS_SUPPORTED_CONTRACT_VERSIONS


def test_published_six_contract_exposes_narrative_capabilities():
    manifest_path = (
        Path(__file__).resolve().parents[2] / "contracts" / "capabilities.json"
    )
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    assert "6.0" in manifest["versions"]
    registry = load_contract_registry(manifest)

    assert registry["6.0"].supportsDynamicQuestions is True
    assert registry["6.0"].usesStructuredDimensionSummary is True
    assert registry["6.0"].usesNarrativeMetrics is True
    assert registry["6.0"].carriesAnswerScale is False


def test_published_seven_contract_carries_the_answer_scale_and_no_metric_narrative():
    manifest_path = (
        Path(__file__).resolve().parents[2] / "contracts" / "capabilities.json"
    )
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    assert "7.0" in manifest["versions"]
    registry = load_contract_registry(manifest)

    assert "7.0" in AI_ANALYTICS_SUPPORTED_CONTRACT_VERSIONS
    assert registry["7.0"].usesStructuredDimensionSummary is True
    assert registry["7.0"].usesNarrativeMetrics is False
    assert registry["7.0"].carriesAnswerScale is True
    # Every version before it answers on one scale and says so by omission.
    assert all(
        registry[version].carriesAnswerScale is False
        for version in registry
        if version != "7.0"
    )
