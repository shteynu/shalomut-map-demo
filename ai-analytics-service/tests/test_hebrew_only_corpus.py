import json
from pathlib import Path

from src.services.hebrew_validation import is_hebrew_only_copy

CORPUS_PATH = (
    Path(__file__).resolve().parents[2]
    / "contracts"
    / "fixtures"
    / "hebrew_text_corpus.json"
)


def _corpus() -> dict:
    with CORPUS_PATH.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def test_service_answers_every_shared_hebrew_only_case():
    """The other half of the pair in ``src/lib/__tests__/hebrew-only-corpus.test.ts``.

    Both runtimes judge model copy by the same rule, and only a shared corpus
    keeps the two implementations from drifting apart again: Python tightened
    this rule on 2026-07-30 and Core kept accepting every script but Latin
    until the corpus existed.
    """
    for case in _corpus()["cases"]:
        assert is_hebrew_only_copy(case["text"]) is case["isHebrewOnly"], (
            f"{case['id']}: {case['note']}"
        )
