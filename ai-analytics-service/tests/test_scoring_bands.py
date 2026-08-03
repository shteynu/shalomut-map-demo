import json
from pathlib import Path

import pytest

from src.schemas.mcp_types import status_for_score as mcp_status_for_score
from src.schemas.scoring_bands import (
    SCORING_BANDS,
    ScoreBand,
    load_scoring_bands,
    status_for_score,
)
from src.schemas.stone_map_validation import status_for_score as validation_status_for_score

MANIFEST_PATH = (
    Path(__file__).resolve().parent.parent.parent / "contracts" / "scoring-bands.json"
)

VALID_BANDS = [
    {"status": "green", "min": 75, "max": 100},
    {"status": "yellow", "min": 50, "max": 74},
    {"status": "red", "min": 0, "max": 49},
]


def manifest_with(bands):
    return {"bands": bands}


def test_service_reads_the_shared_manifest():
    with MANIFEST_PATH.open("r", encoding="utf-8") as manifest_file:
        manifest = json.load(manifest_file)

    assert SCORING_BANDS == load_scoring_bands(manifest)
    assert SCORING_BANDS[0] == ScoreBand(status="green", min=75, max=100)


def test_status_for_score_returns_the_band_each_score_falls_in():
    assert status_for_score(100) == "green"
    assert status_for_score(75) == "green"
    assert status_for_score(74) == "yellow"
    assert status_for_score(50) == "yellow"
    assert status_for_score(49) == "red"
    assert status_for_score(0) == "red"


def test_a_score_outside_the_scale_takes_the_nearest_band():
    assert status_for_score(120) == "green"
    assert status_for_score(-5) == "red"


def test_input_parsing_and_payload_validation_share_one_source():
    # Both used to hold their own copy of the bands.
    assert mcp_status_for_score is status_for_score
    assert validation_status_for_score is status_for_score


def test_a_manifest_that_is_not_three_ordered_bands_is_refused():
    with pytest.raises(ValueError, match="must be an object"):
        load_scoring_bands(None)
    with pytest.raises(ValueError, match="must define 3 bands"):
        load_scoring_bands({})
    with pytest.raises(ValueError, match="must define 3 bands"):
        load_scoring_bands(manifest_with(VALID_BANDS[:2]))
    with pytest.raises(ValueError, match="must have status 'green'"):
        load_scoring_bands(manifest_with(list(reversed(VALID_BANDS))))


def test_a_band_with_non_integer_or_inverted_bounds_is_refused():
    with pytest.raises(ValueError, match="needs integer min and max"):
        load_scoring_bands(
            manifest_with(
                [{"status": "green", "min": 74.5, "max": 100}, *VALID_BANDS[1:]],
            ),
        )
    with pytest.raises(ValueError, match="needs integer min and max"):
        load_scoring_bands(
            manifest_with(
                [{"status": "green", "min": True, "max": 100}, *VALID_BANDS[1:]],
            ),
        )
    with pytest.raises(ValueError, match="has min above max"):
        load_scoring_bands(
            manifest_with(
                [
                    VALID_BANDS[0],
                    {"status": "yellow", "min": 74, "max": 50},
                    VALID_BANDS[2],
                ],
            ),
        )


def test_bands_that_leave_a_gap_overlap_or_miss_an_end_are_refused():
    with pytest.raises(ValueError, match="must be adjacent"):
        load_scoring_bands(
            manifest_with(
                [
                    VALID_BANDS[0],
                    {"status": "yellow", "min": 51, "max": 73},
                    VALID_BANDS[2],
                ],
            ),
        )
    with pytest.raises(ValueError, match="must be adjacent"):
        load_scoring_bands(
            manifest_with(
                [
                    VALID_BANDS[0],
                    {"status": "yellow", "min": 50, "max": 80},
                    VALID_BANDS[2],
                ],
            ),
        )
    with pytest.raises(ValueError, match="must reach 100"):
        load_scoring_bands(
            manifest_with(
                [{"status": "green", "min": 75, "max": 99}, *VALID_BANDS[1:]],
            ),
        )
    with pytest.raises(ValueError, match="must start at 0"):
        load_scoring_bands(
            manifest_with(
                [*VALID_BANDS[:2], {"status": "red", "min": 1, "max": 49}],
            ),
        )
