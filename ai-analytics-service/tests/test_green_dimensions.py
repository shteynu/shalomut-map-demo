"""What the model may say about a strength, and what green loses if it fails.

Green never reached a provider, so two rules grew up around a dimension nobody
was writing about. The status blacklist refused `שיפור`, `לשפר` and `שחיקה`,
which is ordinary Hebrew about a strength — a school keeps and develops one, and
"אין סימני שחיקה" is a statement in green's favour. And the deterministic
sentence was the only thing green ever got, so nothing decided what should
happen if green were asked and the answer never came.

These tests hold both decisions: the blacklist keeps the verdicts of distress
and lets the ordinary phrasing through, and a green dimension the provider
refuses keeps the sentence it always had rather than becoming a gap.
"""

import pytest

from src.config import settings
from src.services import hebrew_validation
from src.services.llm_provider import (
    ProviderUnavailableError,
    llm_provider_service,
)

from tests.test_llm_provider import (
    BALANCE_QUESTION_AGGREGATES,
    FakeLLMResponse,
    configure_gemini_retry_test,
    create_http_error,
)

GREEN_AGGREGATES = [
    {
        "questionId": "meaning-q1",
        "dimensionId": "meaning",
        "questionText": "אני מרגישה שהעבודה שלי משמעותית",
        "averageScore": 82.0,
        "responseCount": 20,
        "scoreDistribution": {"green": 16, "yellow": 3, "red": 1},
    },
]


# --- what green may now be told about itself ---------------------------------

@pytest.mark.parametrize(
    "label,text",
    [
        (
            "improvement as the natural next step for a strength",
            "הממד נמצא במצב תקין ומהווה חוזקה של הצוות. "
            "כדאי לשמר אותו ולבחון שיפור נוסף בשאלת המשמעות.",
        ),
        (
            "the verb rather than the noun",
            "רוב הצוות מדווח על תמונה חיובית בממד זה. "
            "אפשר לשפר עוד את ההיבט של שיתוף הצוות בהחלטות.",
        ),
        (
            "burnout denied, which is a statement in green's favour",
            "התשובות מצביעות על תמונה יציבה בממד זה. "
            "אין סימני שחיקה בקרב הצוות בשאלות שנבדקו.",
        ),
        (
            "the denial carrying a clause prefix",
            "התמונה בממד זה חיובית ועקבית. "
            "הנתונים מראים שאין שחיקה בקרב הצוות.",
        ),
        (
            "a denial written with ללא",
            "הצוות מדווח על תמונה חיובית בממד זה. "
            "העבודה מתנהלת ללא שחיקה ניכרת בקרב הצוות.",
        ),
    ],
)
def test_green_copy_that_must_no_longer_be_refused(label, text):
    """Each of these cost a green dimension its paragraph before 2026-07-30."""
    assert hebrew_validation.is_status_consistent(
        text,
        "green",
        contract_version="5.0",
    ), label


@pytest.mark.parametrize(
    "label,text",
    [
        (
            "a verdict of structural distress",
            "הממד מצביע על מצוקה מבנית בקרב הצוות. "
            "נדרשת בחינה של חלוקת העומסים.",
        ),
        (
            "a call for immediate treatment",
            "התמונה בממד זה מחייבת טיפול מיידי. "
            "הנתונים מצביעים על צורך בהתערבות.",
        ),
        (
            "burnout asserted",
            "הצוות מדווח על תמונה חיובית בממד זה. "
            "יחד עם זאת קיימת שחיקה ניכרת בקרב המחנכות.",
        ),
        (
            "a negation standing after the claim, which denies something else",
            "קיימת שחיקה בקרב הצוות בממד זה. "
            "לא ניתן להתעלם מכך בהמשך השנה.",
        ),
        (
            "one denied mention and one asserted in the same answer",
            "אין שחיקה בשאלת העומס. "
            "בשאלת המשמעות עולה שחיקה מובהקת בקרב הצוות.",
        ),
    ],
)
def test_green_copy_that_still_has_to_be_refused(label, text):
    assert not hebrew_validation.is_status_consistent(
        text,
        "green",
        contract_version="5.0",
    ), label


@pytest.mark.parametrize(
    "label,text",
    [
        (
            "לא inside לאורך",
            "הממד יציב בממד זה. "
            "קיימת שחיקה לאורך כל השנה בקרב הצוות.",
        ),
        (
            "לא inside מלא",
            "הממד יציב בממד זה. "
            "קיימת שחיקה בקרב צוות מלא של מחנכות.",
        ),
    ],
)
def test_a_negation_hidden_inside_another_word_is_not_a_denial(label, text):
    """`לא` is two letters that live inside ordinary words.

    A substring check would read `לאורך` and `מלא` as denials and clear an
    asserted claim, which is the bug the word boundaries in the pattern exist to
    prevent. The rule may only be relaxed by a real negation.
    """
    assert not hebrew_validation.is_status_consistent(
        text,
        "green",
        contract_version="5.0",
    ), label


def test_the_rule_belongs_to_green_and_to_nothing_else():
    """Red and yellow are about a problem, so distress language is expected."""
    for status in ("yellow", "red"):
        assert hebrew_validation.is_status_consistent(
            "הנתונים מצביעים על שחיקה בקרב הצוות. "
            "מומלץ לבחון את חלוקת המשימות מחדש.",
            status,
            contract_version="5.0",
        ), status


# --- green reaching a provider, and failing to ------------------------------

def _green_interpretation():
    return llm_provider_service.generate_psychological_interpretation_result(
        "meaning",
        "משמעות",
        82.0,
        "green",
        question_aggregates=GREEN_AGGREGATES,
        contract_version="5.0",
    )


def test_green_is_asked_like_every_other_dimension(monkeypatch):
    configure_gemini_retry_test(monkeypatch)
    monkeypatch.setattr(settings, "only_llm_for_problematic", False)
    calls = []

    def fake_urlopen(*_args, **_kwargs):
        calls.append(True)
        return FakeLLMResponse(
            content=(
                "הממד נמצא במצב תקין ומהווה חוזקה של הצוות. "
                "כדאי לשמר אותו ולבחון שיפור נוסף בשאלת המשמעות."
            ),
        )

    monkeypatch.setattr("urllib.request.urlopen", fake_urlopen)

    generation = _green_interpretation()

    assert len(calls) == 1
    assert generation.outcome == "llm"
    assert generation.attempts == 1
    assert "שיפור" in generation.text


def test_the_switch_still_keeps_green_away_from_the_provider(monkeypatch):
    """The saving is still available, and still costs nothing when unused."""
    configure_gemini_retry_test(monkeypatch)
    monkeypatch.setattr(settings, "only_llm_for_problematic", True)

    def fake_urlopen(*_args, **_kwargs):
        raise AssertionError("green must not reach the provider here")

    monkeypatch.setattr("urllib.request.urlopen", fake_urlopen)

    generation = _green_interpretation()

    assert generation.outcome == "deterministic_fallback"
    # Zero is the whole point: provenance separates "never asked" from
    # "asked and refused", and only this road spent nothing.
    assert generation.attempts == 0


def test_a_refused_green_dimension_keeps_its_sentence(monkeypatch, caplog):
    """Green is the one status whose fallback hides no failure of judgement.

    The sentence is derived from the aggregates and it is the copy green
    received for as long as it was never asked. Turning a refusal into a gap
    would take away text the manager has today, which is the opposite of what
    letting the model near green was for. `attempts` is what says the provider
    was asked, and the outcome never claims the model wrote it.
    """
    configure_gemini_retry_test(monkeypatch, max_attempts=2)
    monkeypatch.setattr(settings, "only_llm_for_problematic", False)
    attempts = []

    def fake_urlopen(*_args, **_kwargs):
        attempts.append(True)
        raise create_http_error(503)

    monkeypatch.setattr("urllib.request.urlopen", fake_urlopen)

    generation = _green_interpretation()

    assert generation.outcome == "deterministic_fallback"
    assert generation.attempts == len(attempts) == 2
    assert generation.retry_count == 1
    assert "משמעות" in generation.text
    assert "outcome=deterministic_fallback" in caplog.text
    assert "outcome=provider_unavailable" not in caplog.text


def test_a_refused_green_dimension_never_wears_the_model_label(monkeypatch):
    """The fallback is legal; passing it off as analysis is not."""
    configure_gemini_retry_test(monkeypatch, max_attempts=1)
    monkeypatch.setattr(settings, "only_llm_for_problematic", False)
    monkeypatch.setattr(
        "urllib.request.urlopen",
        lambda *_args, **_kwargs: FakeLLMResponse(
            content="This answer is not Hebrew and never passes a validator.",
        ),
    )

    generation = _green_interpretation()

    assert generation.outcome != "llm"
    assert generation.attempts >= 1


def test_yellow_and_red_still_fail_rather_than_fall_back(monkeypatch):
    """Only green has a deterministic sentence that is not a guess.

    A fallback for a problematic dimension would put a formula where the
    manager expects an analysis of a problem, which is the failure the whole
    fail-closed discipline exists to prevent.
    """
    configure_gemini_retry_test(monkeypatch, max_attempts=1)
    monkeypatch.setattr(settings, "only_llm_for_problematic", False)
    monkeypatch.setattr(
        "urllib.request.urlopen",
        lambda *_args, **_kwargs: (_ for _ in ()).throw(
            create_http_error(503),
        ),
    )

    for status in ("yellow", "red"):
        with pytest.raises(ProviderUnavailableError) as failure:
            llm_provider_service.generate_psychological_interpretation_result(
                "balance",
                "איזון",
                42.0,
                status,
                question_aggregates=BALANCE_QUESTION_AGGREGATES,
                contract_version="5.0",
            )
        assert failure.value.dimension_id == "balance"


def test_the_deterministic_green_sentence_passes_its_own_validators():
    """Whatever road reaches it, the fallback still has to be safe copy.

    The safety validator reads it exactly as it reads a model's paragraph, so a
    sentence this service writes has to clear the same gates — otherwise the
    fallback that exists to save the round is what fails it.
    """
    from src.services import hebrew_prompts

    sentence = hebrew_prompts.heuristic_interpretation(
        "משמעות",
        82.0,
        "green",
        GREEN_AGGREGATES,
    )

    assert hebrew_validation.is_complete_hebrew_copy(
        sentence,
        contract_version="5.0",
    )
    assert hebrew_validation.is_status_consistent(
        sentence,
        "green",
        contract_version="5.0",
        distribution_counts=hebrew_validation.distribution_counts(
            GREEN_AGGREGATES,
        ),
    )
