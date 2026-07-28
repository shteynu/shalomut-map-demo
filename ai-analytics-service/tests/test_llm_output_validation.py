"""What the validators may and may not cost the school.

Every rejection here ends the same way: the dimension falls back to catalog or
heuristic copy and the round reads as if the model had never answered. These
tests separate the rejections that protect the reader — truncation, invented
verdicts, foreign languages — from the ones that used to punish a model for
bolding a sentence or quoting an average with one decimal.
"""
import json

import pytest

from src.config import settings
from src.rag.store import LocalInterventionVectorStore
from src.services.llm_provider import (
    _LATIN_PATTERN,
    llm_provider_service,
)

TWO_SENTENCES = (
    "הנתונים מצביעים על עומס מתמשך בקרב הצוות. "
    "מומלץ לבחון מחדש את חלוקת המשימות."
)

AGGREGATES = [
    {
        "questionId": "balance-q1",
        "dimensionId": "balance",
        "questionText": "אני מצליח לסיים את המשימות בזמן",
        "averageScore": 45.5,
        "responseCount": 20,
        "scoreDistribution": {"green": 4, "yellow": 12, "red": 4},
    },
]

DIMENSION_SCORES = {
    "balance": {"averageScore": 45.5, "computedStatus": "yellow"},
    "meaning": {"averageScore": 78.4, "computedStatus": "green"},
}


# --- formatting that must no longer cost a fallback -------------------------

@pytest.mark.parametrize(
    "label,text",
    [
        (
            "an average quoted with one decimal",
            "הציון הממוצע בממד הוא 45.5 מתוך 100. "
            "הנתונים מצביעים על צורך בתשומת לב.",
        ),
        (
            "two decimals in the same answer",
            "הציון בשאלה הראשונה הוא 45.5 מתוך 100. "
            "בשאלה השנייה הממוצע הוא 52.5 מתוך 100.",
        ),
        (
            "a bolded conclusion at the end",
            "הנתונים מצביעים על עומס מתמשך. **מומלץ לבחון את חלוקת המשימות.**",
        ),
        (
            "a quoted last word",
            'הנתונים מצביעים על עומס מתמשך. המורים תיארו זאת כ"שחיקה יומיומית."',
        ),
        (
            "a fenced answer",
            "```\nהנתונים מצביעים על עומס מתמשך. "
            "מומלץ לבחון את חלוקת המשימות.\n```",
        ),
        (
            "a heading above the answer",
            "## סיכום\nהנתונים מצביעים על עומס מתמשך. "
            "מומלץ לבחון את חלוקת המשימות.",
        ),
    ],
)
def test_model_formatting_is_cleaned_rather_than_refused(label, text):
    assert llm_provider_service.is_complete_hebrew_copy(
        text,
        contract_version="4.0",
    ), label


def test_the_cleaned_text_is_what_the_school_would_read():
    """Sanitising only for the check would persist the asterisks."""
    cleaned = llm_provider_service._sanitize_model_text(
        "**הנתונים מצביעים על עומס מתמשך.** מומלץ לבחון את חלוקת המשימות.",
    )

    assert "*" not in cleaned
    assert cleaned.startswith("הנתונים")


def test_a_decimal_does_not_inflate_the_sentence_count():
    sentences = llm_provider_service._sentences(
        "הציון הוא 45.5 מתוך 100. הנתונים מצביעים על צורך בתשומת לב.",
    )

    assert len(sentences) == 2


# --- rejections that still have to hold -------------------------------------

@pytest.mark.parametrize(
    "label,text",
    [
        (
            "a truncated last sentence",
            "הנתונים מצביעים על עומס מתמשך. מומלץ לבחון את חלוקת",
        ),
        (
            "a single sentence on 4.0",
            "הנתונים מצביעים על עומס מתמשך בקרב הצוות.",
        ),
        (
            "a latin dimension id echoed from a prompt",
            "בממד איזון (balance) נמצאה ירידה. מומלץ לבחון את העומס.",
        ),
        (
            "an english preamble",
            "Here is the analysis. הנתונים מצביעים על עומס. מומלץ לבחון אותו.",
        ),
        (
            "no Hebrew at all",
            "The data shows a sustained workload. Consider rebalancing.",
        ),
    ],
)
def test_output_that_must_still_be_refused(label, text):
    assert not llm_provider_service.is_complete_hebrew_copy(
        text,
        contract_version="4.0",
    ), label


def test_the_sentence_budget_still_binds_on_five_zero():
    six = " ".join([f"משפט מספר {n} על הנתונים." for n in range(1, 7)])

    assert not llm_provider_service.is_complete_hebrew_copy(
        six,
        contract_version="5.0",
    )
    assert llm_provider_service.is_complete_hebrew_copy(
        TWO_SENTENCES,
        contract_version="5.0",
    )


def test_a_verdict_in_another_colour_is_still_refused_on_five_zero():
    counts = llm_provider_service.distribution_counts(AGGREGATES)

    assert not llm_provider_service.is_status_consistent(
        "הממוצע נמוך מהצפוי. הממד נמצא באזור אדום עם 4 משיבים.",
        "yellow",
        contract_version="5.0",
        distribution_counts=counts,
    )
    assert llm_provider_service.is_status_consistent(
        "רוב המשיבים דיווחו על עומס בינוני. "
        "4 משיבים בחרו בתשובה אדום בשאלת העומס.",
        "yellow",
        contract_version="5.0",
        distribution_counts=counts,
    )


def test_a_spelled_out_count_beside_a_foreign_colour_is_refused():
    """Known limit, kept explicit rather than discovered in production.

    The rule that lets 5.0 name another bucket is "the sentence carries a
    matching count", and the count is read as digits. A model that writes the
    number in words is refused, which is why every prompt asks for digits.
    """
    assert not llm_provider_service.is_status_consistent(
        "רוב המשיבים דיווחו על עומס בינוני. "
        "ארבעה משיבים בחרו בתשובה אדום בשאלת העומס.",
        "yellow",
        contract_version="5.0",
        distribution_counts=llm_provider_service.distribution_counts(AGGREGATES),
    )


# --- the prompts themselves --------------------------------------------------

def _interpretation_prompt(contract_version: str) -> str:
    return llm_provider_service._build_prompt(
        dim_id="balance",
        dim_hebrew="איזון",
        score=45.5,
        status="yellow",
        question_aggregates=AGGREGATES,
        background_context={"notes": "שנה ראשונה של מנהלת חדשה", "audience": "כלל הצוות"},
        contract_version=contract_version,
        all_dimension_scores=DIMENSION_SCORES,
    )


@pytest.mark.parametrize("contract_version", ["3.0", "4.0", "5.0"])
def test_no_prompt_hands_the_model_a_latin_word_to_copy(contract_version):
    """The copy is refused for one Latin letter, so the prompt carries none.

    Status names, dimension ids and section headings used to arrive in English
    next to an instruction to answer in Hebrew.
    """
    prompt = _interpretation_prompt(contract_version)

    assert not _LATIN_PATTERN.search(prompt), prompt


def test_the_summary_and_adaptation_prompts_carry_no_latin_either():
    summary_prompt = llm_provider_service._build_overall_summary_prompt(
        DIMENSION_SCORES,
        AGGREGATES,
        {"notes": "שנה ראשונה של מנהלת חדשה"},
    )
    store = LocalInterventionVectorStore()
    intervention = store.get_interventions_for_dimension(
        "balance",
        "yellow",
    )[0].to_dict()
    adaptation_prompt = llm_provider_service._build_adaptation_prompt(
        intervention=intervention,
        dim_hebrew="איזון",
        score=45.5,
        status="yellow",
        question_aggregates=AGGREGATES,
        background_context=None,
    )

    assert not _LATIN_PATTERN.search(summary_prompt), summary_prompt
    assert not _LATIN_PATTERN.search(adaptation_prompt), adaptation_prompt


def test_scores_reach_the_model_as_integers():
    """A decimal in the prompt is a decimal in the answer, quoted back."""
    prompt = _interpretation_prompt("5.0")

    assert "45.5" not in prompt
    assert "ציון: 46 מתוך 100" in prompt or "ציון: 45 מתוך 100" in prompt


# --- end to end through the transport ---------------------------------------

def _response(content: str):
    class _Response:
        status = 200

        def __enter__(self):
            return self

        def __exit__(self, *args):
            return False

        def read(self):
            return json.dumps(
                {
                    "choices": [
                        {
                            "finish_reason": "stop",
                            "message": {"content": content},
                        },
                    ],
                },
            ).encode("utf-8")

    return _Response()


def test_a_bolded_answer_is_accepted_and_stored_clean(monkeypatch):
    monkeypatch.setattr(settings, "llm_api_key", "sk-test-validation")
    monkeypatch.setattr(settings, "llm_base_url", "https://provider.local/v1")
    monkeypatch.setattr(settings, "llm_max_attempts", 1)
    monkeypatch.setattr(settings, "only_llm_for_problematic", False, raising=False)
    monkeypatch.setattr(
        "urllib.request.urlopen",
        lambda request, timeout=None: _response(
            "**הציון הממוצע בממד הוא 45.5 מתוך 100.** "
            "מומלץ לבחון מחדש את חלוקת המשימות.",
        ),
    )

    result = llm_provider_service.generate_psychological_interpretation_result(
        dim_id="balance",
        dim_hebrew="איזון",
        score=45.5,
        status="yellow",
        question_aggregates=AGGREGATES,
        contract_version="4.0",
    )

    assert result.outcome == "llm"
    assert result.attempts == 1
    assert "*" not in result.text
    assert "45.5" in result.text
