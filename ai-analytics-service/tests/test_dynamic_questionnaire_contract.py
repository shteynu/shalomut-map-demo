import hashlib
import json
from unittest.mock import AsyncMock

import pytest

from src.agents.graph import analytics_graph
from src.config import settings
from src.contracts import (
    AI_ANALYTICS_DIMENSION_IDS,
    AI_ANALYTICS_DYNAMIC_CONTRACT_VERSION,
)
from src.mcp_client.client import mcp_client_manager
from src.schemas.mcp_types import RoundAnalyticsResult
from src.services.analytics_runner import analytics_runner_service
from src.services.llm_provider import llm_provider_service


DYNAMIC_CONTRACT_VERSION = AI_ANALYTICS_DYNAMIC_CONTRACT_VERSION


def definition_hash(questions):
    projection = [
        {
            "questionId": question["questionId"],
            "dimensionId": question["dimensionId"],
            "questionText": question["questionText"],
        }
        for question in sorted(
            questions,
            key=lambda question: question["questionId"],
        )
    ]
    serialized = json.dumps(
        projection,
        ensure_ascii=False,
        separators=(",", ":"),
    ).encode("utf-8")
    return f"sha256:{hashlib.sha256(serialized).hexdigest()}"


def refresh_definition_hash(payload):
    payload["surveyDefinitionHash"] = definition_hash(
        payload["questionAggregates"].values(),
    )
    return payload


def make_questionnaire(round_key: str, extra_balance_questions: int = 0):
    round_label = {
        "alpha": "אלפא",
        "beta": "בטא",
        "revised": "נוסח חדש",
        "privacy": "פרטיות",
        "identity": "זהות",
        "duplicate": "כפילות",
        "unsupported": "לא נתמך",
        "missing": "חסר",
        "hash": "גיבוב",
        "status": "סטטוס",
        "count": "ספירה",
        "metadata": "מטא־נתונים",
        "pipeline": "צינור מקומי",
        "prompt": "הנחיה",
        "locked": "נעול",
    }.get(round_key, "מותאם")
    questions = []
    for dimension_index, dimension_id in enumerate(
        AI_ANALYTICS_DIMENSION_IDS,
    ):
        questions.append(
            {
                "questionId": f"{round_key}-{dimension_id}-primary",
                "dimensionId": dimension_id,
                "questionText": (
                    f"שאלת שלומות מותאמת לממד "
                    f"{dimension_index + 1} בסבב {round_label}"
                ),
                "averageScore": 60,
                "responseCount": 12,
            },
        )

    for index in range(extra_balance_questions):
        questions.append(
            {
                "questionId": f"{round_key}-balance-supplemental-{index + 1}",
                "dimensionId": "balance",
                "questionText": (
                    f"שאלת איזון נוספת {index + 1} "
                    f"שנשמרה בסבב {round_label}"
                ),
                "averageScore": 60,
                "responseCount": 12,
            },
        )

    return questions


def make_payload(round_key: str, extra_balance_questions: int = 0):
    questions = make_questionnaire(round_key, extra_balance_questions)
    payload = {
        "contractVersion": DYNAMIC_CONTRACT_VERSION,
        "roundId": f"round-{round_key}",
        "organizationId": f"org-{round_key}",
        "surveyDefinitionHash": definition_hash(questions),
        "totalResponses": 12,
        "privacyThreshold": 10,
        "isLocked": False,
        "dimensionScores": {
            dimension_id: {
                "dimensionId": dimension_id,
                "averageScore": 60,
                "computedStatus": "yellow",
                "responseCount": 12,
            }
            for dimension_id in AI_ANALYTICS_DIMENSION_IDS
        },
        "questionAggregates": {
            question["questionId"]: question for question in questions
        },
        "calculatedAt": "2026-07-26T12:00:00Z",
    }
    return payload


@pytest.mark.parametrize(
    ("round_key", "extra_balance_questions", "expected_count"),
    [
        ("alpha", 0, 8),
        ("beta", 3, 11),
    ],
)
def test_dynamic_contract_accepts_two_rounds_with_different_ids_text_and_counts(
    round_key,
    extra_balance_questions,
    expected_count,
):
    payload = make_payload(round_key, extra_balance_questions)

    normalized = RoundAnalyticsResult.from_dict(payload).to_dict()

    assert normalized["contractVersion"] == DYNAMIC_CONTRACT_VERSION
    assert normalized["roundId"] == f"round-{round_key}"
    assert normalized["organizationId"] == f"org-{round_key}"
    assert normalized["surveyDefinitionHash"] == payload[
        "surveyDefinitionHash"
    ]
    assert len(normalized["questionAggregates"]) == expected_count
    assert normalized["questionAggregates"] == payload[
        "questionAggregates"
    ]


def test_dynamic_contract_preserves_persisted_text_for_a_reused_canonical_id():
    payload = make_payload("revised")
    original_key = next(iter(payload["questionAggregates"]))
    aggregate = payload["questionAggregates"].pop(original_key)
    aggregate["questionId"] = "self-expression-1"
    aggregate["dimensionId"] = "self-expression"
    aggregate["questionText"] = (
        "זהו הנוסח שנשמר בסבב ואסור להחליפו בטקסט ברירת המחדל."
    )
    payload["questionAggregates"][aggregate["questionId"]] = aggregate
    refresh_definition_hash(payload)

    normalized = RoundAnalyticsResult.from_dict(payload).to_dict()

    assert normalized["questionAggregates"]["self-expression-1"][
        "questionText"
    ] == aggregate["questionText"]


def test_dynamic_contract_rejects_partial_unlocked_question_aggregates():
    payload = make_payload("privacy")
    first_aggregate = next(iter(payload["questionAggregates"].values()))
    first_aggregate["responseCount"] = 9

    with pytest.raises(ValueError, match="below privacyThreshold"):
        RoundAnalyticsResult.from_dict(payload)


def test_dynamic_contract_rejects_map_key_or_duplicate_question_id():
    payload = make_payload("identity")
    first_key, first_aggregate = next(
        iter(payload["questionAggregates"].items()),
    )
    payload["questionAggregates"]["wrong-map-key"] = (
        payload["questionAggregates"].pop(first_key)
    )

    with pytest.raises(ValueError, match="key mismatch"):
        RoundAnalyticsResult.from_dict(payload)

    payload = make_payload("duplicate")
    first_key, first_aggregate = next(
        iter(payload["questionAggregates"].items()),
    )
    second_key = list(payload["questionAggregates"])[1]
    payload["questionAggregates"][second_key]["questionId"] = first_aggregate[
        "questionId"
    ]

    with pytest.raises(ValueError, match="unique question IDs"):
        RoundAnalyticsResult.from_dict(payload)


def test_dynamic_contract_rejects_unsupported_or_missing_dimension_coverage():
    payload = make_payload("unsupported")
    aggregate = next(iter(payload["questionAggregates"].values()))
    aggregate["dimensionId"] = "unsupported-dimension"
    refresh_definition_hash(payload)

    with pytest.raises(ValueError, match="supported dimension"):
        RoundAnalyticsResult.from_dict(payload)

    payload = make_payload("missing")
    payload["questionAggregates"] = {
        key: aggregate
        for key, aggregate in payload["questionAggregates"].items()
        if aggregate["dimensionId"] != "meaning"
    }
    refresh_definition_hash(payload)

    with pytest.raises(ValueError, match="cover all eight"):
        RoundAnalyticsResult.from_dict(payload)


def test_dynamic_contract_recomputes_exact_snapshot_hash():
    payload = make_payload("hash")
    payload["surveyDefinitionHash"] = f"sha256:{'0' * 64}"

    with pytest.raises(ValueError, match="does not match"):
        RoundAnalyticsResult.from_dict(payload)


def test_dynamic_hash_matches_shared_utf8_compact_json_vector():
    questions = [
        {
            "questionId": "😀",
            "dimensionId": "balance",
            "questionText": "שאלה",
        },
        {
            "questionId": "a",
            "dimensionId": "meaning",
            "questionText": "  טקסט מדויק  ",
        },
    ]

    assert definition_hash(questions) == (
        "sha256:feaed33e2341212b07591e5e0e228f0677d2cfa3fc64ba75eda9ae7d0fb90d24"
    )


def test_dynamic_contract_rejects_score_status_and_count_inconsistency():
    payload = make_payload("status")
    payload["dimensionScores"]["balance"]["computedStatus"] = "green"

    with pytest.raises(ValueError, match="inconsistent with its score"):
        RoundAnalyticsResult.from_dict(payload)

    payload = make_payload("count")
    next(iter(payload["questionAggregates"].values()))[
        "responseCount"
    ] = 13

    with pytest.raises(ValueError, match="exceeds totalResponses"):
        RoundAnalyticsResult.from_dict(payload)


def test_dynamic_contract_rejects_locked_details():
    payload = make_payload("locked-details")
    payload["isLocked"] = True

    with pytest.raises(ValueError, match="requires empty"):
        RoundAnalyticsResult.from_dict(payload)


def test_dynamic_contract_rejects_respondent_fields():
    payload = make_payload("forbidden")
    payload["respondentId"] = "respondent-must-not-cross-boundary"

    with pytest.raises(ValueError, match="forbids respondent-level"):
        RoundAnalyticsResult.from_dict(payload)


def test_dynamic_contract_rejects_non_hebrew_question_text():
    payload = make_payload("non-hebrew")
    next(iter(payload["questionAggregates"].values()))[
        "questionText"
    ] = "This text cannot become a Hebrew-only metric label."

    with pytest.raises(ValueError, match="Hebrew-only"):
        RoundAnalyticsResult.from_dict(payload)


@pytest.mark.parametrize(
    "field",
    ["roundId", "organizationId", "surveyDefinitionHash", "calculatedAt"],
)
def test_dynamic_contract_requires_isolation_and_snapshot_metadata(field):
    payload = make_payload("metadata")
    payload.pop(field)

    with pytest.raises(ValueError, match=field):
        RoundAnalyticsResult.from_dict(payload)


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("round_key", "extra_balance_questions"),
    [("alpha", 0), ("beta", 3)],
)
async def test_dynamic_pipeline_uses_exact_text_metrics_and_provenance(
    answering_llm,
    round_key,
    extra_balance_questions,
):
    payload = make_payload(round_key, extra_balance_questions)
    normalized = RoundAnalyticsResult.from_dict(payload)
    state = {
        "round_data": normalized.model_dump(),
        "org_context": {"organizationId": normalized.organizationId},
        "interpretations": {},
        "recommendations": {},
        "safety_status": "pending",
        "safety_feedback": None,
        "retry_count": 0,
        "final_payload": {},
    }

    final_state = await analytics_graph.ainvoke(state)
    result = final_state["final_payload"]

    assert result["status"] == "success"
    assert result["contractVersion"] == DYNAMIC_CONTRACT_VERSION
    assert result["surveyDefinitionHash"] == payload[
        "surveyDefinitionHash"
    ]
    assert set(result["stones"]) == set(AI_ANALYTICS_DIMENSION_IDS)
    for dimension_id, stone in result["stones"].items():
        expected = [
            aggregate
            for aggregate in payload["questionAggregates"].values()
            if aggregate["dimensionId"] == dimension_id
        ]
        assert [metric["questionId"] for metric in stone["metrics"]] == [
            aggregate["questionId"] for aggregate in expected
        ]
        assert [metric["label"] for metric in stone["metrics"]] == [
            aggregate["questionText"] for aggregate in expected
        ]
        assert stone["generationProvenance"]["sourceQuestionIds"] == [
            aggregate["questionId"] for aggregate in expected
        ]
        assert stone["generationProvenance"][
            "surveyDefinitionHash"
        ] == payload["surveyDefinitionHash"]

    weakest_balance = min(
        (
            aggregate
            for aggregate in payload["questionAggregates"].values()
            if aggregate["dimensionId"] == "balance"
        ),
        key=lambda aggregate: aggregate["averageScore"],
    )
    assert weakest_balance["questionText"] in result["stones"]["balance"][
        "psychologicalInterpretation"
    ]


def test_dynamic_provider_prompt_uses_exact_persisted_question_text():
    payload = make_payload("prompt")
    aggregate = next(
        aggregate
        for aggregate in payload["questionAggregates"].values()
        if aggregate["dimensionId"] == "balance"
    )

    prompt = llm_provider_service._build_prompt(
        dim_id="balance",
        dim_hebrew="איזון",
        score=60,
        status="yellow",
        question_aggregates=[aggregate],
    )

    assert aggregate["questionText"] in prompt
    # The question id used to be printed alongside the text. It is Latin, the
    # model never needed it — Core maps sourceQuestionIds itself — and copy
    # that echoes a Latin id is refused, so the prompt now carries the exact
    # persisted text alone.
    assert aggregate["questionId"] not in prompt


def test_dynamic_fallback_uses_actual_strongest_or_weakest_question():
    aggregates = [
        {
            "questionId": "custom-balance-strong",
            "dimensionId": "balance",
            "questionText": "יש לי מרחב קבוע להתאוששות במהלך השבוע.",
            "averageScore": 90,
            "responseCount": 12,
        },
        {
            "questionId": "custom-balance-weak",
            "dimensionId": "balance",
            "questionText": " העומס היומי מאפשר לי לסיים בזמן סביר? ",
            "averageScore": 20,
            "responseCount": 12,
        },
    ]

    green = llm_provider_service._heuristic_fallback(
        "איזון",
        80,
        "green",
        aggregates,
    )
    red = llm_provider_service._heuristic_fallback(
        "איזון",
        40,
        "red",
        aggregates,
    )

    assert aggregates[0]["questionText"] in green
    assert aggregates[1]["questionText"] in red
    assert llm_provider_service.is_complete_hebrew_copy(green)
    assert llm_provider_service.is_complete_hebrew_copy(red)


@pytest.mark.asyncio
async def test_locked_dynamic_result_short_circuits_provider_and_has_no_details(
    monkeypatch,
):
    unlocked = make_payload("locked")
    locked = {
        **unlocked,
        "totalResponses": 9,
        "isLocked": True,
        "dimensionScores": {},
        "questionAggregates": {},
    }
    normalized = RoundAnalyticsResult.from_dict(locked)
    calls = []

    def fail_if_called(*_args, **_kwargs):
        calls.append(True)
        raise AssertionError("provider must not run for locked input")

    monkeypatch.setattr(
        llm_provider_service,
        "generate_psychological_interpretation_result",
        fail_if_called,
    )
    state = {
        "round_data": normalized.model_dump(),
        "org_context": {"organizationId": normalized.organizationId},
        "interpretations": {},
        "recommendations": {},
        "safety_status": "pending",
        "safety_feedback": None,
        "retry_count": 0,
        "final_payload": {},
    }

    result = (await analytics_graph.ainvoke(state))["final_payload"]

    assert calls == []
    assert result["contractVersion"] == DYNAMIC_CONTRACT_VERSION
    assert result["surveyDefinitionHash"] == locked[
        "surveyDefinitionHash"
    ]
    assert result["status"] == "locked_error"
    assert "stones" not in result
    assert "overallPsychologicalSummary" not in result


@pytest.mark.asyncio
async def test_runner_rejects_cross_round_mcp_result_before_graph_or_callback(
    monkeypatch,
):
    returned = RoundAnalyticsResult.from_dict(make_payload("isolation"))
    graph_call = AsyncMock()
    callback_call = AsyncMock()
    monkeypatch.setattr(
        mcp_client_manager,
        "fetch_round_analytics",
        AsyncMock(return_value=returned),
    )
    monkeypatch.setattr(analytics_graph, "ainvoke", graph_call)
    monkeypatch.setattr(
        analytics_runner_service,
        "_send_callback",
        callback_call,
    )

    with pytest.raises(RuntimeError, match="round isolation mismatch"):
        await analytics_runner_service.process_round("round-requested")

    graph_call.assert_not_awaited()
    callback_call.assert_not_awaited()


@pytest.mark.asyncio
async def test_a_crashed_round_still_reports_a_failure_to_the_data_layer(
    monkeypatch,
):
    """The webhook already answered 202, so silence would strand the round.

    Core would keep waiting for a callback that never arrives and the manager
    would keep reading "not generated yet" for a run that is long dead.
    """
    returned = RoundAnalyticsResult.from_dict(make_payload("crash"))
    callback_call = AsyncMock()
    monkeypatch.setattr(
        mcp_client_manager,
        "fetch_round_analytics",
        AsyncMock(return_value=returned),
    )
    monkeypatch.setattr(
        analytics_graph,
        "ainvoke",
        AsyncMock(side_effect=RuntimeError("graph exploded")),
    )
    monkeypatch.setattr(
        analytics_runner_service,
        "_send_callback",
        callback_call,
    )

    with pytest.raises(RuntimeError, match="graph exploded"):
        await analytics_runner_service.process_round(returned.roundId)

    callback_call.assert_awaited_once()
    _url, payload = callback_call.await_args.args
    assert payload["status"] == "validation_failed"
    assert payload["failureReason"] == "service_error"
    assert payload["roundId"] == returned.roundId
    assert payload["surveyDefinitionHash"] == returned.surveyDefinitionHash
    assert payload["isLocked"] is False
    assert "stones" not in payload
    assert "שירות הניתוח אינו זמין כרגע" in payload["errorMessage"]


@pytest.mark.asyncio
async def test_runner_carries_dynamic_organization_isolation_into_state(
    monkeypatch,
):
    returned = RoundAnalyticsResult.from_dict(make_payload("runner"))
    final_payload = {
        "contractVersion": DYNAMIC_CONTRACT_VERSION,
        "roundId": returned.roundId,
        "surveyDefinitionHash": returned.surveyDefinitionHash,
        "isLocked": False,
        "status": "validation_failed",
    }
    graph_call = AsyncMock(
        return_value={"final_payload": final_payload},
    )
    callback_call = AsyncMock()
    monkeypatch.setattr(
        mcp_client_manager,
        "fetch_round_analytics",
        AsyncMock(return_value=returned),
    )
    monkeypatch.setattr(analytics_graph, "ainvoke", graph_call)
    monkeypatch.setattr(
        analytics_runner_service,
        "_send_callback",
        callback_call,
    )

    result = await analytics_runner_service.process_round(returned.roundId)

    assert result == final_payload
    initial_state = graph_call.await_args.args[0]
    assert initial_state["org_context"] == {
        "organizationId": returned.organizationId,
    }
    assert initial_state["round_data"]["organizationId"] == (
        returned.organizationId
    )
    callback_call.assert_awaited_once()
