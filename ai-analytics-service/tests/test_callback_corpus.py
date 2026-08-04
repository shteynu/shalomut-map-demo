"""The callback direction of the shared corpus, judged by this runtime.

The input direction has been shared since the registry landed; the callback
direction was not covered at all, which is how the Hebrew-only rule drifted
apart for three days without a single red test. Core runs the same file in
`src/lib/__tests__/callback-corpus-parity.test.ts`, and a case only counts as
shared when both runtimes reach the same verdict on it.
"""

import copy
import json
from pathlib import Path
from typing import Any, Dict

import pytest

from src.schemas.stone_map_validation import stone_map_refusal


CORPUS_PATH = (
    Path(__file__).resolve().parents[2]
    / "contracts"
    / "fixtures"
    / "callback_corpus.json"
)

with CORPUS_PATH.open("r", encoding="utf-8") as _handle:
    CORPUS = json.load(_handle)

# A version may have several accepted payloads - 6.0 has a whole map and a
# partial one - so the source a refused case mutates is named in the fixture
# rather than left to whichever entry happens to come last.
ACCEPTED_BY_VERSION = {
    case["contractVersion"]: case["payload"]
    for case in CORPUS["accepted"]
    if case.get("canonical")
}


def _parent_of(payload: Any, path: str):
    """Walk a dotted path, returning the container and the last key.

    Array indices are ordinary path segments; a segment that names a list is
    turned into an integer so `metrics.0.insightText` addresses what it reads
    like.
    """
    parts = path.split(".")
    cursor = payload
    for part in parts[:-1]:
        cursor = cursor[int(part)] if isinstance(cursor, list) else cursor[part]
    last = parts[-1]
    return cursor, (int(last) if isinstance(cursor, list) else last)


def apply_mutation(payload: Any, mutation: Dict[str, Any]) -> Any:
    """One accepted payload plus what breaks it.

    A refused case says what it is *about* rather than repeating forty
    kilobytes of valid Hebrew around the single field that matters.
    """
    next_payload = copy.deepcopy(payload)
    for path in mutation.get("delete", ()):
        parent, key = _parent_of(next_payload, path)
        del parent[key]
    for path, value in (mutation.get("set") or {}).items():
        parent, key = _parent_of(next_payload, path)
        parent[key] = value
    return next_payload


def _refused_payload(case: Dict[str, Any]) -> Any:
    source = ACCEPTED_BY_VERSION[case["from"]]
    payload = apply_mutation(source, case["mutation"])
    # A mutation that changed nothing would leave a valid payload behind and
    # quietly turn the case into a test of the accepted one.
    assert payload != source, f"{case['id']} changed nothing"
    return payload


@pytest.mark.parametrize(
    "case",
    CORPUS["accepted"],
    ids=[case["id"] for case in CORPUS["accepted"]],
)
def test_every_accepted_payload_is_accepted(case):
    refusal = stone_map_refusal(case["payload"])
    assert refusal is None, (
        f"{case['id']} is a payload Core accepts, and this runtime refused it "
        f"with '{refusal}'"
    )


@pytest.mark.parametrize(
    "case",
    CORPUS["refused"],
    ids=[case["id"] for case in CORPUS["refused"]],
)
def test_every_refused_payload_is_refused(case):
    refusal = stone_map_refusal(_refused_payload(case))
    assert refusal is not None, (
        f"{case['id']} is a payload Core refuses for {case['rule']}, and this "
        "runtime accepted it"
    )


@pytest.mark.parametrize(
    "case",
    CORPUS["refused"],
    ids=[case["id"] for case in CORPUS["refused"]],
)
def test_a_refusal_names_the_rule_the_corpus_names(case):
    """Same verdict is the contract; the same reason is what makes it useful.

    Two runtimes can agree that a payload is bad and disagree about why, and
    then a rule only one of them really implements looks covered. The corpus
    names the rule so that cannot hide.
    """
    assert stone_map_refusal(_refused_payload(case)) == case["rule"]


def test_the_corpus_covers_both_directions_of_the_boundary():
    """A corpus that quietly loses its callback half is the original defect."""
    assert len(CORPUS["accepted"]) >= 6
    assert len({case["contractVersion"] for case in CORPUS["accepted"]}) >= 6
    assert len(ACCEPTED_BY_VERSION) == len(
        {case["contractVersion"] for case in CORPUS["accepted"]}
    ), "every version needs exactly one canonical payload to mutate"
    assert len(CORPUS["refused"]) >= 10
    assert len({case["rule"] for case in CORPUS["refused"]}) >= 8
