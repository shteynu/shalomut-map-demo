"""What the validators may and may not cost the school.

Every rejection here ends the same way: the dimension falls back to catalog or
heuristic copy and the round reads as if the model had never answered. These
tests separate the rejections that protect the reader — truncation, invented
verdicts, foreign languages — from the ones that used to punish a model for
bolding a sentence or quoting an average with one decimal.
"""
import json
import re
from pathlib import Path

import pytest

from src.config import settings
from src.rag.store import LocalInterventionVectorStore
from src.services import hebrew_prompts, hebrew_validation
from src.services.hebrew_validation import _HEBREW_PATTERN
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


# --- what a refused batch is told --------------------------------------------

V6_ENTRIES = [
    {
        "id": "kb-bala-y-01",
        "dimensionId": "balance",
        "status": "yellow",
        "title": "חלוקת משימות",
        "summary": "חלוקה מחדש של משימות בין חברי הצוות.",
        "actionable_steps": ["מיפוי משימות", "שיחה עם הצוות"],
    },
]


def _v6_batch(summary: str, *, entry_id: str = "kb-bala-y-01", steps=None):
    return json.dumps(
        [
            {
                "id": entry_id,
                "summary": summary,
                "actionable_steps": (
                    ["מיפוי משימות", "שיחה עם הצוות"] if steps is None else steps
                ),
            },
        ],
        ensure_ascii=False,
    )


GOOD_V6_SUMMARY = (
    "ההמלצה מתאימה לממד האיזון משום שהיא מתרגמת את האות המצרפי לפעולה "
    "ארגונית מוגדרת, בלי לייחס סיבה לאדם מסוים ובלי לחשוף תשובות אישיות. "
    "היא נשענת על התמונה המצרפית של השאלות שנכללו בסבב ומציעה צעד שאפשר "
    "לזהות בשגרה השבועית של הצוות. כדאי לקבוע אחראי, מסגרת זמן ונקודת "
    "בדיקה מוסכמת, ולאסוף משוב כללי שמאפשר ללמוד אם השינוי מורגש בקרב "
    "הצוות לאורך זמן."
)


@pytest.mark.parametrize(
    "label,candidate",
    [
        ("entry_shape", "לא JSON כלל"),
        ("entry_shape", json.dumps([], ensure_ascii=False)),
        ("identity", _v6_batch(GOOD_V6_SUMMARY, entry_id="kb-other-99")),
        ("not_hebrew", _v6_batch(GOOD_V6_SUMMARY.replace("ההמלצה", "The rec"))),
        ("visible_number", _v6_batch(GOOD_V6_SUMMARY.replace("ההמלצה", "41"))),
        ("narrative_length", _v6_batch("קצר מדי.")),
    ],
)
def test_a_refused_v6_batch_says_which_gate_closed(label, candidate):
    """Five failures used to arrive as one None, which a retry cannot act on."""
    refusal = hebrew_validation.v6_intervention_batch_refusal(
        candidate,
        interventions=V6_ENTRIES,
        status="yellow",
    )

    assert refusal.label == label, refusal


def test_an_acceptable_v6_batch_refuses_nothing():
    refusal = hebrew_validation.v6_intervention_batch_refusal(
        _v6_batch(GOOD_V6_SUMMARY),
        interventions=V6_ENTRIES,
        status="yellow",
    )

    assert not refusal
    assert hebrew_validation.parse_v6_intervention_batch(
        _v6_batch(GOOD_V6_SUMMARY),
        interventions=V6_ENTRIES,
        status="yellow",
    ) is not None


def test_every_refusal_label_has_a_line_that_says_what_to_do():
    """A critique naming the failure without naming the fix is not a critique."""
    for label in (
        "entry_shape",
        "identity",
        "not_hebrew",
        "visible_number",
        "narrative_length",
        "no_number",
        "status_inconsistent",
    ):
        line = hebrew_prompts.batch_retry_critique(label)
        assert line, label
        assert not _LATIN_PATTERN.search(line), label

    # A truncated answer or a provider error is not something to advise about.
    assert hebrew_prompts.batch_retry_critique("finish_length") is None
    assert hebrew_prompts.batch_retry_critique("") is None


def test_the_v6_batch_prompt_carries_the_critique_it_is_given():
    plain = hebrew_prompts.v6_intervention_batch_prompt(
        interventions=V6_ENTRIES,
        dim_hebrew="איזון",
        status="yellow",
        question_aggregates=AGGREGATES,
    )
    repaired = hebrew_prompts.v6_intervention_batch_prompt(
        interventions=V6_ENTRIES,
        dim_hebrew="איזון",
        status="yellow",
        question_aggregates=AGGREGATES,
        repair_critique=hebrew_prompts.batch_retry_critique("no_number"),
    )

    assert repaired.startswith(plain)
    assert "לפחות מספר אחד" in repaired


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
    interventions = [
        entry.to_dict()
        for entry in store.get_interventions_for_dimension("balance", "yellow")
    ]
    # The batched prompt is the one a round actually sends, so it is the one
    # that has to be free of Latin letters.
    adaptation_prompt = hebrew_prompts.adaptation_batch_prompt(
        interventions=interventions,
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


def test_the_5_0_prompt_forbids_adding_two_buckets_into_one_claim():
    """Arithmetic the model can do is not a claim it may make.

    Shown 8 green, 9 yellow and 3 red on one question, `gemini-3.5-flash-lite`
    wrote "12 of 20 reported a lack of support" (2026-07-29). The sum is real
    and the sentence is false — yellow is attention, not absence — and nothing
    downstream catches a number that was merely added up wrong.
    """
    prompt = _interpretation_prompt("5.0")

    assert "אל תחבר קבוצות צבע או שאלות שונות" in prompt
    assert "צהוב מסמן מעקב ולא חוסר" in prompt


@pytest.mark.parametrize("contract_version", ["3.0", "4.0"])
def test_a_closed_contract_keeps_the_prompt_it_was_written_with(
    contract_version,
):
    """The rule belongs to the version that shows the buckets, and only to it.

    1.0-4.0 never carry a distribution into the prompt, so the instruction
    would be about numbers that are not there — and their stored results have
    to keep meaning what they meant when they were written.
    """
    prompt = _interpretation_prompt(contract_version)

    assert "אל תחבר קבוצות צבע" not in prompt
    assert "ירוק" not in prompt


def test_the_summary_prompt_states_that_buckets_are_answers_not_people():
    """A dimension of two questions has more answers than the school has staff.

    The buckets are summed over the dimension's questions, so on a twenty-
    respondent round `gemini-3.5-flash-lite` reported "21 staff members in the
    red zone" (2026-07-29) — one more person than answered the survey. The
    round summary is checked for Hebrew and nothing else, so the prompt is
    where this is stopped.
    """
    prompt = llm_provider_service._build_overall_summary_prompt(
        DIMENSION_SCORES,
        AGGREGATES,
        None,
    )

    assert "מספרי הפיזור הם תשובות ולא משיבים" in prompt
    assert "אל תציג אותם כמספר אנשי צוות" in prompt
    # The total is stated next to the buckets, so the denominator is the
    # prompt's own number rather than one the model has to infer.
    total = sum(
        aggregate["scoreDistribution"][bucket]
        for aggregate in AGGREGATES
        for bucket in ("green", "yellow", "red")
    )
    assert f"מתוך {total} תשובות" in prompt


def test_the_adaptation_prompt_asks_for_the_recommendation_not_a_report():
    """The summary line is what a manager reads, not a note about the rewrite.

    Asked only to "rephrase", `gemini-3.5-flash-lite` opened a block with
    "adapting recommendations to reduce the load" (2026-07-29) — the task
    description, on the dashboard, in place of the advice.
    """
    store = LocalInterventionVectorStore()
    interventions = [
        entry.to_dict()
        for entry in store.get_interventions_for_dimension("balance", "red")
    ]

    prompt = hebrew_prompts.adaptation_batch_prompt(
        interventions=interventions,
        dim_hebrew="איזון",
        score=38.5,
        status="red",
        question_aggregates=AGGREGATES,
        background_context=None,
    )

    assert "התקציר הוא ההמלצה עצמה" in prompt
    assert "אל תזכיר את הקטלוג" in prompt


def test_the_adaptation_prompt_asks_for_digits_where_it_asks_for_a_number():
    """The rule lives on the line it governs, with an example.

    Stated once at the end of a long instruction, it was not followed: on
    2026-07-29 `certainty` answered "only one respondent in ten" in words, the
    summary carried no digit, and all three of its recommendations fell back to
    catalog copy over it.
    """
    store = LocalInterventionVectorStore()
    interventions = [
        entry.to_dict()
        for entry in store.get_interventions_for_dimension("balance", "red")
    ]

    prompt = hebrew_prompts.adaptation_batch_prompt(
        interventions=interventions,
        dim_hebrew="איזון",
        score=38.5,
        status="red",
        question_aggregates=AGGREGATES,
        background_context=None,
    )

    assert "מספר אחד מהנתונים שלמעלה בספרות" in prompt
    assert "ולא במילים" in prompt


def test_the_adaptation_prompt_asks_for_the_count_beside_the_colour():
    """A colour named without its count reads as a verdict to the validator.

    `certainty` wrote "and the absence of green answers in that item" — true,
    useful, and unverifiable: `is_status_consistent` clears a foreign colour
    only where the same sentence carries one of the distribution counts in
    digits, and "absence" is not one. The count is better copy anyway.
    """
    store = LocalInterventionVectorStore()
    interventions = [
        entry.to_dict()
        for entry in store.get_interventions_for_dimension("balance", "red")
    ]

    prompt = hebrew_prompts.adaptation_batch_prompt(
        interventions=interventions,
        dim_hebrew="איזון",
        score=38.5,
        status="red",
        question_aggregates=AGGREGATES,
        background_context=None,
    )

    assert "כשאתה מזכיר קבוצת צבע" in prompt
    assert "0 תשובות ירוקות" in prompt


def _every_round_prompt() -> dict[str, str]:
    """Every prompt that writes prose a manager reads about a round.

    `question_suggestion_prompt` is deliberately absent: it carries no round,
    no aggregates and no school, and nothing it writes is about respondents.
    """
    store = LocalInterventionVectorStore()
    interventions = [
        entry.to_dict()
        for entry in store.get_interventions_for_dimension("balance", "red")
    ]
    return {
        "interpretation": _interpretation_prompt("5.0"),
        "overall_summary": llm_provider_service._build_overall_summary_prompt(
            DIMENSION_SCORES,
            AGGREGATES,
            None,
        ),
        "v6_structured_summary": hebrew_prompts.v6_structured_summary_prompt(
            dim_hebrew="איזון",
            status="red",
            question_aggregates=AGGREGATES,
        ),
        "v6_metric_insights": hebrew_prompts.v6_metric_insights_prompt(
            dim_hebrew="איזון",
            status="red",
            question_aggregates=AGGREGATES,
        ),
        "v6_intervention_batch": hebrew_prompts.v6_intervention_batch_prompt(
            interventions=interventions,
            dim_hebrew="איזון",
            status="red",
            question_aggregates=AGGREGATES,
        ),
        "adaptation_batch": hebrew_prompts.adaptation_batch_prompt(
            interventions=interventions,
            dim_hebrew="איזון",
            score=38.5,
            status="red",
            question_aggregates=AGGREGATES,
            background_context=None,
        ),
    }


def test_every_round_prompt_forbids_clinical_words_and_asserted_causes():
    """The corpus run of 2026-08-05 found both in every unlocked case.

    "Do not invent causes or diagnoses" was already in all of these prompts and
    produced 21 clinical terms and 9 asserted causes anyway, so the rule now
    names the words. A prompt added later without it would put the finding back
    without anything failing, which is what this test is for.
    """
    for name, prompt in _every_round_prompt().items():
        assert hebrew_prompts.NO_CLINICAL_TERMS_RULE in prompt, name
        assert hebrew_prompts.NO_ASSERTED_CAUSE_RULE in prompt, name


def test_the_rules_name_the_words_the_grader_looks_for():
    """The prompt and the measurement have to be about the same words.

    A term forbidden in prose the grader does not look for is unmeasured; a
    term the grader flags that no prompt forbids is a finding nobody asked the
    model to avoid. This keeps the two lists in contact — not identical, since
    the grader's list is deliberately wider than what one prompt can recite.
    """
    from evals.graders import CAUSAL_PHRASES_HEBREW, CLINICAL_TERMS_HEBREW

    named_clinical = [
        term for term in CLINICAL_TERMS_HEBREW
        if term in hebrew_prompts.NO_CLINICAL_TERMS_RULE
    ]
    named_causal = [
        phrase for phrase in CAUSAL_PHRASES_HEBREW
        if phrase in hebrew_prompts.NO_ASSERTED_CAUSE_RULE
    ]

    # Every word the 2026-08-05 run actually produced is named.
    assert "שחיקה" in named_clinical
    assert {"עקב", "בגלל"} <= set(named_causal)
    assert len(named_clinical) >= 6
    assert len(named_causal) >= 5


# --- Hebrew that is only nearly Hebrew ---------------------------------------

def test_a_hebrew_word_wearing_one_arabic_letter_is_repaired():
    """The word the model meant is not in doubt, so it is not thrown away.

    `certainty` wrote `אי وדאות` twice on 2026-07-30 with an Arabic waw where
    the vav belongs. Refusing it costs that dimension all three of its
    recommendations; the reader would have got a broken word either way.
    """
    repaired = hebrew_validation.sanitize_model_text("אי وדאות בקרב הצוות.")

    assert repaired == "אי ודאות בקרב הצוות."
    assert hebrew_validation.is_hebrew_only_copy(repaired)


@pytest.mark.parametrize(
    "label,text",
    [
        # A word with no Hebrew in it is another language, not a typo: the
        # repair must leave it for the validator to refuse.
        ("a whole Arabic word", "הצוות وقت בבית הספר."),
        ("a Cyrillic word", "הצוות команда בבית הספר."),
        ("Latin, which was always refused", "הצוות meeting בבית הספר."),
    ],
)
def test_a_word_in_another_script_is_still_refused(label, text):
    """One named script was refused and every other one was not.

    The old check looked for Latin and nothing else, so a sentence in Cyrillic
    passed as long as a single Hebrew letter stood somewhere in it.
    """
    assert not hebrew_validation.is_hebrew_only_copy(
        hebrew_validation.sanitize_model_text(text),
    )


@pytest.mark.parametrize(
    "label,text",
    [
        ("a presentation form of a pointed letter", "הצוות שׁלום בבית הספר."),
        ("digits, a decimal and punctuation", "הציון 45.5 מתוך 100 בממד."),
        ("Hebrew points and a geresh", "שָׁלוֹם ל־30 אנשי צוות׳"),
    ],
)
def test_what_a_letter_is_not(label, text):
    """The tightening judges letters, and most of what a model adds is not one.

    Refusing any of these would trade the hole that was closed for a new way
    to lose a dimension to catalog copy.
    """
    assert hebrew_validation.is_hebrew_only_copy(text)


def test_the_catalog_survives_the_hebrew_check():
    """The deterministic fallback is judged by this check too.

    `nodes.py` re-runs `is_hebrew_only_copy` over stored copy, catalog entries
    included, and a failure there fails the whole round rather than one
    dimension. One stray letter in a human-written entry would turn the
    tightening into an outage, so the catalog is held to it here.
    """
    catalog = json.loads(
        (Path(__file__).resolve().parents[1] / "data" / "interventions_kb.json")
        .read_text(encoding="utf-8"),
    )

    offenders = [
        (entry["id"], field, text)
        for entry in catalog
        # `source` cites institutions in Latin by design and is not copy the
        # safety validator judges.
        for field in ("title", "summary")
        for text in [entry[field]]
        if not hebrew_validation.is_hebrew_only_copy(text)
    ] + [
        (entry["id"], "actionable_steps", step)
        for entry in catalog
        for step in entry.get("actionable_steps", [])
        if not hebrew_validation.is_hebrew_only_copy(step)
    ]

    assert offenders == []
    assert len(catalog) == 192


# --- the adaptation batch, and what it survives ------------------------------

_SUMMARY = "לפי 12 התשובות העומס מתרכז בסוף השבוע."
_STEP = "לקיים מפגש צוות קצר לתעדוף המשימות."


def _batch(separator: str, entries: int = 3, steps: int = 2) -> str:
    block = "\n".join([_SUMMARY] + [f"- {_STEP}"] * steps)
    return separator.join([block] * entries)


def test_a_batch_that_forgot_its_separators_is_read_by_shape():
    """Three good recommendations are not thrown away over a punctuation line.

    `professional-competence` answered on 2026-07-29 with nine correct lines —
    three summaries, two steps under each — and no `===` anywhere, and the
    school got the catalog paragraph instead. A step always carries a bullet
    and a summary never does, so the entries are where they always were.
    """
    parsed = hebrew_validation.parse_adaptation_batch(
        _batch("\n"),
        [2, 2, 2],
    )

    assert parsed is not None
    assert len(parsed) == 3
    assert all(summary == _SUMMARY for summary, _ in parsed)
    assert all(steps == [_STEP, _STEP] for _, steps in parsed)


def test_the_separator_still_wins_where_it_is_present():
    """Shape is the fallback, not the rule: a well-formed answer is unaffected."""
    parsed = hebrew_validation.parse_adaptation_batch(
        _batch("\n===\n"),
        [2, 2, 2],
    )

    assert parsed is not None
    assert len(parsed) == 3


def test_an_answer_that_opens_with_a_bullet_is_not_guessed_at():
    """Steps with no summary above them belong to no entry.

    Recovering shape must not turn an answer that lost its first line into
    three recommendations attached to whatever came next.
    """
    assert (
        hebrew_validation.parse_adaptation_batch(
            f"- {_STEP}\n{_SUMMARY}\n- {_STEP}",
            [2, 2, 2],
        )
        is None
    )


@pytest.mark.parametrize(
    "answer,expected_label,expected_detail",
    [
        (_batch("\n===\n"), "", ""),
        # Two blocks where three entries were asked for: nothing to attach the
        # third recommendation to, by separator or by shape.
        (
            _batch("\n===\n", entries=2),
            "entry_shape",
            "blocks=2/3 shape_blocks=2 separators=1 lines=6",
        ),
        # The failure of `professional-competence`: nine right lines, no
        # separator. Recovered by shape now, so it reaches no refusal — the
        # detail below is for the case where neither split works.
        (
            _batch("\n"),
            "",
            "",
        ),
        # The separators are right and a block is one line short: a different
        # failure behind the same label, and the detail is what tells them
        # apart without the answer.
        (
            _batch("\n===\n").replace(f"- {_STEP}\n- {_STEP}", f"- {_STEP}", 1),
            "entry_shape",
            "block=1 lines=2/3",
        ),
        # Numbers spelled out: grounded to read, uncheckable against the map.
        # No digits in the steps either, so the model ignored the data rather
        # than putting it one line lower than the rule wants it.
        (
            _batch("\n===\n").replace("12 התשובות", "שתים עשרה התשובות"),
            "no_number",
            "block=1 digits_in_steps=no",
        ),
        (
            _batch("\n===\n").replace("מפגש", "meeting"),
            "not_hebrew",
            "block=1 chars=U+006D,U+0065,U+0074,U+0069+2",
        ),
        # Copy with no Hebrew in it is refused by the same gate, and there is
        # no foreign letter to name: the detail describes what the gate saw
        # rather than standing in for the gate.
        (
            _batch("\n===\n").replace(_SUMMARY, "12 34 56 78."),
            "not_hebrew",
            "block=1 chars=none",
        ),
        # A verdict: the model overruling the score Core owns, which is what
        # this gate is for.
        (
            _batch("\n===\n").replace(
                "העומס מתרכז בסוף השבוע",
                "הממד נמצא באזור אדום",
            ),
            "status_inconsistent",
            "block=1 colour=red verdict=yes",
        ),
        # A colour whose number is not one of the buckets: no verdict, so this
        # is the uncheckable-but-probably-true case of 2026-07-29, which is a
        # prompt problem rather than a guard one. Same label as a verdict, and
        # the detail is what separates them.
        (
            _batch("\n===\n").replace(
                "לפי 12 התשובות העומס מתרכז בסוף השבוע",
                "לפי 30 התשובות אין תשובות ירוקות בשאלה",
            ),
            "status_inconsistent",
            "block=1 colour=green verdict=no numbers=30",
        ),
    ],
)
def test_the_refusal_says_which_gate_closed(
    answer,
    expected_label,
    expected_detail,
):
    """One word per cause, and the shape behind it — never the copy.

    The round of 2026-07-29 dropped six recommendations to catalog copy behind
    a single `invalid_semantic_output`, and two unrelated causes hid there. The
    gate, the dimension and now the shape reach the log. The refused text does
    not, by decision: nine lines of Hebrew truncated into a log line diagnose
    nothing, and the copy is about one school's weakest dimensions.
    """
    refusal = hebrew_validation.adaptation_batch_refusal(
        answer,
        expected_steps_per_entry=[2, 2, 2],
        status="yellow",
        distribution_counts={"12", "4"},
    )

    assert refusal.label == expected_label
    assert refusal.detail == expected_detail
    assert bool(refusal) is bool(expected_label)
    assert hebrew_validation.is_valid_adaptation_batch(
        answer,
        expected_steps_per_entry=[2, 2, 2],
        status="yellow",
        distribution_counts={"12", "4"},
    ) is (expected_label == "")


def test_the_detail_never_carries_the_copy():
    """The decision of item 17, held by a test rather than by a comment.

    Every value in a detail is a count, an index or a code point. If someone
    later reaches for "just a truncated sample", this fails and asks them to
    mean it.
    """
    refusals = [
        hebrew_validation.adaptation_batch_refusal(
            answer,
            expected_steps_per_entry=[2, 2, 2],
            status="yellow",
            distribution_counts={"12", "4"},
        )
        for answer in [
            _batch("\n===\n", entries=2),
            _batch("\n===\n").replace("12 התשובות", "שתים עשרה התשובות"),
            _batch("\n===\n").replace("מפגש", "meeting"),
            _batch("\n===\n").replace(
                "העומס מתרכז בסוף השבוע",
                "הממד נמצא באזור אדום",
            ),
        ]
    ]

    assert all(refusal.label for refusal in refusals)
    for refusal in refusals:
        assert not _HEBREW_PATTERN.search(refusal.detail), refusal
        # A word of the answer would arrive as a run of letters; the details
        # are `key=value` pairs whose values are digits, indices and code
        # points.
        assert all(
            re.fullmatch(r"[a-z_]+=[A-Za-z0-9+,/]*", pair)
            for pair in refusal.detail.split(" ")
        ), refusal


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


def test_a_refused_batch_names_its_gate_and_its_dimension(monkeypatch, caplog):
    """The fallback line has to be enough to act on the next morning.

    On 2026-07-29 it said `invalid_semantic_output` and nothing else, so which
    dimension fell back and what was wrong with its text had to be recovered
    from the database and a re-run against the provider. The refused copy still
    does not reach the log — it is respondent-shaped — but the gate and the
    dimension do, and those are what pick the fix.
    """
    store = LocalInterventionVectorStore()
    interventions = []
    for entry in store.get_interventions_for_dimension("balance", "red"):
        serialized = entry.to_dict()
        serialized["status"] = "red"
        interventions.append(serialized)

    answer = "\n===\n".join(
        "\n".join(
            # Every number spelled out: shaped like an adaptation, grounded in
            # nothing a reader can check.
            ["לפי שתים עשרה התשובות העומס מתרכז בסוף השבוע."]
            + ["- לקיים מפגש צוות קצר לתעדוף המשימות."]
            * len(entry["actionable_steps"])
        )
        for entry in interventions
    )

    monkeypatch.setattr(settings, "llm_api_key", "sk-test-validation")
    monkeypatch.setattr(settings, "llm_base_url", "https://provider.local/v1")
    monkeypatch.setattr(settings, "llm_max_attempts", 1)
    monkeypatch.setattr(
        "urllib.request.urlopen",
        lambda request, timeout=None: _response(answer),
    )

    with caplog.at_level("INFO"):
        adapted = llm_provider_service.adapt_interventions_result(
            interventions=interventions,
            dim_hebrew="איזון",
            score=38.5,
            status="red",
            question_aggregates=AGGREGATES,
        )

    assert [entry.outcome for entry in adapted] == (
        ["deterministic_fallback"] * len(interventions)
    )
    assert [entry.summary for entry in adapted] == [
        entry["summary"] for entry in interventions
    ]

    line = next(
        record.getMessage()
        for record in caplog.records
        if "adaptation=deterministic_fallback" in record.getMessage()
    )
    assert "refusal=no_number" in line
    assert "detail=[block=1 digits_in_steps=no]" in line
    assert "dimension=balance" in line
    # The answer was in the process and did not follow the refusal into the log.
    assert "העומס" not in line


# The V6 summary and metric nodes refused without saying why until 2026-08-09,
# so their retry re-sent an identical prompt. Measured that day on a real round:
# `gemini-3.5-flash-lite` splices Arabic letters into Hebrew words, the
# Hebrew-only gate refused fourteen answers, and one dimension ended on the
# deterministic sentence. With the critique below the same model recovered every
# dimension. These pin the two walkers to the parsers they mirror.

GOOD_V6_NARRATIVE = (
    "בשאלה זו מסתמנת תמונה מצרפית מעורבת, שבה חלק מאנשי הצוות מתארים "
    "התנהלות שגרתית ונוחה ואחרים מדווחים על קושי מתמשך הדורש תשומת לב "
    "ארגונית. הפער בין הקבוצות מצביע על חוויה שאינה אחידה בתוך הצוות, "
    "ולכן כדאי לברר יחד באילו מצבים הקושי מופיע ומה מסייע להתמודד איתו "
    "בשגרה השבועית, בלי לייחס סיבה לאדם מסוים."
)


def _metric_batch(insight: str, question_id: str = "q1") -> str:
    return json.dumps(
        [{"questionId": question_id, "insightText": insight}],
        ensure_ascii=False,
    )


def _summary_batch(paragraph: str) -> str:
    return json.dumps(
        [paragraph, paragraph.replace("תמונה", "תמונת מצב"), paragraph + " כן."],
        ensure_ascii=False,
    )


@pytest.mark.parametrize(
    "answer,expected_label",
    [
        (_metric_batch(GOOD_V6_NARRATIVE), ""),
        # An Arabic jeem inside a Hebrew word — what the lite model actually
        # produced, and what a manager would have read as a broken word.
        (
            _metric_batch(GOOD_V6_NARRATIVE.replace("מצרפית", "מצرפית")),
            "not_hebrew",
        ),
        (_metric_batch("קצר מדי."), "narrative_length"),
        (_metric_batch(GOOD_V6_NARRATIVE.replace("חלק", "12 אחוז")), "visible_number"),
        ("[]", "entry_shape"),
        ("not json at all", "entry_shape"),
    ],
)
def test_the_metric_refusal_names_the_gate_that_closed(answer, expected_label):
    refusal = hebrew_validation.v6_metric_insights_refusal(
        answer,
        expected_question_ids=["q1"],
        status="yellow",
    )
    assert refusal.label == expected_label

    # The walker reports; the parser decides. They must never disagree.
    parsed = hebrew_validation.parse_v6_metric_insights(
        answer,
        expected_question_ids=["q1"],
        status="yellow",
    )
    assert bool(refusal) == (parsed is None)
    if refusal:
        assert hebrew_prompts.batch_retry_critique(refusal.label)


@pytest.mark.parametrize(
    "answer,expected_label",
    [
        (_summary_batch(GOOD_V6_NARRATIVE), ""),
        (_summary_batch(GOOD_V6_NARRATIVE.replace("מצרפית", "מצرפית")), "not_hebrew"),
        (
            _summary_batch(GOOD_V6_NARRATIVE.replace("חלק", "12 אחוז")),
            "visible_number",
        ),
        (json.dumps([GOOD_V6_NARRATIVE], ensure_ascii=False), "entry_shape"),
        ("not json at all", "entry_shape"),
    ],
)
def test_the_summary_refusal_names_the_gate_that_closed(answer, expected_label):
    refusal = hebrew_validation.v6_structured_summary_refusal(answer, status="yellow")
    assert refusal.label == expected_label

    parsed = hebrew_validation.parse_v6_structured_summary(answer, status="yellow")
    assert bool(refusal) == (parsed is None)
    if refusal:
        assert hebrew_prompts.batch_retry_critique(refusal.label)


# --- the version the adaptation validator is told about ---------------------

# A summary that does exactly what the 5.0 adaptation prompt asks for: it names
# a colour group and puts that group's own count beside it, in digits. The
# dimension is yellow, so `ירוק` is a foreign colour; `4` is the green bucket of
# AGGREGATES, so the sentence is checkable against the map.
_COUNTED_COLOUR_SUMMARY = "לפי 4 התשובות הירוקות בשאלה החוזקה חלקית בלבד."


def _counted_colour_batch(entries: int = 1, steps: int = 2) -> str:
    block = "\n".join([_COUNTED_COLOUR_SUMMARY] + [f"- {_STEP}"] * steps)
    return "\n===\n".join([block] * entries)


@pytest.mark.parametrize(
    "contract_version,refused",
    [
        ("2.0", True),
        ("3.0", True),
        ("4.0", True),
        ("5.0", False),
        ("6.0", False),
    ],
)
def test_a_counted_colour_is_refused_only_where_the_contract_has_no_buckets(
    contract_version,
    refused,
):
    """The gate is the round's contract, not the module's default.

    `AI_ANALYTICS_CONTRACT_VERSION` is `"2.0"`, and 2.0 never showed a model a
    score distribution, so under it any foreign colour is a contradiction. That
    default was what judged every round: on 2026-08-19 three local runs ended
    with all eight dimensions on `adaptation=deterministic_fallback` and
    `refusal=status_inconsistent`, two or three answers spent per dimension, on
    copy that had quoted the round's own bucket count exactly as asked.

    1.0-4.0 keep the flat blacklist. 5.0 and 6.0 declare
    `supportsScoreDistribution`, and there a colour with its count beside it is
    a report rather than a verdict.
    """
    refusal = hebrew_validation.adaptation_batch_refusal(
        _counted_colour_batch(),
        expected_steps_per_entry=[2],
        status="yellow",
        distribution_counts=hebrew_validation.distribution_counts(AGGREGATES),
        contract_version=contract_version,
    )

    assert bool(refusal) is refused
    if refused:
        assert refusal.label == "status_inconsistent"
        assert refusal.detail == "block=1 colour=green verdict=no numbers=4"


@pytest.mark.parametrize(
    "summary,detail",
    [
        # A verdict is the model overruling the score Core owns. 5.0 loosens
        # nothing here — and the detail names the verdict rather than the
        # allowed green mention standing next to it in the same sentence.
        (
            "הממד נמצא באזור אדום למרות 4 התשובות הירוקות.",
            "block=1 colour=red verdict=yes",
        ),
        # A colour whose number is not one of the round's buckets: still
        # uncheckable against the map, still refused.
        (
            "לפי 30 התשובות אין תשובות ירוקות בשאלה הזו.",
            "block=1 colour=green verdict=no numbers=30",
        ),
    ],
)
def test_five_zero_still_refuses_a_verdict_and_an_uncheckable_count(
    summary,
    detail,
):
    """What the fix must not have bought: a colour the reader cannot check."""
    refusal = hebrew_validation.adaptation_batch_refusal(
        "\n".join([summary] + [f"- {_STEP}"] * 2),
        expected_steps_per_entry=[2],
        status="yellow",
        distribution_counts=hebrew_validation.distribution_counts(AGGREGATES),
        contract_version="5.0",
    )

    assert refusal.label == "status_inconsistent"
    assert refusal.detail == detail


def test_the_adaptation_call_judges_the_answer_by_the_version_it_was_given(
    monkeypatch,
):
    """End to end over the provider seam, because the pin was in the plumbing.

    The validator taking a version is only half of it: `adapt_interventions_result`
    defaulted to `"2.0"` as well, so the round's own version had to reach the
    call before it could reach the gate. One attempt, no retry budget: under the
    old default this answer cost three and ended on catalog copy.
    """
    interventions = [
        {
            "id": "int-1",
            "dimensionId": "balance",
            "summary": "המלצת קטלוג על איזון עומסים.",
            "actionable_steps": ["שלב קטלוגי אחד.", "שלב קטלוגי שני."],
        },
    ]

    monkeypatch.setattr(settings, "llm_api_key", "sk-test-validation")
    monkeypatch.setattr(settings, "llm_base_url", "https://provider.local/v1")
    monkeypatch.setattr(settings, "llm_max_attempts", 1)
    monkeypatch.setattr(
        "urllib.request.urlopen",
        lambda request, timeout=None: _response(_counted_colour_batch()),
    )

    adapted = llm_provider_service.adapt_interventions_result(
        interventions=interventions,
        dim_hebrew="איזון",
        score=45.5,
        status="yellow",
        question_aggregates=AGGREGATES,
        contract_version="5.0",
    )

    assert [entry.outcome for entry in adapted] == ["llm"]
    assert [entry.summary for entry in adapted] == [_COUNTED_COLOUR_SUMMARY]
    assert [entry.attempts for entry in adapted] == [1]
