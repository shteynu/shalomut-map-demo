import asyncio
import logging
from typing import Dict, Any, NamedTuple, Optional
from src.agents.state import AnalyticsState
from src.rag.store import LocalInterventionVectorStore
from src.services import hebrew_validation
from src.services.llm_provider import (
    ProviderUnavailableError,
    llm_provider_service,
)
from src.config import settings
from src.schemas.contract_registry import get_capabilities
from src.contracts import (
    AI_ANALYTICS_CONTRACT_VERSION,
    AI_ANALYTICS_DIMENSION_NAMES_HEBREW,
    AI_ANALYTICS_DYNAMIC_CONTRACT_VERSION,
    AI_ANALYTICS_DYNAMIC_CONTRACT_VERSIONS,
    AI_ANALYTICS_SUPPORTED_CONTRACT_VERSIONS,
    AI_ANALYTICS_V4_CONTRACT_VERSION,
    AI_ANALYTICS_V5_CONTRACT_VERSION,
    AI_ANALYTICS_QUESTIONS,
    AI_ANALYTICS_V1_CONTRACT_VERSION,
)
from src.schemas.mcp_types import status_for_score

logger = logging.getLogger(__name__)
vector_store = LocalInterventionVectorStore()

DIMENSION_NAMES_HEBREW = AI_ANALYTICS_DIMENSION_NAMES_HEBREW


def _provider_slots() -> asyncio.Semaphore:
    """One batch's worth of provider slots.

    Both LLM nodes hand their whole batch to `asyncio.gather`, which without a
    bound puts every dimension — and then every catalog entry — on the wire at
    once. The slot is taken before the worker thread is dispatched, so a
    throttled round also stops flooding the default thread pool, and the
    per-dimension retry budget still starts when the request does.

    The two nodes run one after the other in the graph, so a semaphore per node
    call bounds the round. Two rounds running side by side in one process would
    get a batch of slots each; the deployed service handles one round at a time
    per instance, and the per-request retries absorb the rest.
    """
    return asyncio.Semaphore(settings.llm_max_concurrent_requests)


async def _in_provider_slot(slots: asyncio.Semaphore, function, /, **kwargs):
    """Run one blocking provider call once a slot is free."""
    async with slots:
        return await asyncio.to_thread(function, **kwargs)


class ReplayPlan(NamedTuple):
    """The parts of a round a replay has to write again.

    Everything outside it stands: an interpretation the validator accepted is
    accepted still, and its provenance keeps the attempt count it earned.
    """

    interpretations: frozenset[str]
    recommendations: frozenset[str]
    overall_summary: bool


def _replay_plan(state: AnalyticsState) -> Optional[ReplayPlan]:
    """What this pass must redo, or `None` when it must do the whole round.

    A first pass has nothing to keep. A replay does, and it matters more than
    it looks: the safety loop switches the *whole node* to the heavy model, and
    the heavy tier allows twenty requests a day, so a replay of all eight
    dimensions plus the summary and eight adaptations spends the day's budget
    to repair the one stone the validator turned away.

    An untargeted replay redoes everything, which is the old behaviour and the
    safe reading: a check that fails without naming what it rejected must not
    quietly become a no-op.
    """
    if state.get("retry_count", 0) <= 0:
        return None

    plan = ReplayPlan(
        interpretations=frozenset(
            state.get("retry_interpretation_dimensions") or (),
        ),
        recommendations=frozenset(
            state.get("retry_recommendation_dimensions") or (),
        ),
        overall_summary=bool(state.get("retry_overall_summary")),
    )
    if not (
        plan.interpretations
        or plan.recommendations
        or plan.overall_summary
    ):
        return None
    return plan


def _effective_contract_version(round_data: Dict[str, Any]) -> str:
    return round_data.get(
        "contractVersion",
        AI_ANALYTICS_V1_CONTRACT_VERSION,
    )


def _background_context_for_prompt(
    round_data: Dict[str, Any],
    state: "AnalyticsState",
) -> Optional[Dict[str, Any]]:
    """School background context reaches the prompt on contracts 4.0 and 5.0.

    Versions 1.0-3.0 are immutable boundaries: silently enriching their prompt
    would change what those versions mean without a version bump. 5.0 is 4.0
    plus score distributions, and Core sends the context on both
    (`src/app/api/mcp/route.ts`), so gating on 4.0 alone made an upgrade to
    5.0 trade the school context away for the distributions instead of adding
    them.
    """
    contract_version = _effective_contract_version(round_data)
    if not get_capabilities(contract_version).supportsBackgroundContext:
        return None

    return round_data.get("backgroundContext") or state.get("org_context")


def _question_aggregates_for_dimension(
    round_data: Dict[str, Any],
    dimension_id: str,
) -> list[Dict[str, Any]]:
    aggregates = round_data.get("questionAggregates", {})
    if get_capabilities(_effective_contract_version(round_data)).supportsDynamicQuestions:
        return [
            aggregate
            for aggregate in aggregates.values()
            if aggregate.get("dimensionId") == dimension_id
        ]
    return [
        aggregates[question["id"]]
        for question in AI_ANALYTICS_QUESTIONS
        if question["dimensionId"] == dimension_id
        and question["id"] in aggregates
    ]

V5_PROMPT_INCLUSION_FIELDS = (
    "distributionIncluded",
    "crossDimensionContextIncluded",
)


def _v5_prompt_inclusions(
    round_data: Dict[str, Any],
    dimension_id: str,
    dim_scores: Dict[str, Any],
) -> Dict[str, bool]:
    """What the 5.0 prompt actually carried for one dimension.

    These are measurements, not claims. Writing both flags as a constant True
    and then asserting they are True audits nothing: the pair exists so a
    reader of a stored result can tell an enriched interpretation from one the
    model produced without the distribution or the cross-dimension picture.
    """
    return {
        "distributionIncluded": hebrew_validation.has_full_distribution(
            _question_aggregates_for_dimension(round_data, dimension_id),
        ),
        "crossDimensionContextIncluded": bool(dim_scores),
    }


def privacy_gate_node(state: AnalyticsState) -> AnalyticsState:
    """
    Node 1: Privacy Gate (Python Function)
    Checks state['round_data']['isLocked']. If True (< privacyThreshold responses),
    halts graph execution immediately and flags privacy error.
    """
    round_data = state.get("round_data", {})
    is_locked = bool(round_data.get("isLocked", False))
    total_responses = int(round_data.get("totalResponses", 0))
    privacy_threshold = int(
        round_data.get("privacyThreshold", settings.privacy_threshold),
    )
    
    logger.info(f"[Node 1: Privacy Gate] Checking privacy lock. Responses: {total_responses}, isLocked: {is_locked}")
    
    if is_locked or total_responses < privacy_threshold:
        # 4.0 and 5.0 are dynamic contracts too, and Core refuses any payload of
        # theirs without the hash. Gating on 3.0 alone meant a locked round on
        # the deployed version had its locked result rejected at the callback
        # and never reached the manager's screen.
        dynamic_metadata = (
            {
                "surveyDefinitionHash": round_data.get(
                    "surveyDefinitionHash",
                ),
            }
            if get_capabilities(_effective_contract_version(round_data)).supportsDynamicQuestions
            else {}
        )
        return {
            **state,
            "safety_status": "privacy_locked",
            "final_payload": {
                "contractVersion": _effective_contract_version(round_data),
                "roundId": round_data.get("roundId", ""),
                **dynamic_metadata,
                "isLocked": True,
                "status": "locked_error",
                "errorMessage": (
                    "תוצאות מפורטות נעולות עד להשלמת סף הפרטיות "
                    f"של {privacy_threshold} משיבים."
                ),
            }
        }
        
    return {
        **state,
        "safety_status": "pass_privacy"
    }

async def agent_psychologist_node(state: AnalyticsState) -> AnalyticsState:
    """
    Node 2: Agent Psychologist (LLM Node)
    Takes dimensionScores (focusing on 'yellow' and 'red' statuses)
    and delegates generation to the decoupled LLMProviderService.

    The provider call is blocking, so dimensions run concurrently in worker
    threads. That keeps the event loop free and turns a per-dimension serial
    wait into a single round trip for the whole round — bounded by
    `LLM_MAX_CONCURRENT_REQUESTS`, so the batch does not arrive at the provider
    all at once.

    A replay writes only what the safety validator rejected — see `ReplayPlan`.
    """
    round_data = state.get("round_data", {})
    dim_scores = round_data.get("dimensionScores", {})
    retry_count = state.get("retry_count", 0)
    plan = _replay_plan(state)
    previous_interpretations = state.get("interpretations", {}).get(
        "dimension_interpretations",
        {},
    )
    previous_provenance = state.get("generation_provenance", {})

    yellow_red_dims = []
    retry_tier = "heavy" if retry_count > 0 else "fast"
    if retry_count > 0:
        # Which of the round is being written again, on the tier where that
        # question has a daily answer. `all` is the old whole-node replay.
        logger.info(
            "[Node 2: Psychologist] Replay %s on tier=%s writes %s",
            retry_count,
            retry_tier,
            "all"
            if plan is None
            else (
                "interpretations="
                + (",".join(sorted(plan.interpretations)) or "-")
                + " summary="
                + ("yes" if plan.overall_summary else "no")
            ),
        )

    dim_ids = []
    generations = []
    slots = _provider_slots()

    for dim_id, score_obj in dim_scores.items():
        if isinstance(score_obj, dict):
            status = score_obj.get("computedStatus", "green")
            score = score_obj.get("averageScore", 0.0)
        else:
            status = getattr(score_obj, "computedStatus", "green")
            score = getattr(score_obj, "averageScore", 0.0)

        if status in ["yellow", "red"]:
            yellow_red_dims.append(dim_id)

        # An interpretation the validator accepted is not rewritten. Its
        # provenance has to exist to be carried, or there is nothing to keep and
        # the dimension goes to the provider again.
        if (
            plan is not None
            and dim_id not in plan.interpretations
            and dim_id in previous_provenance
        ):
            continue

        dim_hebrew = DIMENSION_NAMES_HEBREW.get(dim_id, dim_id)
        question_aggregates = _question_aggregates_for_dimension(
            round_data,
            dim_id,
        )
        background_context = _background_context_for_prompt(round_data, state)
        eff_version = _effective_contract_version(round_data)
        dim_ids.append(dim_id)
        generations.append(
            _in_provider_slot(
                slots,
                llm_provider_service.generate_psychological_interpretation_result,
                dim_id=dim_id,
                dim_hebrew=dim_hebrew,
                score=score,
                status=status,
                retry_tier=retry_tier,
                question_aggregates=question_aggregates,
                background_context=background_context,
                contract_version=eff_version,
                all_dimension_scores=dim_scores,
            )
        )

    # Gathered with the exceptions kept: one dead dimension must not cancel the
    # reporting of the others.
    settled = await asyncio.gather(*generations, return_exceptions=True)
    failures = [
        result
        for result in settled
        if isinstance(result, ProviderUnavailableError)
    ]
    for result in settled:
        if isinstance(result, BaseException) and not isinstance(
            result,
            ProviderUnavailableError,
        ):
            raise result

    regenerated = dict(zip(dim_ids, settled))
    interpretations = {}
    for dim_id in dim_scores:
        # A dimension this pass did not touch keeps the text it already had.
        if dim_id not in regenerated:
            interpretations[dim_id] = previous_interpretations.get(dim_id, "")
            continue
        # A dimension the provider never answered for holds no interpretation
        # at all. Empty rather than heuristic text, because the alternative is
        # the fallback wearing the label of analysis.
        generation = regenerated[dim_id]
        interpretations[dim_id] = (
            "" if isinstance(generation, ProviderUnavailableError)
            else generation.text
        )

    # Up to 4.0 a dead dimension fails the round: those contracts describe a
    # map of eight interpretations and nothing else, and a consumer written
    # against them has no shape to render a gap in. 5.0 says so out loud
    # instead — see the partial-map decision. A round where nothing at all was
    # written is still a failure on every version: there is no partial map in
    # zero stones, only a service that is down. The question is asked of the
    # whole map rather than of this pass, so a replay of one dimension that
    # fails again leaves the seven standing interpretations standing.
    eff_version = _effective_contract_version(round_data)
    partial_allowed = (
        eff_version == AI_ANALYTICS_V5_CONTRACT_VERSION
        and any(interpretations.values())
    )

    if failures and not partial_allowed:
        logger.warning(
            "[Node 2: Psychologist] Provider unavailable for %s of %s "
            "dimension(s); first reason=%s dimension=%s",
            len(failures),
            len(dim_ids),
            failures[0].reason,
            failures[0].dimension_id,
        )
        return {
            **state,
            "safety_status": "provider_unavailable",
            "provider_failure_reason": failures[0].reason,
        }

    if failures:
        logger.warning(
            "[Node 2: Psychologist] Partial map: %s of %s dimension(s) have "
            "no interpretation; dimensions=%s reasons=%s",
            len(failures),
            len(dim_ids),
            ",".join(
                sorted(
                    failure.dimension_id or "unavailable"
                    for failure in failures
                ),
            ),
            ",".join(sorted({failure.reason for failure in failures})),
        )

    generation_provenance = {}
    for dim_id in dim_scores:
        # Kept text keeps the attempt count it earned; rewriting it as a fresh
        # first attempt would report a round that never happened.
        if dim_id not in regenerated:
            generation_provenance[dim_id] = previous_provenance[dim_id]
            continue

        generation = regenerated[dim_id]
        prior_attempts = int(
            previous_provenance.get(dim_id, {}).get("attempts", 0),
        )
        attempts = prior_attempts + generation.attempts
        outcome = (
            "unavailable"
            if isinstance(generation, ProviderUnavailableError)
            else generation.outcome
        )
        source_question_ids = [
            aggregate["questionId"]
            for aggregate in _question_aggregates_for_dimension(
                round_data,
                dim_id,
            )
        ]
        generation_provenance[dim_id] = {
            "outcome": outcome,
            "attempts": attempts,
            "retryCount": max(0, attempts - 1),
            "sourceQuestionIds": source_question_ids,
        }
        if get_capabilities(eff_version).supportsDynamicQuestions:
            generation_provenance[dim_id]["surveyDefinitionHash"] = (
                round_data.get("surveyDefinitionHash")
            )
        if eff_version in {
            AI_ANALYTICS_V4_CONTRACT_VERSION,
            AI_ANALYTICS_V5_CONTRACT_VERSION,
        }:
            generation_provenance[dim_id]["backgroundContextIncluded"] = bool(
                _background_context_for_prompt(round_data, state),
            )
        if eff_version == AI_ANALYTICS_V5_CONTRACT_VERSION:
            generation_provenance[dim_id].update(
                _v5_prompt_inclusions(round_data, dim_id, dim_scores),
            )

    background_context = _background_context_for_prompt(round_data, state)
    previous_summary = state.get("interpretations", {}).get(
        "overall_summary",
        "",
    )
    keeps_summary = (
        plan is not None
        and not plan.overall_summary
        and bool(previous_summary)
    )
    # Blocking provider call: the eight interpretations already run in worker
    # threads, and leaving this one on the event loop stalls the whole service
    # for the length of the round summary request. The summary is written from
    # the dimension scores, which a replay does not change, so asking for it
    # again when the validator accepted it buys nothing and costs a request.
    try:
        overall_summary = previous_summary if keeps_summary else (
            await asyncio.to_thread(
                llm_provider_service.generate_overall_summary,
                dim_scores=dim_scores,
                background_context=background_context,
                retry_tier=retry_tier,
                contract_version=eff_version,
                question_aggregates=list(
                    round_data.get("questionAggregates", {}).values(),
                ),
            )
        )
    except ProviderUnavailableError as error:
        logger.warning(
            "[Node 2: Psychologist] Provider unavailable for the round "
            "summary; reason=%s",
            error.reason,
        )
        return {
            **state,
            "safety_status": "provider_unavailable",
            "provider_failure_reason": error.reason,
        }

    return {
        **state,
        "interpretations": {
            "overall_summary": overall_summary,
            "dimension_interpretations": interpretations
        },
        "generation_provenance": generation_provenance,
    }

def agent_rag_intervention_node(state: AnalyticsState) -> AnalyticsState:
    """
    Node 3: Intervention Catalog (Tool Node)
    Queries the local structured catalog to extract top-3 relevant organizational
    interventions for each dimension and adds them to the state.

    A replay leaves the dimensions the validator accepted alone. The catalog
    query itself costs no provider call, but re-selecting an entry drops the
    rewrite already attached to it, and rewriting it again is what costs.
    """
    round_data = state.get("round_data", {})
    dim_scores = round_data.get("dimensionScores", {})
    bg_context = _background_context_for_prompt(round_data, state)
    plan = _replay_plan(state)
    previous_recommendations = state.get("recommendations", {})
    recommendations = {}

    for dim_id, score_obj in dim_scores.items():
        if isinstance(score_obj, dict):
            status = score_obj.get("computedStatus", "green")
        else:
            status = getattr(score_obj, "computedStatus", "green")

        if (
            plan is not None
            and dim_id not in plan.recommendations
            and dim_id in previous_recommendations
        ):
            recommendations[dim_id] = previous_recommendations[dim_id]
            continue

        q_aggregates = _question_aggregates_for_dimension(round_data, dim_id)
        interventions = vector_store.get_interventions_for_dimension(
            dimension_id=dim_id,
            status=status,
            limit=3,
            question_aggregates=q_aggregates,
            background_context=bg_context,
        )
        serialized_interventions = []
        for intervention in interventions:
            serialized = (
                intervention.model_dump()
                if hasattr(intervention, "model_dump")
                else intervention.to_dict()
            )
            serialized["status"] = status
            serialized_interventions.append(serialized)
        recommendations[dim_id] = serialized_interventions

    return {
        **state,
        "recommendations": recommendations
    }

async def agent_adaptation_node(state: AnalyticsState) -> AnalyticsState:
    """
    Node 3b: Intervention Adaptation
    Rewrites the selected catalog entries against this school's numbers.

    The catalog is one text for every school; without this node two schools in
    the same status read the same three paragraphs however different their
    rounds were. Only 5.0 adapts: 1.0-4.0 are deployed boundaries, and their
    stored results must keep meaning what they meant when they were written.
    Each entry records how its copy came to be, so a reader can tell a rewrite
    from the catalog text.
    """
    round_data = state.get("round_data", {})
    if not get_capabilities(_effective_contract_version(round_data)).supportsPartialMaps:
        return state

    dim_scores = round_data.get("dimensionScores", {})
    background_context = _background_context_for_prompt(round_data, state)
    retry_tier = "heavy" if state.get("retry_count", 0) > 0 else "fast"
    plan = _replay_plan(state)
    recommendations = state.get("recommendations", {})

    targets = []
    adaptations = []
    slots = _provider_slots()
    for dim_id, interventions in recommendations.items():
        # A rewrite the validator accepted is already on these entries, carried
        # through the catalog node. Asking the model for it again is the cost
        # this node has to avoid on a replay: the heavy tier's day is twenty
        # requests, and eight of them are these.
        if (
            plan is not None
            and dim_id not in plan.recommendations
            and all(
                intervention.get("adaptationOutcome")
                for intervention in interventions
            )
        ):
            continue

        score_obj = dim_scores.get(dim_id, {})
        if isinstance(score_obj, dict):
            status = score_obj.get("computedStatus", "green")
            score = float(score_obj.get("averageScore", 0.0))
        else:
            status = getattr(score_obj, "computedStatus", "green")
            score = float(getattr(score_obj, "averageScore", 0.0))

        question_aggregates = _question_aggregates_for_dimension(
            round_data,
            dim_id,
        )
        # One request per dimension rather than one per entry. Every entry of a
        # dimension is rewritten against the same aggregates, status and school
        # background, so sending that context once per entry cost a round about
        # two dozen requests to say one thing repeatedly — against a free tier
        # that allows twenty a day. The call still blocks, so dimensions run
        # concurrently through the same bounded set of provider slots.
        targets.append((dim_id, len(interventions)))
        adaptations.append(
            _in_provider_slot(
                slots,
                llm_provider_service.adapt_interventions_result,
                interventions=list(interventions),
                dim_hebrew=DIMENSION_NAMES_HEBREW.get(dim_id, dim_id),
                score=score,
                status=status,
                question_aggregates=question_aggregates,
                background_context=background_context,
                retry_tier=retry_tier,
            )
        )

    results = await asyncio.gather(*adaptations)

    adapted = {
        dim_id: [dict(intervention) for intervention in interventions]
        for dim_id, interventions in recommendations.items()
    }
    for (dim_id, expected_count), dimension_adaptations in zip(
        targets,
        results,
    ):
        # The provider returns one adaptation per entry or falls the whole
        # dimension back to the catalog; either way the count matches. Anything
        # else would silently shift adaptations onto the wrong recommendations.
        if len(dimension_adaptations) != expected_count:
            raise ValueError(
                "Adaptation count does not match the recommendations of "
                f"dimension {dim_id}"
            )
        for index, adaptation in enumerate(dimension_adaptations):
            adapted[dim_id][index].update(
                {
                    "summary": adaptation.summary,
                    "actionable_steps": list(adaptation.actionable_steps),
                    "adaptationOutcome": adaptation.outcome,
                },
            )

    return {
        **state,
        "recommendations": adapted,
    }


def agent_safety_validator_node(state: AnalyticsState) -> AnalyticsState:
    """
    Node 4: Agent Safety Validator (Critique Node)
    Acts as a quality controller. Checks combined text for AI hallucinations
    (e.g., claiming a score is bad when it's 'green') and privacy leaks.
    """
    round_data = state.get("round_data", {})
    dim_scores = round_data.get("dimensionScores", {})
    interpretations = state.get("interpretations", {}).get("dimension_interpretations", {})
    overall_summary = state.get("interpretations", {}).get(
        "overall_summary",
        "",
    )
    retry_count = state.get("retry_count", 0)
    contract_version = _effective_contract_version(round_data)
    is_semantic_contract = (
        contract_version in AI_ANALYTICS_SUPPORTED_CONTRACT_VERSIONS
        and contract_version != AI_ANALYTICS_V1_CONTRACT_VERSION
    )
    is_dynamic_contract = contract_version in AI_ANALYTICS_DYNAMIC_CONTRACT_VERSIONS

    is_safe = True
    feedback = []
    # What a replay would have to write again. Named per dimension and per part,
    # because a replay reaches for the heavy model and its free tier allows
    # twenty requests a day: rewriting the whole round to repair one stone is
    # how four replays exhaust the day.
    rejected_interpretations = set()
    rejected_recommendations = set()
    rejected_summary = False

    for dim_id, score_obj in dim_scores.items():
        if isinstance(score_obj, dict):
            status = score_obj.get("computedStatus", "green")
            score = float(score_obj.get("averageScore", 0.0))
        else:
            status = getattr(score_obj, "computedStatus", "green")
            score = float(getattr(score_obj, "averageScore", 0.0))

        interp = interpretations.get(dim_id, "")

        if status != status_for_score(score):
            is_safe = False
            # Core's own number disagrees with Core's own status, so no rewrite
            # can repair it. It is still named, because a replay that skips
            # every rejection would loop doing nothing at all.
            rejected_interpretations.add(dim_id)
            feedback.append(
                f"Status is inconsistent with score for {dim_id}"
            )

        # The 5.0 prompt states the distribution in Hebrew colour words, so the
        # validator has to know which counts an interpretation may quote.
        distribution_counts = hebrew_validation.distribution_counts(
            _question_aggregates_for_dimension(round_data, dim_id),
        )
        # A stone the provider never wrote is judged on being empty, not on
        # being good Hebrew: there is no copy to read, and the provenance says
        # so. Holding it to the copy rules would fail the round the partial map
        # exists to save.
        unavailable = (
            state.get("generation_provenance", {})
            .get(dim_id, {})
            .get("outcome") == "unavailable"
        )
        if unavailable:
            if interp != "":
                is_safe = False
                rejected_interpretations.add(dim_id)
                feedback.append(
                    f"An unavailable interpretation must be empty: {dim_id}"
                )
        elif (
            not hebrew_validation.is_complete_hebrew_copy(
                interp,
                contract_version=contract_version,
            )
            or not hebrew_validation.is_status_consistent(
                interp,
                status,
                contract_version=contract_version,
                distribution_counts=distribution_counts,
            )
        ):
            is_safe = False
            rejected_interpretations.add(dim_id)
            feedback.append(
                f"Interpretation is invalid for status {status}: {dim_id}"
            )

        for intervention in state.get("recommendations", {}).get(
            dim_id,
            [],
        ):
            user_facing_copy = [
                intervention.get("title", ""),
                intervention.get("summary", ""),
                *intervention.get("actionable_steps", []),
            ]
            adaptation_outcome = intervention.get("adaptationOutcome")
            if (
                intervention.get("dimensionId") != dim_id
                or intervention.get("status") != status
                or not user_facing_copy
                or not all(
                    hebrew_validation.is_hebrew_only_copy(text)
                    for text in user_facing_copy
                )
                or (
                    contract_version == AI_ANALYTICS_V5_CONTRACT_VERSION
                    and adaptation_outcome
                    not in {"llm", "deterministic_fallback"}
                )
                # Catalog copy is human-written and already trusted; a rewrite
                # is model output and answers to the rule the interpretation
                # answers to.
                or (
                    adaptation_outcome == "llm"
                    and not hebrew_validation.is_status_consistent(
                        " ".join(user_facing_copy),
                        status,
                        contract_version=contract_version,
                        distribution_counts=distribution_counts,
                    )
                )
            ):
                is_safe = False
                rejected_recommendations.add(dim_id)
                feedback.append(
                    f"Intervention is invalid for status {status}: {dim_id}"
                )

        if is_semantic_contract:
            provenance = state.get("generation_provenance", {}).get(
                dim_id,
                {},
            )
            expected_question_ids = [
                aggregate["questionId"]
                for aggregate in _question_aggregates_for_dimension(
                    round_data,
                    dim_id,
                )
            ]
            attempts = provenance.get("attempts")
            retry_count_value = provenance.get("retryCount")
            outcome = provenance.get("outcome")
            allowed_outcomes = {"llm", "deterministic_fallback"}
            if contract_version == AI_ANALYTICS_V5_CONTRACT_VERSION:
                allowed_outcomes.add("unavailable")
            if (
                outcome not in allowed_outcomes
                or not isinstance(attempts, int)
                or isinstance(attempts, bool)
                or attempts < 0
                or not isinstance(retry_count_value, int)
                or isinstance(retry_count_value, bool)
                or retry_count_value != max(0, attempts - 1)
                or provenance.get("sourceQuestionIds")
                != expected_question_ids
                or (
                    is_dynamic_contract
                    and provenance.get("surveyDefinitionHash")
                    != round_data.get("surveyDefinitionHash")
                )
                or (outcome == "llm" and attempts < 1)
                or (
                    contract_version == AI_ANALYTICS_V5_CONTRACT_VERSION
                    and {
                        field: provenance.get(field)
                        for field in V5_PROMPT_INCLUSION_FIELDS
                    }
                    != _v5_prompt_inclusions(round_data, dim_id, dim_scores)
                )
            ):
                is_safe = False
                rejected_interpretations.add(dim_id)
                feedback.append(
                    f"Generation provenance is invalid for {dim_id}"
                )

    if is_semantic_contract and not hebrew_validation.is_hebrew_only_copy(
        overall_summary,
    ):
        is_safe = False
        rejected_summary = True
        feedback.append("Overall summary is not Hebrew-only")

    if not is_safe:
        next_retry_count = min(3, retry_count + 1)
        logger.warning(
            "[Safety Validator] Safety check failed. Retry count: %s. "
            "Replaying interpretations=%s recommendations=%s summary=%s",
            next_retry_count,
            ",".join(sorted(rejected_interpretations)) or "-",
            ",".join(sorted(rejected_recommendations)) or "-",
            "yes" if rejected_summary else "no",
        )
        return {
            **state,
            "safety_status": "fail",
            "safety_feedback": "; ".join(feedback),
            "retry_count": next_retry_count,
            "retry_interpretation_dimensions": sorted(
                rejected_interpretations,
            ),
            "retry_recommendation_dimensions": sorted(
                rejected_recommendations,
            ),
            "retry_overall_summary": rejected_summary,
        }

    return {
        **state,
        "safety_status": "pass",
        "safety_feedback": None
    }
