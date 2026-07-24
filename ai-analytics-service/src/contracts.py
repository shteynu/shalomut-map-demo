import json
from pathlib import Path
from typing import Dict, Tuple

_CONTRACT_PATH = (
    Path(__file__).resolve().parents[2]
    / "contracts"
    / "ai-analytics-v1.json"
)

with _CONTRACT_PATH.open("r", encoding="utf-8") as contract_file:
    _CONTRACT = json.load(contract_file)

AI_ANALYTICS_CONTRACT_VERSION: str = _CONTRACT["version"]
AI_ANALYTICS_DIMENSION_IDS: Tuple[str, ...] = tuple(
    dimension["id"] for dimension in _CONTRACT["dimensions"]
)
AI_ANALYTICS_DIMENSION_NAMES_HEBREW: Dict[str, str] = {
    dimension["id"]: dimension["nameHebrew"]
    for dimension in _CONTRACT["dimensions"]
}
