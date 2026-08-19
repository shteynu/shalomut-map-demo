import hashlib
import json
import re

import pytest

from src.agents.graph import analytics_graph
from src.contracts import (
    AI_ANALYTICS_DIMENSION_IDS,
    AI_ANALYTICS_DYNAMIC_CONTRACT_VERSIONS,
    AI_ANALYTICS_SUPPORTED_CONTRACT_VERSIONS,
    AI_ANALYTICS_V6_CONTRACT_VERSION,
)
from src.schemas.mcp_types import RoundAnalyticsResult
from src.rag.store import LocalInterventionVectorStore
from src.services.llm_provider import (
    MetricInsightsGeneration,
    OverallSummaryGeneration,
    StructuredSummaryGeneration,
    llm_provider_service,
)


BACKGROUND_CONTEXT = {
    "notes": "צוות חדש הצטרף לבית הספר השנה",
    "newStaffMembers": 3,
}
VISIBLE_NUMBER_PATTERN = re.compile(r"[0-9%٪]")


def narrative(seed):
    addition = (
        " הטקסט נשען על התמונה המצרפית, מסביר את משמעותה בזהירות ומציע "
        "בירור ארגוני שאפשר לבצע בלי לייחס סיבה או תשובה לאדם מסוים."
    )
    result = seed
    while len(result) < 300:
        result += addition
    return result[:500]


def _definition_hash(question_aggregates):
    projection = [
        {
            "questionId": aggregate["questionId"],
            "dimensionId": aggregate["dimensionId"],
            "questionText": aggregate["questionText"],
        }
        for aggregate in sorted(
            question_aggregates.values(),
            key=lambda aggregate: aggregate["questionId"],
        )
    ]
    serialized = json.dumps(
        projection,
        ensure_ascii=False,
        separators=(",", ":"),
    ).encode("utf-8")
    return f"sha256:{hashlib.sha256(serialized).hexdigest()}"


def build_v6_input_payload(**overrides):
    question_aggregates = {
        f"q-{index + 1}": {
            "questionId": f"q-{index + 1}",
            "dimensionId": dimension_id,
            "questionText": "עד כמה ההיגד משקף את מצב הצוות?",
            "averageScore": 60.0,
            "responseCount": 20,
            "scoreDistribution": {"green": 4, "yellow": 12, "red": 4},
        }
        for index, dimension_id in enumerate(AI_ANALYTICS_DIMENSION_IDS)
    }
    payload = {
        "contractVersion": "6.0",
        "roundId": "round-v6-python",
        "organizationId": "org-v6",
        "calculatedAt": "2026-08-02T12:00:00Z",
        "surveyDefinitionHash": _definition_hash(question_aggregates),
        "totalResponses": 20,
        "privacyThreshold": 1,
        "isLocked": False,
        "dimensionScores": {
            dimension_id: {
                "dimensionId": dimension_id,
                "averageScore": 60.0,
                "computedStatus": "yellow",
                "responseCount": 20,
            }
            for dimension_id in AI_ANALYTICS_DIMENSION_IDS
        },
        "questionAggregates": question_aggregates,
        "backgroundContext": BACKGROUND_CONTEXT,
    }
    payload.update(overrides)
    return payload


def test_v6_is_a_real_supported_dynamic_contract():
    assert AI_ANALYTICS_V6_CONTRACT_VERSION == "6.0"
    assert "6.0" in AI_ANALYTICS_SUPPORTED_CONTRACT_VERSIONS
    assert "6.0" in AI_ANALYTICS_DYNAMIC_CONTRACT_VERSIONS


def test_v6_parser_preserves_distribution_and_background_context():
    parsed = RoundAnalyticsResult.from_dict(build_v6_input_payload())

    assert parsed.contractVersion == "6.0"
    assert parsed.backgroundContext == BACKGROUND_CONTEXT
    assert parsed.questionAggregates["q-1"]["scoreDistribution"] == {
        "green": 4,
        "yellow": 12,
        "red": 4,
    }


@pytest.mark.parametrize("forbidden_field", ["answers", "respondentId"])
def test_v6_parser_rejects_respondent_level_fields(forbidden_field):
    payload = build_v6_input_payload()
    payload[forbidden_field] = [] if forbidden_field == "answers" else "person"

    with pytest.raises(ValueError, match="forbids respondent-level"):
        RoundAnalyticsResult.from_dict(payload)


def test_v6_structured_summary_falls_back_to_three_grounded_paragraphs(
    monkeypatch,
):
    monkeypatch.setattr(
        llm_provider_service,
        "_complete_with_retries",
        lambda **_kwargs: (None, 2, "http_503"),
    )
    aggregate = build_v6_input_payload()["questionAggregates"]["q-4"]

    result = llm_provider_service.generate_structured_summary_result(
        dim_id="balance",
        dim_hebrew="איזון",
        status="yellow",
        question_aggregates=[aggregate],
        background_context=BACKGROUND_CONTEXT,
        contract_version="6.0",
    )

    assert result.outcome == "deterministic_fallback"
    assert result.attempts == 2
    assert len(result.paragraphs) == 3
    assert all(paragraph.endswith(".") for paragraph in result.paragraphs)
    assert all(not VISIBLE_NUMBER_PATTERN.search(paragraph) for paragraph in result.paragraphs)


def test_v6_structured_summary_accepts_exact_provider_json(monkeypatch):
    paragraphs = [
        "התמונה המצרפית מצביעה על תחום שראוי להמשיך לעקוב אחריו.",
        "הפיזור מלמד שהחוויה אינה אחידה ולכן אין להסתפק בממוצע בלבד.",
        "מומלץ לקיים בירור מוגן ולבחור מוקד ארגוני שאפשר לבחון שוב.",
    ]
    monkeypatch.setattr(
        llm_provider_service,
        "_complete_with_retries",
        lambda **_kwargs: (json.dumps(paragraphs, ensure_ascii=False), 1, ""),
    )

    result = llm_provider_service.generate_structured_summary_result(
        dim_id="balance",
        dim_hebrew="איזון",
        status="yellow",
        question_aggregates=[],
        contract_version="6.0",
    )

    assert result.outcome == "llm"
    assert result.paragraphs == tuple(paragraphs)


def test_v6_metric_batch_rejects_missing_ids_and_returns_complete_fallback(
    monkeypatch,
):
    aggregates = [
        {
            **aggregate,
            "questionId": f"balance-{index}",
            "questionText": text,
        }
        for index, (aggregate, text) in enumerate(
            [
                (
                    build_v6_input_payload()["questionAggregates"]["q-4"],
                    "העומס בעבודה מתאים לצוות.",
                ),
                (
                    build_v6_input_payload()["questionAggregates"]["q-4"],
                    "יש לצוות זמן להתאוששות.",
                ),
            ],
            start=1,
        )
    ]
    incomplete = json.dumps(
        [{"questionId": "balance-1", "insightText": "תיאור קצר."}],
        ensure_ascii=False,
    )
    monkeypatch.setattr(
        llm_provider_service,
        "_complete_with_retries",
        lambda **_kwargs: (incomplete, 1, "invalid_semantic_output"),
    )

    result = llm_provider_service.generate_metric_insights_result(
        dim_id="balance",
        dim_hebrew="איזון",
        status="yellow",
        question_aggregates=aggregates,
        background_context=BACKGROUND_CONTEXT,
        contract_version="6.0",
    )

    assert result.outcome == "deterministic_fallback"
    assert set(result.insights) == {"balance-1", "balance-2"}
    for insight in result.insights.values():
        assert 300 <= len(insight) <= 500
        assert not VISIBLE_NUMBER_PATTERN.search(insight)


def test_v6_metric_batch_accepts_exact_id_coverage(monkeypatch):
    aggregates = [
        {
            **build_v6_input_payload()["questionAggregates"]["q-4"],
            "questionId": question_id,
        }
        for question_id in ("balance-a", "balance-b")
    ]
    response = [
        {"questionId": aggregate["questionId"], "insightText": narrative("האות בנושא זה מעורב וראוי למעקב.")}
        for aggregate in aggregates
    ]
    monkeypatch.setattr(
        llm_provider_service,
        "_complete_with_retries",
        lambda **_kwargs: (json.dumps(response, ensure_ascii=False), 1, ""),
    )

    result = llm_provider_service.generate_metric_insights_result(
        dim_id="balance",
        dim_hebrew="איזון",
        status="yellow",
        question_aggregates=aggregates,
        contract_version="6.0",
    )

    assert result.outcome == "llm"
    assert set(result.insights) == {"balance-a", "balance-b"}


def test_v6_adaptation_rejects_reordered_ids_and_falls_back_as_one_batch(
    monkeypatch,
):
    store = LocalInterventionVectorStore()
    interventions = [
        {**item.to_dict(), "status": "yellow"}
        for item in store.get_interventions_for_dimension(
            "balance",
            "yellow",
            limit=5,
        )
    ]
    reordered = [
        {
            "id": item["id"],
            "summary": narrative("המלצה מעשית למעקב משותף."),
            "actionable_steps": item["actionable_steps"],
        }
        for item in reversed(interventions)
    ]
    monkeypatch.setattr(
        llm_provider_service,
        "_complete_with_retries",
        lambda **_kwargs: (json.dumps(reordered, ensure_ascii=False), 1, ""),
    )

    result = llm_provider_service.adapt_interventions_result(
        interventions=interventions,
        dim_hebrew="איזון",
        score=60.0,
        status="yellow",
        question_aggregates=[],
        contract_version="6.0",
    )

    assert len(result) == 5
    assert {item.outcome for item in result} == {"deterministic_fallback"}
    assert all(300 <= len(item.summary) <= 500 for item in result)


@pytest.mark.asyncio
async def test_v6_graph_fallback_produces_the_complete_contract(monkeypatch):
    monkeypatch.setattr(
        llm_provider_service,
        "_complete_with_retries",
        lambda **_kwargs: (None, 1, "http_503"),
    )
    round_data = RoundAnalyticsResult.from_dict(
        build_v6_input_payload(),
    ).to_dict()
    state = {
        "round_data": round_data,
        "org_context": {},
        "interpretations": {},
        "recommendations": {},
        "safety_status": "pending",
        "safety_feedback": None,
        "retry_count": 0,
        "final_payload": {},
    }

    result = await analytics_graph.ainvoke(state)
    payload = result["final_payload"]

    assert payload["status"] == "success", result.get("safety_feedback")
    assert payload["contractVersion"] == "6.0"
    assert set(payload["stones"]) == set(AI_ANALYTICS_DIMENSION_IDS)
    # The round-level sibling of every stone's own `outcome`: a silent
    # provider does not spare the opening sentence either.
    assert payload["overallSummaryOutcome"] == "deterministic_fallback"
    for dimension_id, stone in payload["stones"].items():
        assert "psychologicalInterpretation" not in stone, dimension_id
        assert len(stone["summary"]) == 3, dimension_id
        assert len(stone["metrics"]) == 1, dimension_id
        assert len(stone["recommendedInterventions"]) == 5, dimension_id
        assert 300 <= len(stone["metrics"][0]["insightText"]) <= 500
        for intervention in stone["recommendedInterventions"]:
            assert 300 <= len(intervention["summary"]) <= 500
            assert intervention["adaptationOutcome"] == "deterministic_fallback"


@pytest.mark.asyncio
async def test_locked_v6_short_circuits_every_provider_path(monkeypatch):
    payload = build_v6_input_payload(
        totalResponses=5,
        privacyThreshold=10,
        isLocked=True,
        dimensionScores={},
        questionAggregates={},
    )
    payload["surveyDefinitionHash"] = "sha256:" + "0" * 64
    parsed = RoundAnalyticsResult.from_dict(payload)

    def fail_if_called(*_args, **_kwargs):
        raise AssertionError("provider must not run for locked V6 input")

    for method in (
        "generate_structured_summary_result",
        "generate_metric_insights_result",
        "generate_overall_summary",
        "adapt_interventions_result",
    ):
        monkeypatch.setattr(llm_provider_service, method, fail_if_called)

    result = await analytics_graph.ainvoke(
        {
            "round_data": parsed.to_dict(),
            "org_context": {},
            "interpretations": {},
            "recommendations": {},
            "safety_status": "pending",
            "safety_feedback": None,
            "retry_count": 0,
            "final_payload": {},
        },
    )

    assert result["final_payload"]["status"] == "locked_error"
    assert "stones" not in result["final_payload"]


def _v6_state(round_data):
    return {
        "round_data": round_data,
        "org_context": {},
        "interpretations": {},
        "recommendations": {},
        "safety_status": "pending",
        "safety_feedback": None,
        "retry_count": 0,
        "final_payload": {},
    }


def _refuse_dimension_summary(monkeypatch, refused):
    """Make one dimension's overview copy something the validator never takes.

    Everything else answers with the ordinary deterministic fallback, so the
    round is a real round with one dimension the repair budget cannot save.
    """
    monkeypatch.setattr(
        llm_provider_service,
        "_complete_with_retries",
        lambda **_kwargs: (None, 1, "http_503"),
    )
    real = llm_provider_service.generate_structured_summary_result

    def summary(*, dim_id, **kwargs):
        if dim_id in refused:
            return StructuredSummaryGeneration(("x", "y", "z"), "llm", 1)
        return real(dim_id=dim_id, **kwargs)

    monkeypatch.setattr(
        llm_provider_service,
        "generate_structured_summary_result",
        summary,
    )


@pytest.mark.asyncio
async def test_v6_reports_a_dimension_it_could_not_write_as_a_stated_gap(
    monkeypatch,
):
    # Before partial maps returned to 6.0 this round was thrown away whole:
    # one dimension whose copy the validator kept refusing cost the manager
    # the seven that were fine.
    _refuse_dimension_summary(monkeypatch, {"balance"})
    round_data = RoundAnalyticsResult.from_dict(build_v6_input_payload()).to_dict()

    result = await analytics_graph.ainvoke(_v6_state(round_data))
    payload = result["final_payload"]

    assert payload["status"] == "success", result.get("safety_feedback")
    assert payload["dimensionsWithoutInterpretation"] == ["balance"]

    gap = payload["stones"]["balance"]
    assert gap["summary"] == []
    assert gap["generationProvenance"]["outcome"] == "unavailable"
    # Not the provider's fault, and the screens say so: something was written
    # for this dimension and this service refused it.
    assert (
        gap["generationProvenance"]["unavailableReason"] == "validation_rejected"
    )
    # The gap is the overview and nothing else: the score, the reading of each
    # question and the recommendations are all still there.
    assert gap["score"] > 0
    assert len(gap["recommendedInterventions"]) == 5
    assert 300 <= len(gap["metrics"][0]["insightText"]) <= 500

    for dimension_id, stone in payload["stones"].items():
        if dimension_id == "balance":
            continue
        assert len(stone["summary"]) == 3, dimension_id
        assert stone["generationProvenance"]["outcome"] != "unavailable"


@pytest.mark.asyncio
async def test_v6_still_fails_whole_when_no_dimension_can_be_written(
    monkeypatch,
):
    # Eight gaps is not a partial map. Core refuses one and it is right to:
    # a map with nothing written is a failed round wearing a map's shape.
    _refuse_dimension_summary(monkeypatch, set(AI_ANALYTICS_DIMENSION_IDS))
    round_data = RoundAnalyticsResult.from_dict(build_v6_input_payload()).to_dict()

    result = await analytics_graph.ainvoke(_v6_state(round_data))

    assert result["final_payload"]["status"] == "validation_failed"


@pytest.mark.asyncio
async def test_v6_records_who_wrote_the_metric_narratives(monkeypatch):
    # A silent provider on 6.0 does not fail a dimension: the summary and the
    # narratives both fall back and the round is reported a success. Until the
    # narratives carried their own outcome, the payload said that about the
    # three paragraphs and nothing about the sentence under every question.
    monkeypatch.setattr(
        llm_provider_service,
        "_complete_with_retries",
        lambda **_kwargs: (None, 1, "http_503"),
    )
    round_data = RoundAnalyticsResult.from_dict(build_v6_input_payload()).to_dict()

    result = await analytics_graph.ainvoke(_v6_state(round_data))
    payload = result["final_payload"]

    assert payload["status"] == "success", result.get("safety_feedback")
    for dimension_id, stone in payload["stones"].items():
        provenance = stone["generationProvenance"]
        assert provenance["outcome"] == "deterministic_fallback", dimension_id
        assert (
            provenance["metricInsightsOutcome"] == "deterministic_fallback"
        ), dimension_id


@pytest.mark.asyncio
async def test_v6_metric_narratives_and_summary_are_labelled_separately(
    monkeypatch,
):
    # The mixture the single outcome could not express. Here the summary falls
    # back and the narratives are the model's; on a rate-limited key the same
    # split happens the other way, and a manager reading a real interpretation
    # has no reason to suspect the readings underneath it.
    monkeypatch.setattr(
        llm_provider_service,
        "_complete_with_retries",
        lambda **_kwargs: (None, 1, "http_503"),
    )
    real_metrics = llm_provider_service.generate_metric_insights_result

    def as_model_written(**kwargs):
        generated = real_metrics(**kwargs)
        return MetricInsightsGeneration(generated.insights, "llm", 1)

    monkeypatch.setattr(
        llm_provider_service,
        "generate_metric_insights_result",
        as_model_written,
    )
    round_data = RoundAnalyticsResult.from_dict(build_v6_input_payload()).to_dict()

    result = await analytics_graph.ainvoke(_v6_state(round_data))
    payload = result["final_payload"]

    assert payload["status"] == "success", result.get("safety_feedback")
    for dimension_id, stone in payload["stones"].items():
        provenance = stone["generationProvenance"]
        assert provenance["outcome"] == "deterministic_fallback", dimension_id
        assert provenance["metricInsightsOutcome"] == "llm", dimension_id


@pytest.mark.asyncio
async def test_v6_overall_summary_is_labelled_independently_of_the_dimensions(
    monkeypatch,
):
    # The mixture the round-level field exists to express: every dimension
    # falls back, and the opening sentence is the model's anyway, because the
    # two are separate calls. A manager reading a real summary has no reason to
    # suspect the readings underneath it — the same principle ADR-007 already
    # states for the metric narratives, one level up.
    monkeypatch.setattr(
        llm_provider_service,
        "_complete_with_retries",
        lambda **_kwargs: (None, 1, "http_503"),
    )
    real_summary = llm_provider_service.generate_overall_summary

    def as_model_written(**kwargs):
        generated = real_summary(**kwargs)
        return OverallSummaryGeneration(generated.text, "llm", 1)

    monkeypatch.setattr(
        llm_provider_service,
        "generate_overall_summary",
        as_model_written,
    )
    round_data = RoundAnalyticsResult.from_dict(build_v6_input_payload()).to_dict()

    result = await analytics_graph.ainvoke(_v6_state(round_data))
    payload = result["final_payload"]

    assert payload["status"] == "success", result.get("safety_feedback")
    assert payload["overallSummaryOutcome"] == "llm"
    for dimension_id, stone in payload["stones"].items():
        assert (
            stone["generationProvenance"]["outcome"] == "deterministic_fallback"
        ), dimension_id


@pytest.mark.asyncio
async def test_v6_gap_still_says_who_wrote_its_metric_narratives(monkeypatch):
    # A dimension can lose its overview and keep the reading of every question,
    # so the gap is the one place the two provenances must not collapse into
    # each other: `unavailable` is the summary's, and the narratives are still
    # somebody's.
    _refuse_dimension_summary(monkeypatch, {"balance"})
    round_data = RoundAnalyticsResult.from_dict(build_v6_input_payload()).to_dict()

    result = await analytics_graph.ainvoke(_v6_state(round_data))
    gap = result["final_payload"]["stones"]["balance"]

    assert gap["generationProvenance"]["outcome"] == "unavailable"
    assert (
        gap["generationProvenance"]["metricInsightsOutcome"]
        == "deterministic_fallback"
    )
    assert 300 <= len(gap["metrics"][0]["insightText"]) <= 500
