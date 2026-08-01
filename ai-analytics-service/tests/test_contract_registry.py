import json
from pathlib import Path

from src.schemas.contract_registry import load_contract_registry


def test_dummy_six_contract_is_a_test_only_registry_extension():
    manifest_path = (
        Path(__file__).resolve().parents[2] / "contracts" / "capabilities.json"
    )
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    assert "6.0" not in manifest["versions"]

    manifest["versions"]["6.0"] = {
        **manifest["versions"]["5.0"],
        "supportsBackgroundContext": False,
    }
    registry = load_contract_registry(manifest)

    assert registry["6.0"].supportsDynamicQuestions is True
    assert registry["6.0"].supportsBackgroundContext is False
