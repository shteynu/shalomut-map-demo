"""The corpus is contract input, and the graders catch what they claim to.

A grader that never fires is worse than no grader: it reads as evidence of
quality while measuring nothing. So every one here is pinned by a payload it
must score well and a payload it must not.
"""

import json
import os
from pathlib import Path

import pytest

from evals.corpus import (
    CASES,
    CASES_BY_ID,
    QUESTION_TEXTS_HEBREW,
    case_for_round_id,
)
from evals.graders import (
    grade_distinctness,
    grade_evidence_specificity,
    grade_no_overreach,
    grade_recommendation_fit,
    grade_summary_grounding,
)
from evals.report import build_report, grade_payload, main, render
from src.contracts import (
    AI_ANALYTICS_DIMENSION_IDS,
    AI_ANALYTICS_DIMENSION_NAMES_HEBREW,
)
from src.schemas.mcp_types import RoundAnalyticsResult

HEALTHY = CASES_BY_ID["uniformly-healthy"]
CONTRADICTORY = CASES_BY_ID["contradictory"]

GENERIC_SENTENCE = (
    "התמונה מצביעה על מגמה כללית ומומלץ להמשיך לעקוב אחריה יחד עם הצוות."
)


def stone_map(case, *, summary="סיכום.", narrative_for=None, interventions_for=None):
    """A minimal contract-shaped payload for one corpus case."""
    stones = {}
    for dimension_id in AI_ANALYTICS_DIMENSION_IDS:
        spec = case.dimensions[dimension_id]
        status = (
            "green" if spec.score >= 75 else "yellow" if spec.score >= 50 else "red"
        )
        stones[dimension_id] = {
            "dimensionId": dimension_id,
            "dimensionNameHebrew": AI_ANALYTICS_DIMENSION_NAMES_HEBREW[dimension_id],
            "status": status,
            "score": spec.score,
            "summary": [
                (narrative_for or (lambda _: GENERIC_SENTENCE))(dimension_id)
            ],
            "metrics": [],
            "recommendedInterventions": (
                interventions_for(dimension_id, status)
                if interventions_for
                else []
            ),
        }
    return {
        "contractVersion": "6.0",
        "roundId": f"eval-{case.case_id}",
        "status": "success",
        "isLocked": False,
        "overallPsychologicalSummary": summary,
        "stones": stones,
    }


# --- the corpus is real contract input -------------------------------------


@pytest.mark.parametrize("case", CASES, ids=[case.case_id for case in CASES])
def test_every_case_parses_as_contract_input(case):
    parsed = RoundAnalyticsResult.from_dict(case.to_analysis_input())
    assert parsed.contractVersion == "6.0"
    assert parsed.roundId == f"eval-{case.case_id}"
    assert case_for_round_id(parsed.roundId) is case


@pytest.mark.parametrize("case", CASES, ids=[case.case_id for case in CASES])
def test_every_case_covers_the_eight_dimensions(case):
    assert set(case.dimensions) == set(AI_ANALYTICS_DIMENSION_IDS)


def test_a_locked_case_carries_no_detail():
    locked = CASES_BY_ID["locked-below-threshold"].to_analysis_input()
    assert locked["isLocked"] is True
    assert locked["dimensionScores"] == {}
    assert locked["questionAggregates"] == {}
    # The questionnaire snapshot survives the lock: what was asked is not a
    # respondent detail.
    assert locked["surveyDefinitionHash"].startswith("sha256:")


def test_the_polarized_twin_is_only_distinguishable_by_its_spread():
    # The pair exists to catch an analysis that reads averages and stops.
    middle = CASES_BY_ID["mixed-middle"].to_analysis_input()
    polarized = CASES_BY_ID["polarized"].to_analysis_input()

    assert middle["dimensionScores"] == polarized["dimensionScores"]
    middle_spreads = {
        aggregate["scoreDistribution"]["yellow"]
        for aggregate in middle["questionAggregates"].values()
    }
    polarized_spreads = {
        aggregate["scoreDistribution"]["yellow"]
        for aggregate in polarized["questionAggregates"].values()
    }
    assert middle_spreads == {8}
    assert polarized_spreads == {0}


# --- summary grounding ------------------------------------------------------


def test_a_correct_count_is_grounded():
    payload = stone_map(HEALTHY, summary="שמונה ממדים ירוקים בבית הספר הזה.")
    result = grade_summary_grounding(payload, HEALTHY)
    assert result.score == 1.0
    assert result.measured["claims"] == 1


def test_a_wrong_count_is_caught():
    payload = stone_map(HEALTHY, summary="שלושה ממדים ירוקים בבית הספר הזה.")
    result = grade_summary_grounding(payload, HEALTHY)
    assert result.score == 0.0
    assert "claims 3 green" in result.findings[0]


def test_a_wrong_count_in_digits_is_caught_too():
    payload = stone_map(CONTRADICTORY, summary="יש 5 ממדים אדומים במפה.")
    result = grade_summary_grounding(payload, CONTRADICTORY)
    assert result.score == 0.0


def test_counting_answers_is_not_read_as_counting_dimensions():
    """The real 2026-08-05 run, where the summary counted answers correctly.

    `uniformly-healthy` has eight green dimensions and twenty answers, of which
    eighteen were green. Without the noun in the predicate, "18 green answers"
    scored as a claim that eighteen dimensions are green.
    """
    payload = stone_map(
        HEALTHY,
        summary="המפה כוללת 18 תשובות ירוקות ו-2 תשובות צהובות מתוך 20.",
    )
    result = grade_summary_grounding(payload, HEALTHY)
    assert result.measured["claims"] == 0
    assert result.score == 1.0


def test_a_number_does_not_reach_the_noun_of_the_next_clause():
    """The run of 2026-08-05, after the prompts were tightened.

    "(score 28, with 18 red answers and 2 yellow) and the certainty dimension"
    put `ממד` two words after the 2 — across a closing bracket, in the next
    clause — and the grader read it as a claim that two dimensions are yellow.
    """
    payload = stone_map(
        CONTRADICTORY,
        summary=(
            "ובראשם ממד העורף המקצועי (ציון 28, עם 18 תשובות אדומות "
            "ו-2 צהובות) וממד הוודאות."
        ),
    )
    result = grade_summary_grounding(payload, CONTRADICTORY)
    assert result.measured["claims"] == 0
    assert result.score == 1.0


def test_counting_answers_in_words_is_not_read_as_dimensions_either():
    payload = stone_map(HEALTHY, summary="שלוש תשובות ירוקות עלו בשאלה הזאת.")
    result = grade_summary_grounding(payload, HEALTHY)
    assert result.measured["claims"] == 0


def test_a_summary_that_counts_nothing_is_not_penalised():
    payload = stone_map(HEALTHY, summary="התמונה הכללית יציבה ומעודדת.")
    result = grade_summary_grounding(payload, HEALTHY)
    assert result.score == 1.0
    assert result.measured["claims"] == 0


# --- overreach --------------------------------------------------------------


def test_clean_copy_has_no_overreach():
    result = grade_no_overreach(stone_map(HEALTHY), HEALTHY)
    assert result.score == 1.0
    assert result.findings == ()


def test_a_clinical_term_costs_more_than_a_causal_claim():
    clinical = grade_no_overreach(
        stone_map(HEALTHY, summary="הצוות סובל משחיקה."), HEALTHY
    )
    causal = grade_no_overreach(
        stone_map(HEALTHY, summary="התוצאה נמוכה בגלל העומס."), HEALTHY
    )
    assert clinical.score < causal.score < 1.0
    assert clinical.measured["clinicalTerms"] == 1
    assert causal.measured["assertedCauses"] == 1


def test_overreach_is_measured_inside_a_recommendation_too():
    def interventions(dimension_id, status):
        return [
            {
                "id": f"{dimension_id}-1",
                "dimensionId": dimension_id,
                "status": status,
                "title": f"מהלך {dimension_id}",
                "summary": "המצב נובע מהתנהלות ההנהלה.",
            }
        ]

    result = grade_no_overreach(
        stone_map(HEALTHY, interventions_for=interventions), HEALTHY
    )
    assert result.measured["assertedCauses"] == 8
    # Eight asserted causes is as bad as this grader reports; the exact floor
    # is a scale choice, so the assertion is on the verdict, not the decimal.
    assert result.score < 0.1


@pytest.mark.parametrize(
    "innocent",
    [
        # "בעקביות" — consistently — contains the causal "עקב". Reported on
        # every stone of the shared V6 fixture by the first version.
        "הצוות מיישם את המהלך בעקביות ונדרשת עקביות גם בשיח.",
        # "מעקב" — follow-up — is not "מ" plus "עקב", and the service's own
        # deterministic copy says it in nearly every round. Reported by the
        # second version, on real provider output.
        "בממד איזון התמונה מצביעה על תחום שאינו אחיד ודורש מעקב.",
    ],
    ids=["consistently", "follow-up"],
)
def test_a_word_that_merely_contains_a_causal_term_is_not_a_finding(innocent):
    result = grade_no_overreach(stone_map(HEALTHY, summary=innocent), HEALTHY)
    assert result.score == 1.0
    assert result.findings == ()


def test_a_genuine_causal_word_still_is_a_finding():
    # The boundary rules must not have quietly disabled the term itself.
    guilty = "הציון בממד ירד עקב העומס בתקופה זו."
    result = grade_no_overreach(stone_map(HEALTHY, summary=guilty), HEALTHY)
    assert result.measured["assertedCauses"] == 1


# --- specificity ------------------------------------------------------------


def test_a_narrative_about_the_round_s_own_questions_scores_well():
    def narrative(dimension_id):
        return " ".join(QUESTION_TEXTS_HEBREW[dimension_id])

    result = grade_evidence_specificity(
        stone_map(HEALTHY, narrative_for=narrative), HEALTHY
    )
    assert result.score == 1.0
    assert result.findings == ()


def test_boilerplate_that_would_fit_any_school_scores_badly():
    result = grade_evidence_specificity(stone_map(HEALTHY), HEALTHY)
    assert result.score < 0.3
    # Six of eight share nothing at all; the other two collide by accident on
    # a common word, which is the noise floor of a word-overlap measure.
    assert len(result.findings) >= 6


# --- distinctness -----------------------------------------------------------


def test_eight_different_narratives_are_distinct():
    def narrative(dimension_id):
        return " ".join(QUESTION_TEXTS_HEBREW[dimension_id])

    result = grade_distinctness(
        stone_map(HEALTHY, narrative_for=narrative), HEALTHY
    )
    assert result.score > 0.8
    assert result.findings == ()


def test_one_paragraph_written_eight_times_is_caught():
    result = grade_distinctness(stone_map(HEALTHY), HEALTHY)
    assert result.score == 0.0
    assert result.measured["maxSimilarity"] == 1.0
    # Every pair of the eight is reported, not just the first.
    assert len(result.findings) == 28


# --- recommendation fit -----------------------------------------------------


def _fitting(dimension_id, status):
    return [
        {
            "id": f"{dimension_id}-{index}",
            "dimensionId": dimension_id,
            "status": status,
            "title": f"מהלך {index} עבור {dimension_id}",
            "summary": "תיאור קצר.",
        }
        for index in range(1, 4)
    ]


def test_recommendations_filed_under_their_own_dimension_fit():
    result = grade_recommendation_fit(
        stone_map(HEALTHY, interventions_for=_fitting), HEALTHY
    )
    assert result.score == 1.0
    assert result.measured["recommendations"] == 24


def test_a_recommendation_from_another_dimension_is_caught():
    def misfiled(dimension_id, status):
        entries = _fitting(dimension_id, status)
        entries[0] = {**entries[0], "dimensionId": "balance"}
        return entries

    result = grade_recommendation_fit(
        stone_map(CONTRADICTORY, interventions_for=misfiled), CONTRADICTORY
    )
    assert result.score < 1.0
    assert result.measured["misfiled"] >= 7


def test_five_copies_of_one_recommendation_are_caught():
    def repeated(dimension_id, status):
        return [
            {
                "id": f"{dimension_id}-{index}",
                "dimensionId": dimension_id,
                "status": status,
                "title": "מהלך צוותי ממוקד",
                "summary": "תיאור קצר.",
            }
            for index in range(1, 6)
        ]

    result = grade_recommendation_fit(
        stone_map(HEALTHY, interventions_for=repeated), HEALTHY
    )
    # Four of every five entries repeat a title, in all eight dimensions.
    assert result.measured["repeatedTitles"] == 32
    assert result.score < 0.25


# --- the report -------------------------------------------------------------


def test_the_same_payloads_produce_the_same_report():
    payloads = [stone_map(case) for case in (HEALTHY, CONTRADICTORY)]
    first = render(
        build_report(
            [grade_payload(p, case_for_round_id(p["roundId"])) for p in payloads]
        )
    )
    second = render(
        build_report(
            [grade_payload(p, case_for_round_id(p["roundId"])) for p in payloads]
        )
    )
    assert first == second
    assert "meanScore" in json.loads(first)


def test_a_payload_with_no_matching_case_is_reported_not_dropped(tmp_path, capsys):
    stray = tmp_path / "stray.json"
    stray.write_text(
        json.dumps({"roundId": "round-from-somewhere-else", "stones": {}}),
        encoding="utf-8",
    )

    assert main([str(stray)]) == 0
    captured = capsys.readouterr()
    assert "skipped 1 payload" in captured.err
    assert json.loads(captured.out)["cases"] == []


def test_emitting_inputs_writes_one_file_per_case(tmp_path, capsys):
    assert main(["--emit-inputs", str(tmp_path)]) == 0
    capsys.readouterr()
    written = sorted(path.stem for path in tmp_path.glob("*.json"))
    assert written == sorted(case.case_id for case in CASES)


# --- against a payload nobody wrote for these graders -----------------------


def test_the_shared_callback_fixture_is_scored_as_the_filler_it_is():
    """The V6 fixture in `contracts/fixtures` repeats one sentence everywhere.

    It is a contract fixture, so it is deliberately not good Hebrew analysis —
    which makes it the honest check that these graders fire on a payload that
    was not written to make them fire.
    """
    corpus_path = (
        Path(__file__).resolve().parents[2]
        / "contracts"
        / "fixtures"
        / "callback_corpus.json"
    )
    corpus = json.loads(corpus_path.read_text(encoding="utf-8"))
    payload = next(
        case["payload"]
        for case in corpus["accepted"]
        if case["contractVersion"] == "6.0"
    )

    # Any case will do as the evidence side; what is being checked is that the
    # text-only graders notice repeated filler.
    distinctness = grade_distinctness(payload, HEALTHY)
    specificity = grade_evidence_specificity(payload, HEALTHY)

    assert distinctness.score < 0.2, distinctness.measured
    assert specificity.score < 0.5, specificity.measured


# --- the provider run -------------------------------------------------------


def test_an_env_file_supplies_names_without_overwriting_the_environment(
    tmp_path, monkeypatch
):
    from evals.run_corpus import load_env_file

    env_file = tmp_path / ".env"
    env_file.write_text(
        "# a comment\nALREADY_SET=from-file\nFRESH=\"from-file\"\n",
        encoding="utf-8",
    )
    monkeypatch.setenv("ALREADY_SET", "from-shell")

    names = load_env_file(env_file)

    assert sorted(names) == ["ALREADY_SET", "FRESH"]
    # An exported value wins, so a stale file cannot swap the key under a run.
    assert os.environ["ALREADY_SET"] == "from-shell"
    assert os.environ["FRESH"] == "from-file"


def test_a_run_without_a_provider_key_refuses_instead_of_faking_it(
    tmp_path, monkeypatch, capsys
):
    """The mistake this exists for was made while building it.

    `src.config` builds its settings singleton on import and the provider reads
    the key from it once, so importing the service before loading the env file
    leaves the run keyless. That does not fail: every dimension falls back to
    deterministic copy, the round comes back `success`, and the payloads look
    like evidence about the prompts while containing none.
    """
    from src.config import settings
    from evals.run_corpus import main as run_corpus_main

    monkeypatch.setattr(settings, "llm_api_key", "", raising=False)

    exit_code = run_corpus_main(
        [
            "--out",
            str(tmp_path / "payloads"),
            "--cases",
            "uniformly-healthy",
            "--env-file",
            str(tmp_path / "absent.env"),
        ]
    )

    assert exit_code == 2
    assert "refusing to run" in capsys.readouterr().err
    assert not (tmp_path / "payloads").exists()
