"""Score bands, read from the manifest both runtimes share.

`status_for_score` used to exist twice here and three more times in Core, with
the cross-runtime corpus as the only thing that would notice a copy drifting.
All of them now come from `contracts/scoring-bands.json`, which Core reads
through `src/lib/scoring-bands.ts`.

The status alias lives here rather than in `mcp_types` so that the module every
runtime boundary depends on has no dependencies of its own; `mcp_types`
re-exports it, and its importers are unaffected.
"""

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any, List, Literal

DimensionStatus = Literal["green", "yellow", "red"]

_STATUS_ORDER: List[DimensionStatus] = ["green", "yellow", "red"]
_LOWEST_SCORE = 0
_HIGHEST_SCORE = 100


@dataclass(frozen=True)
class ScoreBand:
    status: DimensionStatus
    min: int
    max: int


def load_scoring_bands(data: Any) -> List[ScoreBand]:
    if not isinstance(data, dict):
        raise ValueError("Scoring bands manifest must be an object")
    raw_bands = data.get("bands")
    if not isinstance(raw_bands, list) or len(raw_bands) != len(_STATUS_ORDER):
        raise ValueError(
            f"Scoring bands manifest must define {len(_STATUS_ORDER)} bands",
        )

    bands: List[ScoreBand] = []
    for index, raw_band in enumerate(raw_bands):
        if not isinstance(raw_band, dict):
            raise ValueError(f"Scoring band {index} must be an object")
        expected_status = _STATUS_ORDER[index]
        if raw_band.get("status") != expected_status:
            raise ValueError(
                f"Scoring band {index} must have status '{expected_status}'",
            )
        minimum = raw_band.get("min")
        maximum = raw_band.get("max")
        # bool is an int in Python, and a band bound of True would otherwise
        # pass every check below and quietly behave as 1.
        if (
            not isinstance(minimum, int)
            or not isinstance(maximum, int)
            or isinstance(minimum, bool)
            or isinstance(maximum, bool)
        ):
            raise ValueError(
                f"Scoring band '{expected_status}' needs integer min and max",
            )
        if minimum > maximum:
            raise ValueError(
                f"Scoring band '{expected_status}' has min above max",
            )
        bands.append(ScoreBand(status=expected_status, min=minimum, max=maximum))

    # Descending order with no gap and no overlap, so every score has exactly
    # one colour whichever runtime asks.
    if bands[0].max != _HIGHEST_SCORE:
        raise ValueError(f"Scoring bands must reach {_HIGHEST_SCORE}")
    if bands[-1].min != _LOWEST_SCORE:
        raise ValueError(f"Scoring bands must start at {_LOWEST_SCORE}")
    for previous, current in zip(bands, bands[1:]):
        if current.max + 1 != previous.min:
            raise ValueError(
                f"Scoring bands '{previous.status}' and '{current.status}' "
                "must be adjacent",
            )

    return bands


def _load_bands() -> List[ScoreBand]:
    # Walk up from src/schemas to the repository root, then down to contracts,
    # the same way contract_registry.py finds capabilities.json.
    project_root = Path(__file__).resolve().parent.parent.parent.parent
    bands_path = project_root / "contracts" / "scoring-bands.json"

    with bands_path.open("r", encoding="utf-8") as bands_file:
        data = json.load(bands_file)

    return load_scoring_bands(data)


SCORING_BANDS: List[ScoreBand] = _load_bands()


def status_for_score(score: float) -> DimensionStatus:
    """Map a 0-100 score onto its band.

    A score outside that range cannot come from an aggregate, so it takes the
    nearest band rather than inventing a fourth status.
    """
    for band in SCORING_BANDS:
        if score >= band.min:
            return band.status
    return SCORING_BANDS[-1].status
