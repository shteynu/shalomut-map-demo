from src.contracts import AI_ANALYTICS_CONTRACT_VERSION
from src.schemas.contract_registry import get_capabilities
"""What the service accepts as Hebrew copy about a round.

This is the half of the old ``LLMProviderService`` that has nothing to do with
a provider: ``nodes.py`` calls it on text the graph already holds, and the
safety validator runs it over copy no model wrote. It is kept apart from the
transport so that judging a sentence never depends on how the sentence arrived.
"""

import json
import re
from typing import Any, Dict, Iterable, NamedTuple, Optional, Tuple

# The Hebrew block, plus the presentation forms a model may reach for instead
# of the base letter with its point (\u05e9\u05c1 as one character rather than two). Both
# are Hebrew to a reader, so both count as Hebrew here.
_HEBREW_PATTERN = re.compile(r"[\u0590-\u05ff\ufb1d-\ufb4f]")
_LATIN_PATTERN = re.compile(r"[A-Za-z]")

# Letters a model substitutes for their Hebrew twin. `certainty` sent
# `\u05d0\u05d9 \u0648\u05d3\u05d0\u05d5\u05ea` twice on 2026-07-30 \u2014 an Arabic waw inside a Hebrew word, which
# renders as a broken word in a paragraph a manager reads. The word is repaired
# rather than refused: the alternative costs the dimension all three of its
# recommendations, and the letter the model meant is not in doubt where the
# rest of the word is Hebrew. Anything this table does not cover is caught by
# `is_hebrew_only_copy` instead.
_HEBREW_CONFUSABLES = {
    "\u0648": "\u05d5",  # ARABIC LETTER WAW -> HEBREW LETTER VAV
}

_WHITESPACE_SPLIT_PATTERN = re.compile(r"(\s+)")
_COMPLETE_SENTENCE_PATTERN = re.compile(r"[^.!?؟]+[.!?؟]")
_INTEGER_PATTERN = re.compile(r"\d+")
_VISIBLE_NUMBER_PATTERN = re.compile(r"[\d%٪]")

# A period between two digits belongs to the number, not to the sentence. It is
# masked before splitting: otherwise "הממוצע הוא 45.0 מתוך 100." counts as two
# sentences and one quoted average blows the per-version sentence budget.
_DECIMAL_POINT_PATTERN = re.compile(r"(?<=\d)\.(?=\d)")
_DECIMAL_POINT_MASK = "\x01"

# Punctuation a sentence may close with after its terminal mark. Without this a
# quoted last word leaves the closing quote outside every matched sentence and
# fails the "nothing left over" check.
_TRAILING_CLOSERS = "\"'”’»)]׳״"

# Markup a chat model adds around otherwise valid Hebrew copy. It carries no
# meaning here and is removed before validation, so a bolded sentence is judged
# on its words rather than on its asterisks.
_MARKDOWN_FENCE_PATTERN = re.compile(r"^\s*```.*$", re.MULTILINE)
_MARKDOWN_HEADING_PATTERN = re.compile(r"^\s*#+\s*", re.MULTILINE)
_MARKDOWN_BULLET_PATTERN = re.compile(r"^\s*[*•‣]\s+", re.MULTILINE)
_MARKDOWN_EMPHASIS_PATTERN = re.compile(r"\*+|__+|`+|~~+")

# Hebrew status words. On 5.0 the prompt states the score distribution in these
# very words, so naming another bucket can be plain reporting rather than a
# contradiction — see is_status_consistent.
_STATUS_WORDS_HEBREW = {
    "green": "ירוק",
    "yellow": "צהוב",
    "red": "אדום",
}
# "באזור אדום" / "בטווח אדום" is a verdict about the dimension, not a count.
_VERDICT_MARKERS_HEBREW = ("באזור", "בטווח")

# What a green dimension may not be told about itself, whatever else the
# sentence says. Both are verdicts of distress and contradict the score Core
# owns, so no phrasing rescues them.
_GREEN_DISTRESS_VERDICTS = ("מצוקה מבנית", "טיפול מיידי")

# Words that are a claim of distress when asserted and a statement in green's
# favour when denied. `שחיקה` used to be refused outright, and "אין סימני שחיקה"
# with it. Alongside it stood `שיפור` and `לשפר`, which are gone from the rule
# altogether: improving a strength is what a school does with one, and refusing
# the words cost a green dimension its copy over ordinary Hebrew. The
# distinction drawn here is the one 5.0 already draws for a foreign colour —
# allowed where it reads as a report, refused where it reads as a verdict.
_GREEN_DENIABLE_CLAIMS = ("שחיקה",)

# Hebrew negation, with the one-letter prefixes a clause takes ("שאין", "ואין").
# The trailing boundary is what keeps `לא` from matching inside `לאורך` or
# `מלא`; the leading one keeps the prefix set from swallowing a longer word.
_HEBREW_NEGATIONS = (
    "איננה",
    "איננו",
    "אינם",
    "אינן",
    "אין",
    "ללא",
    "בלי",
    "לא",
)
_HEBREW_NEGATION_PATTERN = re.compile(
    r"(?:^|[^\u0590-\u05ff\ufb1d-\ufb4f])"
    # ו / ש / כ — the one-letter prefixes a clause takes.
    r"[\u05d5\u05e9\u05db]?"
    r"(?:" + "|".join(
        sorted(_HEBREW_NEGATIONS, key=len, reverse=True),
    ) + r")"
    r"(?![\u0590-\u05ff\ufb1d-\ufb4f])"
)


def _repair_hebrew_confusables(text: str) -> str:
    """Put a Hebrew letter back where its twin from another script slipped in.

    Word by word, and only where the word is already Hebrew: a word with no
    Hebrew in it is a word in another language, which is a refusal rather than
    a typo and must reach `is_hebrew_only_copy` untouched.
    """
    if not any(letter in text for letter in _HEBREW_CONFUSABLES):
        return text

    parts = _WHITESPACE_SPLIT_PATTERN.split(text)
    for index, part in enumerate(parts):
        if not _HEBREW_PATTERN.search(part):
            continue
        for wrong, right in _HEBREW_CONFUSABLES.items():
            part = part.replace(wrong, right)
        parts[index] = part
    return "".join(parts)


def sanitize_model_text(text: str) -> str:
    """Drop chat-model markup that the copy never asked for.

    A model that answers correctly in Hebrew still tends to bold its
    conclusion, open a code fence or bullet its steps with an asterisk.
    None of that reaches the school — it is removed here rather than
    rejected, so formatting habits cost a retry instead of a fallback.
    Bullets become the "-" the adaptation parser expects.
    """
    if not text:
        return ""
    cleaned = _repair_hebrew_confusables(text)
    cleaned = _MARKDOWN_FENCE_PATTERN.sub("", cleaned)
    cleaned = _MARKDOWN_HEADING_PATTERN.sub("", cleaned)
    cleaned = _MARKDOWN_BULLET_PATTERN.sub("- ", cleaned)
    cleaned = _MARKDOWN_EMPHASIS_PATTERN.sub("", cleaned)
    lines = [line.strip() for line in cleaned.splitlines()]
    return "\n".join(line for line in lines if line).strip()


def sentences(text: str) -> list[str]:
    """Split on sentence ends, leaving the period inside a decimal alone."""
    masked = _DECIMAL_POINT_PATTERN.sub(_DECIMAL_POINT_MASK, text)
    return [
        sentence.replace(_DECIMAL_POINT_MASK, ".")
        for sentence in _COMPLETE_SENTENCE_PATTERN.findall(masked)
    ]


def sentences_or_whole(text: str) -> list[str]:
    return sentences(text) or [text]


def is_hebrew_only_copy(text: str) -> bool:
    """True when every letter in the copy is Hebrew and at least one is.

    The check used to name the one script it refused — Latin — and so let every
    other one through. An Arabic waw inside a Hebrew word passed twice on
    2026-07-30 and would have reached a manager as a broken word, and a whole
    sentence in Cyrillic would have passed just as easily as long as one Hebrew
    letter stood somewhere in it. Digits, punctuation and Hebrew points are not
    letters and are unaffected; the confusables `sanitize_model_text` repairs
    never arrive here wrong.
    """
    normalized = text.strip()
    if not normalized or not _HEBREW_PATTERN.search(normalized):
        return False
    return not any(
        character.isalpha() and not _HEBREW_PATTERN.match(character)
        for character in normalized
    )


V6_NARRATIVE_MIN_CHARACTERS = 300
V6_NARRATIVE_MAX_CHARACTERS = 500


def is_v6_qualitative_narrative(text: str) -> bool:
    """Validate visible V6 metric/recommendation copy like the Core reader."""
    normalized = sanitize_model_text(text)
    return (
        V6_NARRATIVE_MIN_CHARACTERS
        <= len(normalized)
        <= V6_NARRATIVE_MAX_CHARACTERS
        and is_hebrew_only_copy(normalized)
        and not _VISIBLE_NUMBER_PATTERN.search(normalized)
    )


def parse_v6_structured_summary(
    text: Optional[str],
    *,
    status: str,
) -> Optional[tuple[str, str, str]]:
    """Accept exactly three complete Hebrew JSON strings without visible data."""
    if not text:
        return None
    try:
        candidate = json.loads(text)
    except (TypeError, json.JSONDecodeError):
        return None
    if not isinstance(candidate, list) or len(candidate) != 3:
        return None

    paragraphs = []
    for value in candidate:
        if not isinstance(value, str):
            return None
        paragraph = sanitize_model_text(value)
        if (
            not is_hebrew_only_copy(paragraph)
            or _VISIBLE_NUMBER_PATTERN.search(paragraph)
            or not paragraph.rstrip(_TRAILING_CLOSERS).rstrip().endswith(
                (".", "!", "?", "؟"),
            )
            or not is_status_consistent(paragraph, status)
        ):
            return None
        paragraphs.append(paragraph)
    if len(set(paragraphs)) != 3:
        return None
    return tuple(paragraphs)  # type: ignore[return-value]


def parse_v6_metric_insights(
    text: Optional[str],
    *,
    expected_question_ids: list[str],
    status: str,
) -> Optional[Dict[str, str]]:
    """Parse one exact, ordered-independent narrative per input question."""
    if not text:
        return None
    try:
        candidate = json.loads(text)
    except (TypeError, json.JSONDecodeError):
        return None
    if not isinstance(candidate, list) or len(candidate) != len(
        expected_question_ids,
    ):
        return None

    insights: Dict[str, str] = {}
    for item in candidate:
        if not isinstance(item, dict):
            return None
        question_id = item.get("questionId")
        insight = item.get("insightText")
        if (
            not isinstance(question_id, str)
            or question_id in insights
            or not isinstance(insight, str)
        ):
            return None
        normalized = sanitize_model_text(insight)
        if (
            not is_v6_qualitative_narrative(normalized)
            or not is_status_consistent(normalized, status)
        ):
            return None
        insights[question_id] = normalized

    return (
        insights
        if set(insights) == set(expected_question_ids)
        else None
    )


def parse_v6_intervention_batch(
    text: Optional[str],
    *,
    interventions: list[Dict[str, Any]],
    status: str,
) -> Optional[list[Tuple[str, list[str]]]]:
    """Parse five JSON adaptations while preserving catalog identity/order."""
    if not text:
        return None
    try:
        candidate = json.loads(text)
    except (TypeError, json.JSONDecodeError):
        return None
    if not isinstance(candidate, list) or len(candidate) != len(interventions):
        return None

    parsed = []
    for expected, item in zip(interventions, candidate):
        if not isinstance(item, dict) or item.get("id") != expected.get("id"):
            return None
        summary = item.get("summary")
        steps = item.get("actionable_steps")
        expected_steps = expected.get("actionable_steps", [])
        if (
            not isinstance(summary, str)
            or not isinstance(steps, list)
            or len(steps) != len(expected_steps)
            or not all(isinstance(step, str) for step in steps)
        ):
            return None
        normalized_summary = sanitize_model_text(summary)
        normalized_steps = [sanitize_model_text(step) for step in steps]
        if (
            not is_v6_qualitative_narrative(normalized_summary)
            or not all(is_hebrew_only_copy(step) for step in normalized_steps)
            or not is_status_consistent(
                " ".join([normalized_summary, *normalized_steps]),
                status,
            )
        ):
            return None
        parsed.append((normalized_summary, normalized_steps))
    return parsed


def is_complete_hebrew_copy(text: str, contract_version: str = AI_ANALYTICS_CONTRACT_VERSION) -> bool:
    """True when the copy is Hebrew, complete, and within the version's budget.

    "Complete" means every word belongs to a sentence that ends in terminal
    punctuation — the check that catches a truncated answer. Markup and a
    closing quote are stripped first, because neither is a missing sentence:
    rejecting `**…**` sent the school catalog copy over an asterisk.
    """
    normalized = sanitize_model_text(text)
    if not is_hebrew_only_copy(normalized):
        return False
    closed = normalized.rstrip(_TRAILING_CLOSERS).rstrip()
    found = sentences(closed)
    compact_sentences = re.sub(r"\s", "", "".join(found))
    compact_text = re.sub(r"\s", "", closed)
    expected_len = (
        (2 <= len(found) <= 5) if get_capabilities(contract_version).stoneInterpretationSentenceLimit == "2-5" else (len(found) == 2)
    )
    return expected_len and compact_sentences == compact_text


# What a questionnaire item may be, in characters. The instrument's own
# twenty-four run from 30 to 83, so the range is wide enough to hold every one of
# them and narrow enough to refuse a word and a paragraph.
QUESTION_SUGGESTION_MIN_LENGTH = 20
QUESTION_SUGGESTION_MAX_LENGTH = 200


def normalized_question_text(text: str) -> str:
    """One spelling of an item, for comparing two of them."""
    return re.sub(r"\s+", " ", sanitize_model_text(text)).strip().rstrip(".").strip()


def is_valid_question_suggestion(
    text: str,
    existing_texts: Iterable[str] = (),
) -> bool:
    """True when the suggestion is shaped like an item of this instrument.

    The manager rewrites every suggestion before it joins a questionnaire, so
    this is not a judgement about whether the item is a good one — that is the
    manager's, and no validator can take it. What it refuses is copy that cannot
    be an item at all: a paragraph, a question (the respondent rates agreement,
    so a question has no answer on the scale), a number (an item asks about
    experience, not about data), or a line the questionnaire already holds.
    """
    normalized = sanitize_model_text(text).strip()
    if not is_hebrew_only_copy(normalized):
        return False
    if not (
        QUESTION_SUGGESTION_MIN_LENGTH
        <= len(normalized)
        <= QUESTION_SUGGESTION_MAX_LENGTH
    ):
        return False
    if "?" in normalized or "؟" in normalized:
        return False
    if _INTEGER_PATTERN.search(normalized):
        return False
    if len(sentences(normalized)) != 1:
        return False

    candidate = normalized_question_text(normalized)
    return all(
        candidate != normalized_question_text(existing)
        for existing in existing_texts
        if existing and existing.strip()
    )


def _is_asserted(text: str, word: str) -> bool:
    """True where `word` is claimed rather than denied.

    A denial has to stand before the word and inside the same sentence: "אין
    סימני שחיקה" denies it, "יש שחיקה, ולא ניתן להתעלם" does not, and a negation
    two sentences away is about something else. Every occurrence has to be
    denied — one asserted mention is enough to make the sentence a claim.
    """
    for sentence in sentences_or_whole(text):
        denials = [
            match.end() for match in _HEBREW_NEGATION_PATTERN.finditer(sentence)
        ]
        position = sentence.find(word)
        while position >= 0:
            if not any(end <= position for end in denials):
                return True
            position = sentence.find(word, position + len(word))
    return False


def is_status_consistent(
    text: str,
    status: str,
    contract_version: str = AI_ANALYTICS_CONTRACT_VERSION,
    distribution_counts: Optional[set[str]] = None,
) -> bool:
    """Reject copy that contradicts the numerical status Core owns.

    Up to 4.0 the rule is a flat blacklist: naming any other status colour
    is a contradiction, because nothing in the prompt ever mentioned one.

    5.0 shows the LLM the score distribution in those very words and asks
    it to reason from them, so "12 answered yellow, 4 answered red" is a
    faithful report of a yellow dimension, not a contradiction. On 5.0 a
    foreign colour is therefore allowed only where it reads as a count —
    the sentence has to carry a number matching one of the buckets — and
    never as a verdict ("נמצא באזור אדום"). The judgement-style phrases
    stay blacklisted for every version.

    Green carries two rules of its own, because green is the one status whose
    copy is about a strength: a verdict of distress is refused outright, and a
    deniable claim is refused only where it is asserted. See
    `_GREEN_DENIABLE_CLAIMS` for why the improvement words left the rule.
    """
    if status == "green" and (
        any(phrase in text for phrase in _GREEN_DISTRESS_VERDICTS)
        or any(
            _is_asserted(text, claim)
            for claim in _GREEN_DENIABLE_CLAIMS
        )
    ):
        return False

    foreign_colours = [
        colour_word
        for colour_status, colour_word in _STATUS_WORDS_HEBREW.items()
        if colour_status != status
    ]
    if not foreign_colours:
        return True

    if not get_capabilities(contract_version).supportsScoreDistribution or not distribution_counts:
        return not any(colour in text for colour in foreign_colours)

    for sentence in sentences_or_whole(text):
        for colour in foreign_colours:
            if colour not in sentence:
                continue
            if any(
                f"{marker} {colour}" in sentence
                for marker in _VERDICT_MARKERS_HEBREW
            ):
                return False
            if not (
                set(_INTEGER_PATTERN.findall(sentence)) & distribution_counts
            ):
                return False
    return True


def is_valid_provider_output(
    text: str,
    finish_reason: object,
    status: str,
    contract_version: str = AI_ANALYTICS_CONTRACT_VERSION,
    distribution_counts: Optional[set[str]] = None,
) -> bool:
    if finish_reason != "stop" or not is_complete_hebrew_copy(
        text,
        contract_version=contract_version,
    ):
        return False
    return is_status_consistent(
        text,
        status,
        contract_version=contract_version,
        distribution_counts=distribution_counts,
    )


def has_full_distribution(
    question_aggregates: Iterable[Dict[str, Any]] | None,
) -> bool:
    """True when every aggregate of the dimension carries its buckets.

    The interpretation prompt renders the distribution per aggregate, so a
    dimension where one question lacks it reaches the model only partly
    enriched.
    """
    aggregates = list(question_aggregates or [])
    if not aggregates:
        return False
    for aggregate in aggregates:
        distribution = aggregate.get("scoreDistribution")
        if not isinstance(distribution, dict):
            return False
        for bucket in ("green", "yellow", "red"):
            count = distribution.get(bucket)
            if not isinstance(count, int) or isinstance(count, bool):
                return False
    return True


def distribution_counts(
    question_aggregates: Iterable[Dict[str, Any]] | None,
) -> Optional[set[str]]:
    """Counts a faithful 5.0 interpretation may quote for one dimension.

    The prompt lists every question's buckets, so those are the numbers the
    model can legitimately name; the per-bucket totals are added because
    summarising the dimension is just as faithful. None means no aggregate
    carried a distribution, and the flat 2.0-4.0 rule applies.
    """
    totals = {"green": 0, "yellow": 0, "red": 0}
    counts: set[str] = set()
    for aggregate in question_aggregates or []:
        distribution = aggregate.get("scoreDistribution")
        if not isinstance(distribution, dict):
            continue
        for bucket in totals:
            count = distribution.get(bucket)
            if isinstance(count, int) and not isinstance(count, bool):
                totals[bucket] += count
                counts.add(str(count))
    if not counts:
        return None
    return counts | {str(total) for total in totals.values()}


def parse_adaptation(
    text: Optional[str],
    expected_steps: int,
) -> Optional[Tuple[str, list[str]]]:
    """Summary on the first line, then one step per line, each led by "-".

    A line format survives what JSON does not: a model that answers in
    Hebrew tends to wrap JSON in fences, reorder keys or drop the quoting
    entirely, and a parse failure here costs the school its adaptation.
    """
    if not text:
        return None

    lines = [line.strip() for line in text.strip().splitlines()]
    lines = [line for line in lines if line]
    if len(lines) != expected_steps + 1:
        return None

    summary = lines[0].lstrip("-–—•").strip()
    steps = []
    for line in lines[1:]:
        if not line.startswith(("-", "–", "—", "•")):
            return None
        step = line.lstrip("-–—•").strip()
        if not step:
            return None
        steps.append(step)

    if not summary:
        return None
    return summary, steps


ADAPTATION_BATCH_SEPARATOR = "==="
_BULLET_MARKERS = ("-", "–", "—", "•")


class AdaptationRefusal(NamedTuple):
    """Why a batch was turned away, in a form a log line can carry.

    Falsy when there is nothing to refuse, so a caller that only wants a yes
    or no reads as one. `detail` is `key=value` shape — never the copy.
    """

    label: str = ""
    detail: str = ""

    def __bool__(self) -> bool:
        return bool(self.label)


def _blocks_by_separator(text: str) -> list[list[str]]:
    """Split an answer on the lines that are nothing but "=" characters."""
    blocks: list[list[str]] = [[]]
    for line in text.strip().splitlines():
        stripped = line.strip()
        if stripped and stripped.strip("=") == "":
            blocks.append([])
            continue
        blocks[-1].append(line)
    return blocks


def _blocks_by_shape(text: str) -> list[list[str]]:
    """Split an answer into entries by what each line is, not by separators.

    Only reached when the separators did not divide the answer into the number
    of entries that were asked for. A line without a bullet opens an entry; the
    bulleted lines under it are its steps. An answer that opens with a bullet
    has no summary to attach them to, and returns nothing rather than guessing.
    """
    blocks: list[list[str]] = []
    for line in text.strip().splitlines():
        stripped = line.strip()
        if not stripped or stripped.strip("=") == "":
            continue
        if not stripped.startswith(_BULLET_MARKERS):
            blocks.append([])
        elif not blocks:
            return []
        blocks[-1].append(line)
    return blocks


def parse_adaptation_batch(
    text: Optional[str],
    expected_steps_per_entry: list[int],
) -> Optional[list[Tuple[str, list[str]]]]:
    """One block per catalog entry, blocks divided by a line of "===".

    Every entry of a dimension is adapted in one call, because they all speak
    to the same aggregates, the same status and the same school — sending that
    context once per entry spent three requests of a daily quota of twenty on
    saying the same thing. Inside a block the single-entry format is unchanged,
    so a batch is parsed by exactly the rules one adaptation is, and there is
    no second notion of what valid means.
    """
    if not text or not expected_steps_per_entry:
        return None

    blocks = _blocks_by_separator(text)

    if len(blocks) != len(expected_steps_per_entry):
        # A model that gets everything else right still forgets the separator.
        # On 2026-07-29 `professional-competence` came back as nine correct
        # lines — three summaries, two steps under each — and no `===` at all,
        # and a school lost three usable recommendations over a punctuation
        # line. The shape says where an entry begins on its own: a step always
        # carries a bullet and a summary never does.
        blocks = _blocks_by_shape(text)

    if len(blocks) != len(expected_steps_per_entry):
        return None

    entries = []
    for block, expected_steps in zip(blocks, expected_steps_per_entry):
        parsed = parse_adaptation("\n".join(block), expected_steps)
        if parsed is None:
            return None
        entries.append(parsed)
    return entries


def is_valid_adaptation_batch(
    candidate: str,
    *,
    expected_steps_per_entry: list[int],
    status: str,
    distribution_counts: Optional[set[str]] = None,
) -> bool:
    """A batch is acceptable only if every entry in it would be.

    One refused entry refuses the whole answer: the alternative is a dimension
    where some recommendations speak to the round and others silently do not,
    which is the ambiguity the catalog fallback exists to avoid.
    """
    return not adaptation_batch_refusal(
        candidate,
        expected_steps_per_entry=expected_steps_per_entry,
        status=status,
        distribution_counts=distribution_counts,
    )


def adaptation_batch_refusal(
    candidate: str,
    *,
    expected_steps_per_entry: list[int],
    status: str,
    distribution_counts: Optional[set[str]] = None,
) -> AdaptationRefusal:
    """Which gate turns this batch away, and the shape of what it saw.

    `invalid_semantic_output` alone cost a whole investigation: the round of
    2026-07-29 dropped six recommendations to catalog copy and the log said
    only that something was wrong with the text. Two different causes hid
    behind that one label — a missing separator and numbers spelled out in
    words — and telling them apart needed the refused answer, which nothing
    kept.

    The answer still does not reach the log, and deliberately: nine lines of
    Hebrew truncated to fit a log line diagnose nothing, and the copy is about
    one school's weakest dimensions, which is not something to spill outside
    the product's boundary for the convenience of debugging. The detail carries
    the shape instead — counts, indices, code points — which is what picks the
    next step. A falsy refusal means the batch is acceptable.
    """
    parsed = parse_adaptation_batch(candidate, expected_steps_per_entry)
    if parsed is None:
        return AdaptationRefusal(
            "entry_shape",
            _entry_shape_detail(candidate, expected_steps_per_entry),
        )

    for index, (summary, steps) in enumerate(parsed, start=1):
        parts = [summary, *steps]
        if not all(is_hebrew_only_copy(part) for part in parts):
            # The gate is `is_hebrew_only_copy` and stays it: the code points
            # only describe what it saw. They can be empty where the copy is
            # refused for holding no Hebrew at all rather than for holding
            # something else — a line of digits, or an empty one.
            foreign = _foreign_code_points(parts)
            return AdaptationRefusal(
                "not_hebrew",
                f"block={index} chars={foreign or 'none'}",
            )
        # An adaptation that quotes no number of the round is the catalog text
        # in different words: the whole point is that it speaks to these
        # aggregates. Digits only — "one in ten" reads as grounded and is not
        # something a reader can check against the map.
        if not _INTEGER_PATTERN.search(summary):
            # Whether the digits landed in the steps instead of the summary is
            # the whole question here: none anywhere is a model ignoring the
            # data, whereas digits one line below mean the rule is pointed at
            # the wrong line.
            in_steps = any(_INTEGER_PATTERN.search(step) for step in steps)
            return AdaptationRefusal(
                "no_number",
                f"block={index} digits_in_steps={'yes' if in_steps else 'no'}",
            )
        if not is_status_consistent(
            " ".join([summary, *steps]),
            status,
            contract_version=AI_ANALYTICS_CONTRACT_VERSION,
            distribution_counts=distribution_counts,
        ):
            return AdaptationRefusal(
                "status_inconsistent",
                f"block={index} "
                + _status_inconsistency_detail(
                    " ".join([summary, *steps]),
                    status,
                    distribution_counts,
                ),
            )
    return AdaptationRefusal()


def _entry_shape_detail(
    candidate: str,
    expected_steps_per_entry: list[int],
) -> str:
    """Say whether the blocks or the lines inside one of them were wrong.

    `entry_shape` covers two unrelated failures — the answer split into the
    wrong number of entries, or an entry with the wrong number of lines — and
    they want different fixes. This walks the same splits `parse_adaptation_batch`
    walks; it reports rather than decides, so if the two ever drift the cost is
    a misleading log line and not a wrong verdict.
    """
    if not candidate:
        return "empty"

    present = [line for line in candidate.strip().splitlines() if line.strip()]
    separators = [line for line in present if line.strip().strip("=") == ""]
    # Content lines, so `lines` and `separators` add up rather than overlap.
    lines = len(present) - len(separators)
    expected = len(expected_steps_per_entry)
    by_separator = len(separators) + 1
    by_shape = len(_blocks_by_shape(candidate))

    if expected not in (by_separator, by_shape):
        return (
            f"blocks={by_separator}/{expected} shape_blocks={by_shape} "
            f"separators={len(separators)} lines={lines}"
        )

    # The blocks were found; one of them holds the wrong number of lines.
    blocks = (
        _blocks_by_shape(candidate)
        if by_separator != expected
        else _blocks_by_separator(candidate)
    )
    for index, (block, steps) in enumerate(
        zip(blocks, expected_steps_per_entry),
        start=1,
    ):
        if parse_adaptation("\n".join(block), steps) is None:
            found = len([line for line in block if line.strip()])
            return f"block={index} lines={found}/{steps + 1}"
    return f"blocks={by_separator}/{expected} lines={lines}"


def _foreign_code_points(parts: Iterable[str], limit: int = 4) -> str:
    """The distinct non-Hebrew letters in the copy, as code points.

    A single code point is what turned item 18 from a day of squinting at a
    reproduction into a fact: `chars=U+0648` names the Arabic waw a model wrote
    where the vav belongs. Letters only, never the words around them.
    """
    found: list[str] = []
    for part in parts:
        for character in part:
            if not character.isalpha() or _HEBREW_PATTERN.match(character):
                continue
            point = f"U+{ord(character):04X}"
            if point not in found:
                found.append(point)
    if not found:
        return ""
    shown = ",".join(found[:limit])
    return f"{shown}+{len(found) - limit}" if len(found) > limit else shown


def _status_inconsistency_detail(
    text: str,
    status: str,
    distribution_counts: Optional[set[str]] = None,
) -> str:
    """Which colour was named, and whether it read as a count or a verdict.

    The two failures behind this label are far apart. A verdict — "the
    dimension is in the red zone" — is the model overruling the score Core
    owns, and is meant to be refused. A colour with no count beside it is
    usually true and merely uncheckable, as "and the absence of green answers"
    was on 2026-07-29; that one is fixed in the prompt, not in the guard.
    """
    for sentence in sentences_or_whole(text):
        for colour_status, colour_word in _STATUS_WORDS_HEBREW.items():
            if colour_status == status or colour_word not in sentence:
                continue
            verdict = next(
                (
                    marker
                    for marker in _VERDICT_MARKERS_HEBREW
                    if f"{marker} {colour_word}" in sentence
                ),
                None,
            )
            if verdict is not None:
                return f"colour={colour_status} verdict=yes"
            numbers = _INTEGER_PATTERN.findall(sentence)
            return (
                f"colour={colour_status} verdict=no "
                f"numbers={','.join(numbers[:4]) or 'none'}"
            )
    # The judgement-phrase blacklist, which names no colour at all.
    return "judgement_phrase"
