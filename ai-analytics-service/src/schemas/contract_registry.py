import json
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, Literal

@dataclass
class ContractCapabilities:
    isSemanticContract: bool
    supportsDynamicQuestions: bool
    supportsBackgroundContext: bool
    supportsScoreDistribution: bool
    supportsPartialMaps: bool
    supportsAdaptationOutcome: bool
    hasOverallSummarySentenceLimit: bool
    stoneInterpretationSentenceLimit: Literal["2", "2-5"]


def _load_registry() -> Dict[str, ContractCapabilities]:
    # Walk up from src/schemas to project root, then down to contracts
    current_dir = Path(__file__).resolve().parent
    # current_dir is ai-analytics-service/src/schemas
    # project root is ai-analytics-service/..
    project_root = current_dir.parent.parent.parent
    capabilities_path = project_root / "contracts" / "capabilities.json"
    
    with capabilities_path.open("r", encoding="utf-8") as f:
        data = json.load(f)
        
    registry = {}
    for version, caps in data.get("versions", {}).items():
        registry[version] = ContractCapabilities(**caps)
    return registry


CONTRACT_REGISTRY = _load_registry()


def get_capabilities(version: str) -> ContractCapabilities:
    if version not in CONTRACT_REGISTRY:
        raise ValueError(f"Unknown contract version '{version}'")
    return CONTRACT_REGISTRY[version]
