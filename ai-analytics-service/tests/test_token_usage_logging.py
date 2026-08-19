"""What a round costs, answered from data instead of from an estimate.

The strategy sweep of 2026-08-10 put "do not optimize LLM cost" in its do-not-do
list — roughly $0.31–$1.91 per round, under 1% of revenue at any plausible price
— and asked for one thing in its place: enough logging that the question can be
answered from data and then closed permanently. The provider was already
answering with its own accounting on every call and this service was discarding
it, so the estimate had no way of ever becoming a measurement.

These tests hold the two properties that make the line worth trusting: that it
is emitted once per billed answer including the refused ones, and that a
provider which reports its usage oddly costs the caller a log field rather than
an answer.
"""

import json
import logging
from typing import Optional

import pytest

from src.config import settings
from src.services.llm_transport import complete_with_retries


class _Response:
    status = 200

    def __init__(self, body: dict):
        self._body = body

    def read(self):
        return json.dumps(self._body).encode("utf-8")

    def __enter__(self):
        return self

    def __exit__(self, *_):
        return False


def _answer(text: str, usage: Optional[object]) -> dict:
    body = {
        "choices": [
            {"message": {"content": text}, "finish_reason": "stop"},
        ],
    }
    if usage is not None:
        body["usage"] = usage
    return body


ANSWER = "אני מרגישה שיש לי מסגרת ברורה לתכנון השבוע הקרוב."


def _run(monkeypatch, responses, is_acceptable=None, max_attempts=1):
    monkeypatch.setattr(settings, "llm_api_key", "sk-test-usage")
    monkeypatch.setattr(settings, "llm_base_url", "https://provider.local/v1")
    monkeypatch.setattr(settings, "llm_max_attempts", max_attempts)

    served = iter(responses)
    monkeypatch.setattr(
        "urllib.request.urlopen",
        lambda *_a, **_k: _Response(next(served)),
    )

    return complete_with_retries(
        build_prompt=lambda critique=None: "prompt",
        system_prompt="system",
        model_name="gemini-3.5-flash",
        is_acceptable=is_acceptable or (lambda text, finish_reason: bool(text)),
    )


def _usage_lines(caplog):
    return [
        record.getMessage()
        for record in caplog.records
        if "outcome=usage" in record.getMessage()
    ]


def test_the_provider_own_accounting_reaches_the_log(monkeypatch, caplog):
    caplog.set_level(logging.INFO)

    text, _attempts, reason = _run(
        monkeypatch,
        [
            _answer(
                ANSWER,
                {
                    "prompt_tokens": 812,
                    "completion_tokens": 143,
                    "total_tokens": 955,
                },
            ),
        ],
    )

    assert text and reason == ""
    lines = _usage_lines(caplog)
    assert len(lines) == 1
    assert "prompt_tokens=812" in lines[0]
    assert "completion_tokens=143" in lines[0]
    assert "total_tokens=955" in lines[0]
    # The model is on the line because the two tiers cost different money, and
    # a token count without the model it was spent on prices nothing.
    assert "model=gemini-3.5-flash" in lines[0]


def test_a_refused_answer_is_billed_and_says_so(monkeypatch, caplog):
    """The reason this counts per answer rather than per conversation.

    A refused candidate was paid for. This service retries with a critique by
    design, so the retries are a real and deliberate part of the bill — and a
    total reported from the accepted answer alone would hide exactly the part
    the cost question is about.
    """
    caplog.set_level(logging.INFO)
    accepted = []

    def is_acceptable(text, _finish_reason):
        accepted.append(text)
        return len(accepted) > 1

    text, attempts, reason = _run(
        monkeypatch,
        [
            _answer(ANSWER, {"prompt_tokens": 800, "completion_tokens": 120,
                             "total_tokens": 920}),
            _answer(ANSWER, {"prompt_tokens": 890, "completion_tokens": 130,
                             "total_tokens": 1020}),
        ],
        is_acceptable=is_acceptable,
        max_attempts=2,
    )

    assert text and reason == ""
    assert attempts == 2
    lines = _usage_lines(caplog)
    assert len(lines) == 2
    assert "prompt_tokens=800" in lines[0] and "attempt=1" in lines[0]
    assert "prompt_tokens=890" in lines[1] and "attempt=2" in lines[1]


def test_a_provider_that_reports_no_usage_still_answers(monkeypatch, caplog):
    caplog.set_level(logging.INFO)

    text, _attempts, reason = _run(monkeypatch, [_answer(ANSWER, None)])

    # The answer is already in hand when this line is written. Losing it to
    # missing bookkeeping would be an absurd way to fail.
    assert text and reason == ""
    assert "prompt_tokens=unavailable" in _usage_lines(caplog)[0]


@pytest.mark.parametrize(
    "usage",
    [
        [],
        "912",
        {"prompt_tokens": "812", "completion_tokens": None},
        {"prompt_tokens": True},
    ],
)
def test_a_usage_block_of_the_wrong_shape_costs_a_field_not_an_answer(
    monkeypatch,
    caplog,
    usage,
):
    caplog.set_level(logging.INFO)

    text, _attempts, reason = _run(monkeypatch, [_answer(ANSWER, usage)])

    assert text and reason == ""
    line = _usage_lines(caplog)[0]
    # Not coerced and not defaulted to zero: a zero is a number a reader would
    # sum, and summing what the provider never sent is how a cost figure becomes
    # confidently wrong. `True` is an int in Python and is refused for the same
    # reason.
    assert "prompt_tokens=unavailable" in line


def test_the_thinking_half_of_a_completion_is_named(monkeypatch, caplog):
    """The split, not a second cost line.

    Reasoning tokens are already inside `completion_tokens` and billed at the
    same rate, so adding them to a total would double-count. What the split buys
    is the decision: a completion of 1548 tokens reads differently once 1440 of
    them are known to be thinking, and that is the number `LLM_REASONING_EFFORT`
    moves.
    """
    caplog.set_level(logging.INFO)

    text, _attempts, reason = _run(
        monkeypatch,
        [
            _answer(
                ANSWER,
                {
                    "prompt_tokens": 812,
                    "completion_tokens": 1548,
                    "total_tokens": 2360,
                    "completion_tokens_details": {"reasoning_tokens": 1440},
                },
            ),
        ],
    )

    assert text and reason == ""
    line = _usage_lines(caplog)[0]
    assert "completion_tokens=1548" in line
    assert "reasoning_tokens=1440" in line
    assert "total_tokens=2360" in line


@pytest.mark.parametrize(
    "details",
    [
        None,
        {},
        {"reasoning_tokens": "1440"},
        [1440],
    ],
)
def test_a_provider_that_does_not_itemise_thinking_still_answers(
    monkeypatch,
    caplog,
    details,
):
    caplog.set_level(logging.INFO)

    usage = {
        "prompt_tokens": 812,
        "completion_tokens": 143,
        "total_tokens": 955,
    }
    if details is not None:
        usage["completion_tokens_details"] = details

    text, _attempts, reason = _run(monkeypatch, [_answer(ANSWER, usage)])

    assert text and reason == ""
    line = _usage_lines(caplog)[0]
    assert "reasoning_tokens=unavailable" in line
    # The counts the provider did send are unaffected by the one it did not.
    assert "completion_tokens=143" in line
