"""Would Core accept this Stone Map?

The service could not answer that question about its own output. Core's
`validateStoneMapResult` was the only judge, and it sits behind an HTTP
boundary: a payload it refuses ends the run as `contract_validation_failed`,
after every model call of the round has already been paid for and with no
retry left, because the safety loop finished long before.

Nothing in the pipeline calls this yet — the callback path is unchanged, and
wiring it in is a behaviour change that belongs to its own slice. What it does
today is give the shared callback corpus a judge on this side, so the two
runtimes can be held to the same verdict case by case instead of only Core
having an opinion.

This is deliberately not a second contract. Every rule below reads the shared
capability manifest and reuses the predicates the pipeline already validates
with.
"""

import re
from typing import Any, Dict, NamedTuple, Optional

from src.agents.safety_report import SafetyViolationTarget
from src.contracts import AI_ANALYTICS_DIMENSION_IDS
from src.schemas.contract_registry import CONTRACT_REGISTRY, get_capabilities
from src.schemas.scoring_bands import status_for_score
from src.services.hebrew_validation import (
    is_complete_hebrew_copy,
    is_hebrew_only_copy,
    is_v6_qualitative_narrative,
    sentences,
)


SURVEY_DEFINITION_HASH_PATTERN = re.compile(r"^sha256:[0-9a-f]{64}$")

OVERALL_SUMMARY_MIN_SENTENCES = 2
OVERALL_SUMMARY_MAX_SENTENCES = 4


def _has_overall_summary_sentence_count(text: str) -> bool:
    found = sentences(text)
    compact_found = re.sub(r"\s", "", "".join(found))
    compact_text = re.sub(r"\s", "", text.strip())
    return (
        OVERALL_SUMMARY_MIN_SENTENCES
        <= len(found)
        <= OVERALL_SUMMARY_MAX_SENTENCES
        and compact_found == compact_text
    )


def _three_hebrew_paragraphs(value: Any) -> bool:
    return (
        isinstance(value, list)
        and len(value) == 3
        and all(
            isinstance(paragraph, str)
            and paragraph.strip()
            and is_hebrew_only_copy(paragraph)
            and not re.search(r"[0-9%٪]", paragraph)
            and re.search(r"[.!?؟]$", paragraph.strip())
            for paragraph in value
        )
    )


def _refusal_for_stone(
    stone: Any,
    dimension_id: str,
    contract_version: str,
) -> Optional[str]:
    if not isinstance(stone, dict):
        return "stone_shape_invalid"

    caps = get_capabilities(contract_version)

    score = stone.get("score")
    status = stone.get("status")
    if not isinstance(score, (int, float)) or isinstance(score, bool):
        return "stone_shape_invalid"
    if status_for_score(float(score)) != status:
        return "status_inconsistent_with_score"

    if not caps.isSemanticContract:
        return None

    provenance = stone.get("generationProvenance")
    outcome = provenance.get("outcome") if isinstance(provenance, dict) else None

    if not has_valid_unavailable_reason(provenance):
        return "unavailable_reason_invalid"

    if caps.usesStructuredDimensionSummary:
        # A declared gap has no overview; `_refusal_for_gaps` below is what
        # checks it was declared. The metric narratives are still required —
        # the gap covers the three paragraphs about the dimension, not the
        # reading of each question in it.
        if outcome == "unavailable":
            if stone.get("summary") != []:
                return "unavailable_not_empty"
        elif not _three_hebrew_paragraphs(stone.get("summary")):
            return "v6_summary_shape"
        for metric in stone.get("metrics") or ():
            insight = metric.get("insightText") if isinstance(metric, dict) else None
            if not isinstance(insight, str) or not is_v6_qualitative_narrative(
                insight,
            ):
                return "v6_metric_insight_required"
        return None

    interpretation = stone.get("psychologicalInterpretation")
    if outcome == "unavailable":
        # An absent interpretation is a declared gap, not broken copy; the
        # payload-level rule below is what checks it was declared.
        return None if interpretation == "" else "unavailable_not_empty"

    if not isinstance(interpretation, str) or not is_hebrew_only_copy(
        interpretation,
    ):
        return "interpretation_not_hebrew_only"
    if not is_complete_hebrew_copy(interpretation, contract_version):
        return "interpretation_sentence_count"
    return None


def has_valid_unavailable_reason(provenance: Any) -> bool:
    """A reason belongs to an absence and to nothing else.

    Absent is always allowed: rounds analysed before the field existed carry
    no reason, and refusing them would refuse this product's own history.
    """
    if not isinstance(provenance, dict):
        return False
    reason = provenance.get("unavailableReason")
    if reason is None:
        return True
    return (
        provenance.get("outcome") == "unavailable"
        and reason in {"provider_unavailable", "validation_rejected"}
    )


def _refusal_for_gaps(payload: Dict[str, Any]) -> Optional[str]:
    stones = payload.get("stones") or {}
    actual = sorted(
        dimension_id
        for dimension_id in AI_ANALYTICS_DIMENSION_IDS
        if isinstance(stones.get(dimension_id), dict)
        and isinstance(stones[dimension_id].get("generationProvenance"), dict)
        and stones[dimension_id]["generationProvenance"].get("outcome")
        == "unavailable"
    )
    declared = payload.get("dimensionsWithoutInterpretation")

    if declared is None:
        return None if not actual else "interpretation_gap_undeclared"

    caps = get_capabilities(str(payload.get("contractVersion")))
    if not caps.supportsPartialMaps:
        return "interpretation_gap_undeclared"
    if not isinstance(declared, list) or sorted(declared) != actual:
        return "interpretation_gap_undeclared"
    if len(actual) == len(AI_ANALYTICS_DIMENSION_IDS):
        return "interpretation_gap_undeclared"
    return None


# Which refusals another attempt could plausibly fix, and what it would have to
# write again.
#
# The distinction is the whole point of checking here rather than only at the
# callback. A refused summary is copy a second attempt can rewrite. A missing
# `surveyDefinitionHash` arrived in the round data and no amount of regenerating
# will conjure one, so replaying it would spend a heavy-tier request to produce
# the identical refusal. Anything absent from this table fails the round
# immediately and says which rule did it.
_REPAIRABLE: Dict[str, SafetyViolationTarget] = {
    "summary_not_hebrew_only": "overall_summary",
    "summary_sentence_count": "overall_summary",
    "interpretation_not_hebrew_only": "interpretation",
    "interpretation_sentence_count": "interpretation",
    "v6_summary_shape": "interpretation",
    "v6_metric_insight_required": "interpretation",
}


class OutgoingRefusal(NamedTuple):
    """Why this payload would be refused, and who has to write again."""

    rule: str
    target: Optional[SafetyViolationTarget]
    dimension_id: Optional[str]

    @property
    def repairable(self) -> bool:
        return self.target is not None


def outgoing_refusal(payload: Any) -> Optional[OutgoingRefusal]:
    """`stone_map_refusal` plus what a replay would have to do about it."""
    rule = stone_map_refusal(payload)
    if rule is None:
        return None

    target = _REPAIRABLE.get(rule)
    dimension_id = None
    if target == "interpretation" and isinstance(payload, dict):
        dimension_id = _first_refused_dimension(payload, rule)
        if dimension_id is None:
            # The rule points at a stone and we cannot say which one, so a
            # targeted replay would rewrite nothing. Fail rather than loop.
            return OutgoingRefusal(rule, None, None)
    return OutgoingRefusal(rule, target, dimension_id)


def _first_refused_dimension(payload: Dict[str, Any], rule: str) -> Optional[str]:
    stones = payload.get("stones") or {}
    contract_version = str(payload.get("contractVersion"))
    for dimension_id in AI_ANALYTICS_DIMENSION_IDS:
        if dimension_id not in stones:
            continue
        if _refusal_for_stone(
            stones[dimension_id],
            dimension_id,
            contract_version,
        ) == rule:
            return dimension_id
    return None


def stone_map_refusal(payload: Any) -> Optional[str]:
    """The rule that refuses this payload, or ``None`` if Core would take it.

    A rule name rather than a sentence: this is read by the pipeline and by the
    shared corpus, and neither wants prose. The operator-facing message is
    still Core's, on the other side of the callback.
    """
    if not isinstance(payload, dict):
        return "payload_not_an_object"

    contract_version = payload.get("contractVersion")
    if not isinstance(contract_version, str) or contract_version not in CONTRACT_REGISTRY:
        return "unsupported_contract_version"

    caps = get_capabilities(contract_version)

    if caps.supportsDynamicQuestions:
        survey_hash = payload.get("surveyDefinitionHash")
        if not isinstance(survey_hash, str) or not SURVEY_DEFINITION_HASH_PATTERN.match(
            survey_hash,
        ):
            return "survey_definition_hash_required"

    if payload.get("status") != "success":
        # Only the success shape is described here. `locked_error` and
        # `validation_failed` carry no stones and no copy, so nothing below
        # applies to them.
        return None

    summary = payload.get("overallPsychologicalSummary")
    if not isinstance(summary, str) or not isinstance(payload.get("stones"), dict):
        return "payload_metadata_invalid"

    if caps.isSemanticContract and not is_hebrew_only_copy(summary):
        return "summary_not_hebrew_only"
    if caps.hasOverallSummarySentenceLimit and not _has_overall_summary_sentence_count(
        summary,
    ):
        return "summary_sentence_count"

    stones = payload["stones"]
    if sorted(stones.keys()) != sorted(AI_ANALYTICS_DIMENSION_IDS):
        return "dimension_set_incomplete"

    for dimension_id in AI_ANALYTICS_DIMENSION_IDS:
        refusal = _refusal_for_stone(
            stones[dimension_id],
            dimension_id,
            contract_version,
        )
        if refusal:
            return refusal

    return _refusal_for_gaps(payload)
