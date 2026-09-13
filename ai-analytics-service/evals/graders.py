"""Deterministic measurements of a Stone Map against the evidence behind it.

These are not gates. The safety validator already refuses a payload that breaks
a contract rule, and anything it refuses can never reach a grader. What is left
is the part no rule catches: text that is well formed, in Hebrew, the right
length, consistent about statuses — and still generic, repetitive, or making a
claim the numbers do not support.

Every grader here is a function of the payload and the case, with no provider,
no network and no randomness, so two runs of the same input produce the same
report and two prompt versions can be compared by subtracting one from the
other. A score is a measurement to look at, not a threshold to pass.
"""

import re
from dataclasses import dataclass, field
from typing import Any, Callable, Dict, List, Optional, Sequence, Tuple

from evals.corpus import (
    CorpusCase,
    dimension_name_hebrew,
    question_texts_for,
    questions_for,
    status_for,
)

# Hebrew cardinals as they appear next to a counted noun, feminine and
# masculine. Written out because a summary says "שלושה ממדים", not "3 ממדים".
HEBREW_CARDINALS: Dict[str, int] = {
    "אחד": 1, "אחת": 1, "שני": 2, "שתי": 2, "שניים": 2, "שתיים": 2,
    "שלוש": 3, "שלושה": 3, "ארבע": 4, "ארבעה": 4, "חמש": 5, "חמישה": 5,
    "שש": 6, "שישה": 6, "שבע": 7, "שבעה": 7, "שמונה": 8,
    # The construct forms, which is how a summary says "all eight dimensions":
    # "בכל שמונת הממדים". The 2026-08-05 run used them and the plain forms
    # never appeared.
    "שלושת": 3, "ארבעת": 4, "חמשת": 5, "ששת": 6, "שבעת": 7, "שמונת": 8,
}
# "כל" is deliberately absent. It reads as eight only when the sentence is
# about all eight dimensions, and "כל הממדים האדומים" is about however many
# are red — mapping it to a number would invent findings.

STATUS_WORDS_HEBREW: Dict[str, Tuple[str, ...]] = {
    "green": ("ירוק", "ירוקים", "ירוקות", "חזק", "חזקים", "גבוה", "גבוהים"),
    "yellow": ("צהוב", "צהובים", "צהובות", "בינוני", "בינוניים"),
    "red": ("אדום", "אדומים", "אדומות", "נמוך", "נמוכים", "חלש", "חלשים"),
}

# Words that name a condition rather than describe an answer. The service is
# not diagnosing anyone, and a wellbeing survey of ten people cannot.
CLINICAL_TERMS_HEBREW: Tuple[str, ...] = (
    "שחיקה", "דיכאון", "חרדה", "טראומה", "הפרעה", "פתולוגי", "פתולוגיה",
    "משבר נפשי", "אבחנה", "תסמונת", "דחק פוסט", "התמוטטות",
)

# Phrases that assert one thing caused another. Aggregates show co-occurrence;
# they cannot carry a cause, so an assertion of one is an overreach.
CAUSAL_PHRASES_HEBREW: Tuple[str, ...] = (
    "בגלל", "כתוצאה מ", "גורם ל", "גורמת ל", "גורמים ל", "נובע מ",
    "נובעת מ", "נובעים מ", "מוביל ל", "מובילה ל", "בשל כך ש", "עקב",
)

# Words too common to count as shared content between a narrative and the
# question it is supposed to be about.
HEBREW_STOPWORDS: frozenset = frozenset(
    """
    אני את אתה אנחנו הם הן זה זו זאת אלה של על עם אל מן מ ב ל כ ה ו
    כי אם או גם רק עוד יש אין לא כן מה מי איך כמה יותר פחות כל כדי
    אשר הוא היא אבל אז שם פה כאן היה היתה היו להיות בין לפי אחרי לפני
    שלי שלך שלו שלה שלנו שלהם בו בה בהם מאוד ממש כמו נראה מרגיש מרגישה
    """.split()
)

WORD_PATTERN = re.compile(r"[\u0590-\u05ff\ufb1d-\ufb4f]+")

_HEBREW_LETTER = r"[\u0590-\u05ff\ufb1d-\ufb4f]"
# Hebrew glues its short prepositions and articles onto the next word, so a
# term has to be findable behind them: "\u05de\u05e9\u05d7\u05d9\u05e7\u05d4" is "\u05e9\u05d7\u05d9\u05e7\u05d4" with a \u05de.
_ATTACHED_PREFIXES = r"[\u05d5\u05d4\u05d1\u05dc\u05de\u05db\u05e9]{0,2}"
# A phrase whose last token is a bare one-letter preposition expects the
# next word to be glued onto it — "נובע מהעומס" — so it takes no closing
# boundary. A whole word that merely happens to end in such a letter,
# like "עקב", very much does.
_CLITIC_PARTICLES = frozenset("למבש")


# Below this length, a term is not looked for behind an attached prefix.
# Hebrew gives no way to tell "\u05de + \u05e2\u05e7\u05d1" from the ordinary noun "\u05de\u05e2\u05e7\u05d1" \u2014
# follow-up, which the service's own deterministic copy uses in nearly every
# round \u2014 without a morphological analyser. Longer terms are safe: nothing
# reads "\u05de\u05e9\u05d7\u05d9\u05e7\u05d4" as a word in its own right.
_MIN_LENGTH_FOR_PREFIXES = 4


def _compile_term(term: str) -> "re.Pattern[str]":
    """A term matched as a word, not as a run of letters inside one.

    Written the long way because the naive `term in text` found the causal
    "\u05e2\u05e7\u05d1" inside both "\u05d1\u05e2\u05e7\u05d1\u05d9\u05d5\u05ea" \u2014 consistently \u2014 and "\u05de\u05e2\u05e7\u05d1" \u2014
    follow-up. Both turned up by running the graders over payloads nobody
    wrote for them. A grader that invents findings is worse than no grader: it
    spends the reader's trust on noise.
    """
    opening = (
        _ATTACHED_PREFIXES
        if len(term.split()[0]) >= _MIN_LENGTH_FOR_PREFIXES
        else ""
    )
    trails_a_particle = term.split()[-1] in _CLITIC_PARTICLES
    closing = "" if trails_a_particle else f"(?!{_HEBREW_LETTER})"
    return re.compile(
        f"(?<!{_HEBREW_LETTER}){opening}{re.escape(term)}{closing}"
    )


# The noun a counting claim has to be about. A summary that counts *answers* —
# "18 תשובות ירוקות ו-2 תשובות צהובות מתוך 20" — is counting something else,
# and reading it as a count of dimensions is how this grader used to invent
# findings. Written with the same attached prefixes as every other term here,
# so "הממדים" and "ובממד" are found.
_DIMENSION_NOUN_PATTERN = re.compile(
    f"(?<!{_HEBREW_LETTER}){_ATTACHED_PREFIXES}ממד(?:ים|י)?(?!{_HEBREW_LETTER})"
)


# Where one claim stops and the next begins. Brackets and dashes count: a
# parenthesis closes a clause as firmly as a comma does.
_CLAUSE_BOUNDARY = re.compile(r"[,;:.!?()\[\]\n–—]+")


def _names_dimensions(words: Sequence[str]) -> bool:
    return any(_DIMENSION_NOUN_PATTERN.search(word) for word in words)


_CLINICAL_PATTERNS = tuple(
    (term, _compile_term(term)) for term in CLINICAL_TERMS_HEBREW
)
_CAUSAL_PATTERNS = tuple(
    (term, _compile_term(term)) for term in CAUSAL_PHRASES_HEBREW
)


def _words(text: str) -> List[str]:
    return WORD_PATTERN.findall(text or "")


def _content_words(text: str) -> set:
    return {word for word in _words(text) if word not in HEBREW_STOPWORDS and len(word) > 2}


def _jaccard(left: set, right: set) -> float:
    if not left or not right:
        return 0.0
    return len(left & right) / len(left | right)


@dataclass(frozen=True)
class GraderResult:
    """One measurement.

    `score` runs 0.0 to 1.0, higher is better, and is only ever a summary of
    `measured`. `findings` names what pulled it down, in the words an operator
    would need to go and look at the text.
    """

    name: str
    score: float
    findings: Tuple[str, ...] = ()
    measured: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "score": round(self.score, 4),
            "findings": list(self.findings),
            "measured": self.measured,
        }


def _stones(payload: Dict[str, Any]) -> Dict[str, Dict[str, Any]]:
    stones = payload.get("stones")
    return stones if isinstance(stones, dict) else {}


def _stone_narrative(stone: Dict[str, Any]) -> str:
    """A stone's prose, whichever contract shape carries it."""
    summary = stone.get("summary")
    if isinstance(summary, list):
        return " ".join(str(part) for part in summary)
    interpretation = stone.get("psychologicalInterpretation")
    return str(interpretation) if isinstance(interpretation, str) else ""


def _actual_status_counts(case: CorpusCase) -> Dict[str, int]:
    counts = {"green": 0, "yellow": 0, "red": 0}
    for spec in case.dimensions.values():
        counts[status_for(spec.score)] += 1
    return counts


def grade_summary_grounding(
    payload: Dict[str, Any],
    case: CorpusCase,
) -> GraderResult:
    """Does the overall summary count the map correctly?

    The claim this looks for is "<number> dimensions are <status>". It is the
    one assertion in the summary that the evidence can settle outright, and the
    only part of the summary the runtime currently checks is its language and
    its shape — so a wrong count reaches a manager today.

    All three parts have to be there: the number, the noun and the status. A
    summary counting anything else — answers, questions, points — is counting a
    different set, and the evidence here cannot settle it. Those go unmeasured
    rather than wrong; a claim this grader cannot check is not a claim the
    model got wrong.
    """
    summary = str(payload.get("overallPsychologicalSummary") or "")
    actual = _actual_status_counts(case)
    findings: List[str] = []
    claims: List[Dict[str, Any]] = []

    def record(count: int, status: str) -> None:
        claims.append({"claimed": count, "status": status, "actual": actual[status]})
        if count != actual[status]:
            findings.append(
                f"summary claims {count} {status} dimensions; "
                f"the evidence has {actual[status]}"
            )

    # A claim lives inside one clause. Read across a comma or a bracket and the
    # noun of the next clause lands in the window of this one's number: the run
    # of 2026-08-05 wrote "(score 28, with 18 red answers and 2 yellow) and the
    # certainty dimension", which scored as a claim that two dimensions are
    # yellow. The counted noun has to be the one the number is next to.
    for clause in _CLAUSE_BOUNDARY.split(summary):
        words = _words(clause)

        for index, word in enumerate(words):
            count = HEBREW_CARDINALS.get(word)
            if count is None:
                continue
            # The status word can trail the counted noun: "שלושה ממדים ירוקים".
            window = words[index + 1 : index + 4]
            if not _names_dimensions(window):
                continue
            for status, markers in STATUS_WORDS_HEBREW.items():
                if any(marker in window for marker in markers):
                    record(count, status)

        # Digits are as much a claim as words, and easier to get wrong.
        for match in re.finditer(r"(\d+)\s+(\S+)\s*(\S*)", clause):
            count = int(match.group(1))
            tail = f"{match.group(2)} {match.group(3)}"
            if not _names_dimensions(_words(tail)):
                continue
            for status, markers in STATUS_WORDS_HEBREW.items():
                if any(marker in tail for marker in markers):
                    record(count, status)

    # No countable claim is not a failure: a summary may legitimately describe
    # the round without counting it. It scores as unmeasured, which is 1.0 for
    # this grader and visible as `claims: 0` in the report.
    wrong = len(findings)
    score = 1.0 if not claims else max(0.0, 1.0 - wrong / len(claims))
    return GraderResult(
        name="summary_grounding",
        score=score,
        findings=tuple(findings),
        measured={
            "claims": len(claims),
            "unsupported": wrong,
            "actualStatusCounts": actual,
        },
    )


def _overreach_hits(text: str, patterns) -> List[str]:
    return [term for term, pattern in patterns if pattern.search(text or "")]


def grade_no_overreach(
    payload: Dict[str, Any],
    case: CorpusCase,
) -> GraderResult:
    """Clinical vocabulary and asserted causes, anywhere in the payload.

    The runtime denies one clinical word on green dimensions. This measures the
    whole map, because a red dimension is exactly where the temptation to
    diagnose is strongest and where doing it would be worst.
    """
    findings: List[str] = []
    clinical = 0
    causal = 0

    texts: List[Tuple[str, str]] = [
        ("summary", str(payload.get("overallPsychologicalSummary") or ""))
    ]
    for dimension_id, stone in sorted(_stones(payload).items()):
        texts.append((f"{dimension_id}.narrative", _stone_narrative(stone)))
        for metric in stone.get("metrics") or []:
            texts.append(
                (f"{dimension_id}.metric", str(metric.get("insightText") or ""))
            )
        for intervention in stone.get("recommendedInterventions") or []:
            texts.append(
                (f"{dimension_id}.intervention", str(intervention.get("summary") or ""))
            )

    for where, text in texts:
        for term in _overreach_hits(text, _CLINICAL_PATTERNS):
            clinical += 1
            findings.append(f"{where}: clinical term “{term}”")
        for phrase in _overreach_hits(text, _CAUSAL_PATTERNS):
            causal += 1
            findings.append(f"{where}: asserted cause “{phrase}”")

    # Clinical language is the worse of the two, so it costs more per hit.
    penalty = min(1.0, (clinical * 0.34) + (causal * 0.12))
    return GraderResult(
        name="no_overreach",
        score=1.0 - penalty,
        findings=tuple(findings),
        measured={
            "clinicalTerms": clinical,
            "assertedCauses": causal,
            "textsChecked": len(texts),
        },
    )


def grade_evidence_specificity(
    payload: Dict[str, Any],
    case: CorpusCase,
) -> GraderResult:
    """Is a dimension's narrative about that dimension's questions?

    Measured as shared content words between the narrative and the round's own
    question texts. It cannot tell insight from echo, and it is not meant to:
    what it catches is the paragraph that would read identically for any
    school, which no contract rule forbids.
    """
    per_dimension: Dict[str, float] = {}
    findings: List[str] = []

    for dimension_id, stone in sorted(_stones(payload).items()):
        if dimension_id not in case.dimensions:
            continue
        narrative = _content_words(_stone_narrative(stone))
        question_words: set = set()
        for text in question_texts_for(case, dimension_id):
            question_words |= _content_words(text)
        question_words.add(dimension_name_hebrew(dimension_id))

        overlap = len(narrative & question_words)
        share = overlap / len(question_words) if question_words else 0.0
        per_dimension[dimension_id] = round(share, 4)
        if overlap == 0:
            findings.append(
                f"{dimension_id}: the narrative shares no content word with "
                "the dimension's own questions"
            )

    if not per_dimension:
        return GraderResult(
            name="evidence_specificity",
            score=1.0,
            measured={"dimensions": 0},
        )

    mean_share = sum(per_dimension.values()) / len(per_dimension)
    return GraderResult(
        name="evidence_specificity",
        # A fifth of a question's content words echoed is already a narrative
        # visibly about this dimension, so that is where the scale tops out.
        score=min(1.0, mean_share / 0.2),
        findings=tuple(findings),
        measured={"perDimension": per_dimension, "meanShare": round(mean_share, 4)},
    )


def grade_distinctness(
    payload: Dict[str, Any],
    case: CorpusCase,
) -> GraderResult:
    """Eight dimensions, or one paragraph written eight times?

    Every stone passing its own validation says nothing about whether the map
    says eight things. Pairwise word overlap does.
    """
    narratives = {
        dimension_id: _content_words(_stone_narrative(stone))
        for dimension_id, stone in sorted(_stones(payload).items())
    }
    dimension_ids = [key for key, words in narratives.items() if words]
    if len(dimension_ids) < 2:
        return GraderResult(
            name="distinctness",
            score=1.0,
            measured={"pairs": 0},
        )

    findings: List[str] = []
    similarities: List[float] = []
    for left_index, left in enumerate(dimension_ids):
        for right in dimension_ids[left_index + 1 :]:
            similarity = _jaccard(narratives[left], narratives[right])
            similarities.append(similarity)
            if similarity >= 0.8:
                findings.append(
                    f"{left} and {right} narratives are {similarity:.0%} the "
                    "same words"
                )

    mean_similarity = sum(similarities) / len(similarities)
    return GraderResult(
        name="distinctness",
        score=max(0.0, 1.0 - mean_similarity),
        findings=tuple(findings),
        measured={
            "pairs": len(similarities),
            "meanSimilarity": round(mean_similarity, 4),
            "maxSimilarity": round(max(similarities), 4),
        },
    )


def grade_recommendation_fit(
    payload: Dict[str, Any],
    case: CorpusCase,
) -> GraderResult:
    """Do the recommendations belong to the stone they were filed under?

    Three things a catalogue slice can get wrong without breaking a contract:
    a recommendation carrying another dimension's id, one aimed at a status the
    stone is not in, and five entries that are the same entry five times.
    """
    findings: List[str] = []
    total = 0
    misfiled = 0
    duplicated = 0

    for dimension_id, stone in sorted(_stones(payload).items()):
        interventions = stone.get("recommendedInterventions") or []
        titles: List[str] = []
        for intervention in interventions:
            total += 1
            if intervention.get("dimensionId") not in (None, dimension_id):
                misfiled += 1
                findings.append(
                    f"{dimension_id}: recommendation carries dimensionId "
                    f"{intervention.get('dimensionId')!r}"
                )
            status = intervention.get("status")
            if status is not None and status != stone.get("status"):
                misfiled += 1
                findings.append(
                    f"{dimension_id}: recommendation aimed at {status!r} on a "
                    f"{stone.get('status')!r} stone"
                )
            titles.append(str(intervention.get("title") or ""))

        distinct = len({title for title in titles if title})
        if titles and distinct < len(titles):
            repeats = len(titles) - distinct
            duplicated += repeats
            findings.append(
                f"{dimension_id}: {repeats} of {len(titles)} recommendations "
                "repeat a title"
            )

    if total == 0:
        return GraderResult(
            name="recommendation_fit",
            score=1.0,
            measured={"recommendations": 0},
        )

    score = max(0.0, 1.0 - (misfiled + duplicated) / total)
    return GraderResult(
        name="recommendation_fit",
        score=score,
        findings=tuple(findings),
        measured={
            "recommendations": total,
            "misfiled": misfiled,
            "repeatedTitles": duplicated,
        },
    )


# --- reading a reverse-scored statement the way its number points ------------
#
# `7.0` hands the model a normalised average with the polarity already applied,
# and one sentence saying so (`hebrew_prompts.ANSWER_SCALE_RULE`). On a demand
# statement — "time pressure" — an average of 20 therefore means the pressure is
# felt strongly, and a model that reads 20 as "little" has reversed the round
# while producing prose every runtime rule accepts. Nothing below refuses it;
# this is the measurement of whether the one sentence is enough.
#
# The reading is taken from the words around the statement's subject. Hebrew
# puts the adjective after the noun — "לחץ זמן גבוה" — and the negation or the
# quantifier before it — "אין לחץ", "מעט לחץ" — so the two windows are
# different sizes and read different lists.

# The demand is felt little. Adjectives after the subject.
_LITTLE_AFTER: frozenset = frozenset(
    """
    נמוך נמוכה נמוכים נמוכות מועט מועטה מועטים מועטות קל קלה קלים קלות
    זניח זניחה זניחים זניחות מינימלי מינימלית נדיר נדירה נדירים נדירות
    מוגבל מוגבלת מוגבלים מוגבלות
    """.split()
)
# Negations and small quantifiers before the subject. "היעדר" — absence —
# is here because the 2026-09-12 run wrote "היעדר תסכול משמעותי", the absence
# of significant frustration, and the adjective alone reads as much.
_LITTLE_BEFORE: frozenset = frozenset(
    "לא אין אינו אינה אינם אינן ללא בלי מעט קצת מיעוט היעדר העדר".split()
)
# The demand is felt strongly. Adjectives after the subject.
_MUCH_AFTER: frozenset = frozenset(
    """
    גבוה גבוהה גבוהים גבוהות רב רבה רבים רבות כבד כבדה כבדים כבדות
    ניכר ניכרת ניכרים ניכרות משמעותי משמעותית משמעותיים משמעותיות
    מוגבר מוגברת מוגברים מוגברות חזק חזקה חזקים חזקות קשה קשים קשות
    בולט בולטת בולטים בולטות מתמשך מתמשכת מתמשכים מתמשכות עז עזה
    מכביד מכבידה מכבידים מכבידות תכוף תכופה תכופים תכופות
    שכיח שכיחה שכיחים שכיחות
    """.split()
)
# Large quantifiers before the subject.
_MUCH_BEFORE: frozenset = frozenset("הרבה ריבוי".split())

# Everything Hebrew glues onto the front of a word: conjunction, article,
# prepositions, relative pronoun. Two at most — "שהלחץ" is "ש" + "ה" + "לחץ".
_GLUED_PREFIX_LETTERS = "והבלמכש"
# "לחץ הזמן על הצוות גבוה" puts the adjective four words after the subject.
_AFTER_WINDOW = 4
_BEFORE_WINDOW = 2


def _unglued(word: str) -> Tuple[str, ...]:
    """The word and the forms it has once its glued prefixes come off."""
    forms = [word]
    stripped = word
    for _ in range(2):
        if len(stripped) > 2 and stripped[0] in _GLUED_PREFIX_LETTERS:
            stripped = stripped[1:]
            forms.append(stripped)
        else:
            break
    return tuple(forms)


def _subject_at(words: Sequence[str], index: int, subject: Tuple[str, ...]) -> bool:
    """Does the subject phrase start at this word, prefixes allowed on the first?"""
    if index + len(subject) > len(words):
        return False
    if subject[0] not in _unglued(words[index]):
        return False
    return all(
        words[index + offset] == part or f"ה{part}" == words[index + offset]
        for offset, part in enumerate(subject[1:], start=1)
    )


def _reading_around(
    words: Sequence[str], start: int, length: int
) -> Optional[str]:
    """`little`, `much`, or None when the words around a subject say neither.

    A negation two words back counts only when the word between is not an
    infinitive: "לא חשים לחץ" negates the pressure, "אין להסיק שהלחץ" negates
    an inference about it. What stands before the subject outranks what
    follows it — "היעדר תסכול משמעותי" is the absence of frustration, not a
    lot of it. The window after the subject closes at a conjunction, because
    "מתח מדווח ותחושה נמוכה" hangs "נמוכה" on the feeling, not the tension.
    Both readings on one side at once is ambiguity, not a finding.
    """
    before_readings = set()
    before = words[max(0, start - _BEFORE_WINDOW) : start]
    for distance, word in enumerate(reversed(before), start=1):
        if distance == 2 and before[-1].startswith("ל"):
            break
        if word in _LITTLE_BEFORE:
            before_readings.add("little")
        if word in _MUCH_BEFORE:
            before_readings.add("much")
    if before_readings:
        return before_readings.pop() if len(before_readings) == 1 else None

    after_readings = set()
    for word in words[start + length : start + length + _AFTER_WINDOW]:
        if word.startswith("ו") and len(word) > 2:
            break
        forms = _unglued(word)
        if any(form in _LITTLE_AFTER for form in forms):
            after_readings.add("little")
        if any(form in _MUCH_AFTER for form in forms):
            after_readings.add("much")
    if len(after_readings) == 1:
        return after_readings.pop()
    return None


def _descriptive_paragraphs(stone: Dict[str, Any]) -> List[str]:
    """The part of a stone that reads the evidence, not the part that proposes.

    A `7.0` summary is three paragraphs by prompt: the state, the patterns, and
    a focus to take to the staff. The third is a proposal, and so are the
    recommendations — "a space without fear of rivalry" is a wish, not a
    reading of how much rivalry there is, and the 2026-09-12 run wrote exactly
    that on a red stone. Only the first two are read; an older single-string
    interpretation is read whole.
    """
    summary = stone.get("summary")
    if isinstance(summary, list):
        return [str(part) for part in summary[:2]]
    return [_stone_narrative(stone)]


def grade_polarity_reading(
    payload: Dict[str, Any],
    case: CorpusCase,
) -> GraderResult:
    """Is a reverse-scored statement read the way its number points?

    Only a stone whose score settles the direction is measured: red means every
    demand in it is felt strongly, green that every demand is felt little. A
    yellow stone could fairly be written either way and is skipped, and so is a
    statement whose subject the text never names — a narrative may read a
    dimension without naming its demand, and that is not a reversed reading.
    Read from the two descriptive paragraphs only; see `_descriptive_paragraphs`.
    """
    findings: List[str] = []
    readings = 0
    reversed_count = 0
    per_dimension: Dict[str, Dict[str, int]] = {}

    for dimension_id, stone in sorted(_stones(payload).items()):
        if dimension_id not in case.dimensions:
            continue
        status = status_for(case.dimensions[dimension_id].score)
        if status == "yellow":
            continue
        expected = "much" if status == "red" else "little"
        subjects = [
            tuple(subject.split())
            for question in questions_for(case, dimension_id)
            if question.polarity == "negative"
            for subject in question.subjects
        ]
        if not subjects:
            continue

        counted = {"readings": 0, "reversed": 0}
        for text in _descriptive_paragraphs(stone):
            for clause in _CLAUSE_BOUNDARY.split(text):
                words = _words(clause)
                for index in range(len(words)):
                    matched = next(
                        (s for s in subjects if _subject_at(words, index, s)),
                        None,
                    )
                    if matched is None:
                        continue
                    reading = _reading_around(words, index, len(matched))
                    if reading is None:
                        continue
                    counted["readings"] += 1
                    if reading != expected:
                        counted["reversed"] += 1
                        findings.append(
                            f"{dimension_id}: “{clause.strip()}” reads "
                            f"{' '.join(matched)} as {reading}, but the "
                            f"normalised average "
                            f"{case.dimensions[dimension_id].score:g} on a "
                            f"reverse-scored statement means {expected}"
                        )
        if counted["readings"]:
            per_dimension[dimension_id] = counted
            readings += counted["readings"]
            reversed_count += counted["reversed"]

    score = 1.0 if not readings else max(0.0, 1.0 - reversed_count / readings)
    return GraderResult(
        name="polarity_reading",
        score=score,
        findings=tuple(findings),
        measured={
            "readings": readings,
            "reversed": reversed_count,
            "perDimension": per_dimension,
        },
    )


Grader = Callable[[Dict[str, Any], CorpusCase], GraderResult]

GRADERS: Tuple[Grader, ...] = (
    grade_summary_grounding,
    grade_no_overreach,
    grade_evidence_specificity,
    grade_distinctness,
    grade_recommendation_fit,
    grade_polarity_reading,
)


def grade(payload: Dict[str, Any], case: CorpusCase) -> Sequence[GraderResult]:
    return [grader(payload, case) for grader in GRADERS]
