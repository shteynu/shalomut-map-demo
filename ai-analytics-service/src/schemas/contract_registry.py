import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, Literal

@dataclass
class ContractCapabilities:
    isSemanticContract: bool
    supportsDynamicQuestions: bool
    supportsBackgroundContext: bool
    supportsScoreDistribution: bool
    supportsPartialMaps: bool
    supportsAdaptationOutcome: bool
    usesStructuredDimensionSummary: bool
    usesNarrativeMetrics: bool
    hasOverallSummarySentenceLimit: bool
    stoneInterpretationSentenceLimit: Literal["2", "2-5"]


def load_contract_registry(data: Any) -> Dict[str, ContractCapabilities]:
    if not isinstance(data, dict) or not isinstance(data.get("versions"), dict):
        raise ValueError("Contract capabilities manifest must define versions")

    registry = {}
    for version, caps in data["versions"].items():
        if not isinstance(caps, dict):
            raise ValueError(f"Capabilities for {version} must be an object")
        try:
            registry[version] = ContractCapabilities(**caps)
        except TypeError as error:
            raise ValueError(f"Invalid capabilities for {version}: {error}") from error
    return registry


def _load_registry() -> Dict[str, ContractCapabilities]:
    # Walk up from src/schemas to project root, then down to contracts
    current_dir = Path(__file__).resolve().parent
    # current_dir is ai-analytics-service/src/schemas
    # project root is ai-analytics-service/..
    project_root = current_dir.parent.parent.parent
    capabilities_path = project_root / "contracts" / "capabilities.json"
    
    with capabilities_path.open("r", encoding="utf-8") as f:
        data = json.load(f)
        
    return load_contract_registry(data)


CONTRACT_REGISTRY = _load_registry()


def get_capabilities(version: str) -> ContractCapabilities:
    if version not in CONTRACT_REGISTRY:
        raise ValueError(f"Unknown contract version '{version}'")
    return CONTRACT_REGISTRY[version]
