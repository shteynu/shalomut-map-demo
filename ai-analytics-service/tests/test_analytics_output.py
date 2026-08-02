"""One finished analysis, encoded for several contract versions.

The output adapter is the only place that decides what a version carries. These
tests hold that decision to one canonical result: the same stones, the same
copy, the same numbers, encoded three ways. What changes between them is the
wire; what never changes is what the run found.
"""

import pytest

from src.contracts import AI_ANALYTICS_DIMENSION_IDS
from src.schemas.analytics_output import (
    encode_failure,
    encode_locked,
    encode_stone_map,
)
from src.schemas.canonical import (
    CanonicalAnalysisInput,
    CanonicalAnalysisResult,
    CanonicalMetric,
    CanonicalStone,
)

SURVEY_DEFINITION_HASH = f"sha256:{'a' * 64}"


def _stone(dimension_id: str, *, outcome: str = "llm") -> CanonicalStone:
    return CanonicalStone(
        dimension_id=dimension_id,
        dimension_name_hebrew="מימד",
        status="green",
        score=80.0,
        interpretation="פרשנות אחת. פרשנות שנייה.",
        summary=["פסקה ראשונה.", "פסקה שנייה.", "פסקה שלישית."],
        recommended_interventions=[],
        metrics=[
            CanonicalMetric(
                question_id=f"q-{dimension_id}",
                label="שאלה",
                value="80.0 מתוך 100",
                average_score=80.0,
                response_count=10,
                score_distribution={"green": 8, "yellow": 1, "red": 1},
                insight_text="תובנה קצרה.",
            ),
        ],
        generation_provenance={
            "outcome": outcome,
            "attempts": 1,
            "retryCount": 0,
            "sourceQuestionIds": [f"q-{dimension_id}"],
        },
    )


def _result(**overrides) -> CanonicalAnalysisResult:
    stones = overrides.pop(
        "stones",
        {
            dimension_id: _stone(dimension_id)
            for dimension_id in AI_ANALYTICS_DIMENSION_IDS
        },
    )
    return CanonicalAnalysisResult(
        round_id="round_output_1",
        survey_definition_hash=SURVEY_DEFINITION_HASH,
        overall_summary="סיכום ראשון. סיכום שני.",
        stones=stones,
        **overrides,
    )


def test_a_dimension_travels_as_one_interpretation_or_as_paragraphs():
    result = _result()

    v5_stone = encode_stone_map(result, "5.0")["stones"]["self-expression"]
    v6_stone = encode_stone_map(result, "6.0")["stones"]["self-expression"]

    assert v5_stone["psychologicalInterpretation"] == (
        "פרשנות אחת. פרשנות שנייה."
    )
    assert "summary" not in v5_stone
    assert v6_stone["summary"] == [
        "פסקה ראשונה.",
        "פסקה שנייה.",
        "פסקה שלישית.",
    ]
    assert "psychologicalInterpretation" not in v6_stone


def test_the_distribution_and_the_insight_belong_to_the_versions_that_carry_them():
    result = _result()

    v3_metric = encode_stone_map(result, "3.0")["stones"]["self-expression"][
        "metrics"
    ][0]
    v5_metric = encode_stone_map(result, "5.0")["stones"]["self-expression"][
        "metrics"
    ][0]
    v6_metric = encode_stone_map(result, "6.0")["stones"]["self-expression"][
        "metrics"
    ][0]

    assert "scoreDistribution" not in v3_metric
    assert "insightText" not in v3_metric
    assert v5_metric["scoreDistribution"] == {
        "green": 8,
        "yellow": 1,
        "red": 1,
    }
    assert "insightText" not in v5_metric
    assert v6_metric["insightText"] == "תובנה קצרה."

    # The measurement itself never depended on the version.
    for metric in (v3_metric, v5_metric, v6_metric):
        assert metric["averageScore"] == 80.0
        assert metric["responseCount"] == 10


def test_a_whole_map_never_names_dimensions_it_could_write():
    payload = encode_stone_map(_result(), "5.0")

    assert "dimensionsWithoutInterpretation" not in payload


def test_a_partial_map_names_exactly_the_dimensions_it_could_not_write():
    stones = {
        dimension_id: _stone(dimension_id)
        for dimension_id in AI_ANALYTICS_DIMENSION_IDS
    }
    stones["balance"] = _stone("balance", outcome="unavailable")

    payload = encode_stone_map(_result(stones=stones), "5.0")

    assert payload["dimensionsWithoutInterpretation"] == ["balance"]
    # The version that does not declare partial maps stays silent about them.
    assert "dimensionsWithoutInterpretation" not in encode_stone_map(
        _result(stones=stones),
        "6.0",
    )


def test_a_dynamic_version_refuses_a_map_that_is_not_eight_stones():
    stones = {"balance": _stone("balance")}

    with pytest.raises(ValueError, match="eight stones"):
        encode_stone_map(_result(stones=stones), "5.0")


def test_a_failure_carries_the_questionnaire_only_where_it_exists():
    analysis_input = CanonicalAnalysisInput(
        round_id="round_output_1",
        survey_definition_hash=SURVEY_DEFINITION_HASH,
        is_locked=False,
        dimension_scores={},
        question_aggregates=[],
    )

    dynamic = encode_failure(
        analysis_input,
        "5.0",
        failure_reason="provider_unavailable",
        error_message="שירות הניתוח אינו זמין כרגע.",
    )
    legacy = encode_failure(
        analysis_input,
        "2.0",
        failure_reason="provider_unavailable",
        error_message="שירות הניתוח אינו זמין כרגע.",
    )

    assert dynamic["surveyDefinitionHash"] == SURVEY_DEFINITION_HASH
    assert "surveyDefinitionHash" not in legacy
    assert dynamic["status"] == legacy["status"] == "validation_failed"
    assert dynamic["failureReason"] == "provider_unavailable"


def test_a_locked_round_says_only_that_it_is_locked():
    analysis_input = CanonicalAnalysisInput(
        round_id="round_output_1",
        survey_definition_hash=SURVEY_DEFINITION_HASH,
        is_locked=True,
        dimension_scores={},
        question_aggregates=[],
        background_context={"notes": "הערות בית הספר"},
    )

    payload = encode_locked(analysis_input, "5.0", privacy_threshold=10)

    assert payload["status"] == "locked_error"
    assert payload["isLocked"] is True
    assert "10" in payload["errorMessage"]
    # Nothing about the school, the dimensions or the questions crosses.
    assert set(payload) == {
        "contractVersion",
        "roundId",
        "surveyDefinitionHash",
        "isLocked",
        "status",
        "errorMessage",
    }
