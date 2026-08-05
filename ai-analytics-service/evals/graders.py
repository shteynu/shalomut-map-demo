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
from typing import Any, Callable, Dict, List, Sequence, Tuple

from evals.corpus import CorpusCase, dimension_name_hebrew, question_texts_for

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
    from evals.corpus import status_for

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
    words = _words(summary)
    findings: List[str] = []
    claims: List[Dict[str, Any]] = []

    for index, word in enumerate(words):
        count = HEBREW_CARDINALS.get(word)
        if count is None:
            continue
        # The status word can trail the counted noun: "שלושה ממדים ירוקים".
        window = words[index + 1 : index + 4]
        if not _names_dimensions(window):
            continue
        for status, markers in STATUS_WORDS_HEBREW.items():
            if not any(marker in window for marker in markers):
                continue
            claims.append({"claimed": count, "status": status, "actual": actual[status]})
            if count != actual[status]:
                findings.append(
                    f"summary claims {count} {status} dimensions; "
                    f"the evidence has {actual[status]}"
                )

    # Digits are as much a claim as words, and easier to get wrong.
    for match in re.finditer(r"(\d+)\s+(\S+)\s*(\S*)", summary):
        count = int(match.group(1))
        tail = f"{match.group(2)} {match.group(3)}"
        if not _names_dimensions(_words(tail)):
            continue
        for status, markers in STATUS_WORDS_HEBREW.items():
            if any(marker in tail for marker in markers):
                claims.append({"claimed": count, "status": status, "actual": actual[status]})
                if count != actual[status]:
                    findings.append(
                        f"summary claims {count} {status} dimensions; "
                        f"the evidence has {actual[status]}"
                    )

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


Grader = Callable[[Dict[str, Any], CorpusCase], GraderResult]

GRADERS: Tuple[Grader, ...] = (
    grade_summary_grounding,
    grade_no_overreach,
    grade_evidence_specificity,
    grade_distinctness,
    grade_recommendation_fit,
)


def grade(payload: Dict[str, Any], case: CorpusCase) -> Sequence[GraderResult]:
    return [grader(payload, case) for grader in GRADERS]
