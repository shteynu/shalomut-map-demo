"""What the service accepts as Hebrew copy about a round.

This is the half of the old ``LLMProviderService`` that has nothing to do with
a provider: ``nodes.py`` calls it on text the graph already holds, and the
safety validator runs it over copy no model wrote. It is kept apart from the
transport so that judging a sentence never depends on how the sentence arrived.
"""

import re
from typing import Any, Dict, Iterable, Optional, Tuple

_HEBREW_PATTERN = re.compile(r"[\u0590-\u05ff]")
_LATIN_PATTERN = re.compile(r"[A-Za-z]")
_COMPLETE_SENTENCE_PATTERN = re.compile(r"[^.!?؟]+[.!?؟]")
_INTEGER_PATTERN = re.compile(r"\d+")

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
    cleaned = _MARKDOWN_FENCE_PATTERN.sub("", text)
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
    normalized = text.strip()
    return bool(
        normalized
        and _HEBREW_PATTERN.search(normalized)
        and not _LATIN_PATTERN.search(normalized)
    )


def is_complete_hebrew_copy(text: str, contract_version: str = "4.0") -> bool:
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
        (2 <= len(found) <= 5) if contract_version == "5.0" else (len(found) == 2)
    )
    return expected_len and compact_sentences == compact_text


def is_status_consistent(
    text: str,
    status: str,
    contract_version: str = "4.0",
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
    """
    judgement_phrases = {
        "green": (
            "מצוקה מבנית",
            "טיפול מיידי",
            "שחיקה",
            "לשפר",
            "שיפור",
        ),
    }
    if any(
        phrase in text
        for phrase in judgement_phrases.get(status, ())
    ):
        return False

    foreign_colours = [
        colour_word
        for colour_status, colour_word in _STATUS_WORDS_HEBREW.items()
        if colour_status != status
    ]
    if not foreign_colours:
        return True

    if contract_version != "5.0" or not distribution_counts:
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
    contract_version: str = "4.0",
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

    blocks: list[list[str]] = [[]]
    for line in text.strip().splitlines():
        stripped = line.strip()
        if stripped and stripped.strip("=") == "":
            blocks.append([])
            continue
        blocks[-1].append(line)

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
) -> str:
    """Which gate turns this batch away, as one word for a log line.

    `invalid_semantic_output` alone cost a whole investigation: the round of
    2026-07-29 dropped six recommendations to catalog copy and the log said
    only that something was wrong with the text. Two different causes hid
    behind that one label — a missing separator and numbers spelled out in
    words — and telling them apart needed the refused answer, which nothing
    kept. The empty string means the batch is acceptable.
    """
    parsed = parse_adaptation_batch(candidate, expected_steps_per_entry)
    if parsed is None:
        return "entry_shape"

    for summary, steps in parsed:
        if not all(is_hebrew_only_copy(part) for part in [summary, *steps]):
            return "not_hebrew"
        # An adaptation that quotes no number of the round is the catalog text
        # in different words: the whole point is that it speaks to these
        # aggregates. Digits only — "one in ten" reads as grounded and is not
        # something a reader can check against the map.
        if not _INTEGER_PATTERN.search(summary):
            return "no_number"
        if not is_status_consistent(
            " ".join([summary, *steps]),
            status,
            contract_version="5.0",
            distribution_counts=distribution_counts,
        ):
            return "status_inconsistent"
    return ""
