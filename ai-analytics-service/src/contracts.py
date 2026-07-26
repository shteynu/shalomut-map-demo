import json
from pathlib import Path
from typing import Dict, Tuple

_CONTRACTS_ROOT = Path(__file__).resolve().parents[2] / "contracts"


def _load_contract(filename: str) -> dict:
    with (_CONTRACTS_ROOT / filename).open(
        "r",
        encoding="utf-8",
    ) as contract_file:
        return json.load(contract_file)


_LEGACY_CONTRACT = _load_contract("ai-analytics-v1.json")
_CONTRACT = _load_contract("ai-analytics-v2.json")
_DYNAMIC_CONTRACT = _load_contract("ai-analytics-v3.json")

AI_ANALYTICS_V1_CONTRACT_VERSION: str = _LEGACY_CONTRACT["version"]
AI_ANALYTICS_CONTRACT_VERSION: str = _CONTRACT["version"]
AI_ANALYTICS_DYNAMIC_CONTRACT_VERSION: str = _DYNAMIC_CONTRACT["version"]
AI_ANALYTICS_SUPPORTED_CONTRACT_VERSIONS: Tuple[str, ...] = (
    AI_ANALYTICS_V1_CONTRACT_VERSION,
    AI_ANALYTICS_CONTRACT_VERSION,
    AI_ANALYTICS_DYNAMIC_CONTRACT_VERSION,
)
AI_ANALYTICS_DIMENSION_IDS: Tuple[str, ...] = tuple(
    dimension["id"] for dimension in _CONTRACT["dimensions"]
)
AI_ANALYTICS_DIMENSION_NAMES_HEBREW: Dict[str, str] = {
    dimension["id"]: dimension["nameHebrew"]
    for dimension in _CONTRACT["dimensions"]
}
AI_ANALYTICS_QUESTIONS: Tuple[dict, ...] = tuple(
    {
        "id": question["id"],
        "dimensionId": dimension["id"],
        "textHebrew": question["textHebrew"],
    }
    for dimension in _CONTRACT["dimensions"]
    for question in dimension["questions"]
)
AI_ANALYTICS_QUESTION_IDS: Tuple[str, ...] = tuple(
    question["id"] for question in AI_ANALYTICS_QUESTIONS
)
AI_ANALYTICS_QUESTIONS_BY_ID: Dict[str, dict] = {
    question["id"]: question for question in AI_ANALYTICS_QUESTIONS
}

if tuple(
    dimension["id"] for dimension in _LEGACY_CONTRACT["dimensions"]
) != AI_ANALYTICS_DIMENSION_IDS:
    raise RuntimeError("AI contract 2.0 must preserve the canonical dimensions")

if tuple(
    dimension["id"] for dimension in _DYNAMIC_CONTRACT["dimensions"]
) != AI_ANALYTICS_DIMENSION_IDS:
    raise RuntimeError("AI contract 3.0 must preserve the canonical dimensions")

if len(AI_ANALYTICS_QUESTION_IDS) != 24 or len(
    set(AI_ANALYTICS_QUESTION_IDS)
) != 24:
    raise RuntimeError("AI contract 2.0 must define 24 unique questions")
