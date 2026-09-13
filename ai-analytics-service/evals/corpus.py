"""Synthetic rounds that are hard to write well about.

Every case is aggregate-only and invented: no respondent, no school, no real
answer is represented here, and none can be. What varies between cases is the
shape of the evidence — how the scores sit against each other, how the answers
spread inside one question, how many questions a dimension has, and since
contract `7.0` which scale a statement was answered on and which way it points
— because that is what a summary or an interpretation has to get right.

The cases are declared compactly and expanded into contract input, rather than
committed as expanded JSON. The spec is the part a person reads and changes;
the expansion is derivable, and a thousand lines of generated aggregates in Git
would hide the nine decisions that matter. If Core ever needs the same cases,
this is the point to emit shared JSON under `contracts/fixtures/`.
"""

import hashlib
import json
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple

from src.contracts import (
    AI_ANALYTICS_DIMENSION_IDS,
    AI_ANALYTICS_DIMENSION_NAMES_HEBREW,
)

# `7.0` since 2026-09-12. Until then the corpus ran on `6.0`, so every report
# in `baselines/` before that date measured prompts that had never seen a
# scale or a polarity, and none of them had the `polarity_reading` grader.
CORPUS_CONTRACT_VERSION = "7.0"
PRIVACY_THRESHOLD = 10

# The two scales the research instrument answers on. The colour scale is
# deliberately absent: a corpus on it would measure the questionnaire the
# product no longer starts a round with.
LIKERT_5 = "likert-5-extent"
LIKERT_7 = "likert-7-frequency"


@dataclass(frozen=True)
class QuestionSpec:
    """One statement of the questionnaire, as `7.0` describes it.

    `subjects` names the thing a reverse-scored statement is about — the
    demand a respondent was asked how much of they feel — in every surface
    form a narrative might use for it. It is what `polarity_reading` looks
    for: a statement with no subject is one the grader cannot read, and goes
    unmeasured rather than wrong.
    """

    text: str
    scale_id: str = LIKERT_5
    polarity: str = "positive"
    subjects: Tuple[str, ...] = ()


# A questionnaire's own words are what a grounded interpretation can echo, so
# each dimension gets statements that are actually about that dimension: one
# worded the way the dimension is good — agreeing is good — and one worded the
# way the instrument words its demands — agreeing is bad, and the average the
# model reads has already been reversed to say so. Deliberately plain: the
# corpus measures the analysis, not the questionnaire. The demand statements
# are the instrument's own phrasing where it has one.
QUESTIONS_HEBREW: Dict[str, Tuple[QuestionSpec, ...]] = {
    "self-expression": (
        QuestionSpec("אני יכולה להביע את דעתי בישיבות הצוות."),
        QuestionSpec(
            "חשש להביע דעה שונה משל ההנהלה",
            polarity="negative",
            subjects=("חשש", "חששות"),
        ),
    ),
    "professional-competence": (
        QuestionSpec("יש לי את הכלים המקצועיים שנדרשים לתפקיד."),
        QuestionSpec(
            "קושי להתמודד עם תלמידים מאתגרים",
            scale_id=LIKERT_7,
            polarity="negative",
            subjects=("קושי", "קשיים"),
        ),
    ),
    "social-resource": (
        QuestionSpec("יש לי עמיתים בבית הספר שאני יכולה לפנות אליהם."),
        QuestionSpec(
            "יחסים מתוחים בין עובדים (כמו יריבות, תחרות)",
            polarity="negative",
            subjects=("מתח", "מתיחות", "יריבות", "תחרות", "יחסים מתוחים"),
        ),
    ),
    "balance": (
        QuestionSpec("נשאר לי זמן למנוחה אחרי יום העבודה."),
        QuestionSpec(
            "לחץ זמן",
            polarity="negative",
            subjects=("לחץ", "לחצים"),
        ),
    ),
    "management-support": (
        QuestionSpec("ההנהלה מגבה אותי מול קשיים עם תלמידים והורים."),
        QuestionSpec(
            "יחסים מתוחים בין עובדים להנהלה",
            polarity="negative",
            subjects=("מתח", "מתיחות", "יחסים מתוחים"),
        ),
    ),
    "certainty": (
        QuestionSpec("אני יודעת מה מצופה ממני בתפקיד."),
        QuestionSpec(
            "אי ודאות לגבי המשך העסקה",
            polarity="negative",
            subjects=(
                "אי ודאות", "אי הוודאות", "אי-ודאות", "אי־ודאות",
                "חוסר ודאות", "חוסר הוודאות",
            ),
        ),
    ),
    "organizational-climate": (
        QuestionSpec("האווירה בחדר המורים נעימה לי."),
        QuestionSpec(
            "יחס פוגעני כלפיי במילים או בהתנהגות",
            scale_id=LIKERT_7,
            polarity="negative",
            subjects=("יחס פוגעני", "פגיעה", "פגיעות", "התנהגות פוגענית"),
        ),
    ),
    "meaning": (
        QuestionSpec(
            "אני חוזרת הביתה בתחושה שעשיתי משהו חשוב.",
            scale_id=LIKERT_7,
        ),
        QuestionSpec(
            "תסכול מכך שהעבודה אינה זוכה להכרה",
            polarity="negative",
            subjects=("תסכול", "תסכולים"),
        ),
    ),
}

# The texts alone, for the graders that echo them and the tests that write
# narratives out of them.
QUESTION_TEXTS_HEBREW: Dict[str, Tuple[str, ...]] = {
    dimension_id: tuple(question.text for question in questions)
    for dimension_id, questions in QUESTIONS_HEBREW.items()
}


def status_for(score: float) -> str:
    """The shared bands, restated here only so a case can declare a score."""
    if score >= 75:
        return "green"
    if score >= 50:
        return "yellow"
    return "red"


def survey_definition_hash(
    questions: List[Tuple[str, str, str]],
) -> str:
    """Core's `createSurveyDefinitionHash`, mirrored.

    Same projection, same code-point ordering, same compact JSON, so a corpus
    input carries a hash a real Core round would have produced for the same
    questionnaire rather than a plausible-looking placeholder.
    """
    projection = [
        {
            "questionId": question_id,
            "dimensionId": dimension_id,
            "questionText": text,
        }
        for question_id, dimension_id, text in sorted(questions)
    ]
    serialized = json.dumps(
        projection,
        ensure_ascii=False,
        separators=(",", ":"),
    )
    digest = hashlib.sha256(serialized.encode("utf-8")).hexdigest()
    return f"sha256:{digest}"


@dataclass(frozen=True)
class DimensionSpec:
    """One dimension's evidence: its score and how the answers spread.

    The score is the `7.0` average — normalised to 0–100 with the polarity
    already applied, so it means the same thing on every statement of the
    dimension: high is good. On a demand statement a low score is a demand
    felt strongly.
    """

    score: float
    # green/yellow/red counts per question. A spread that sums to the response
    # count but sits at the two ends is the polarization an average hides.
    spread: Tuple[int, int, int]
    question_count: int = 2


@dataclass(frozen=True)
class CorpusCase:
    case_id: str
    # What an analysis of this round has to get right, in one line. Read this
    # first when a grader fires: it says what the case was built to catch.
    challenge: str
    dimensions: Dict[str, DimensionSpec]
    total_responses: int = 10
    locked: bool = False
    background: Optional[Dict[str, object]] = field(default=None)

    def to_analysis_input(self) -> Dict[str, object]:
        """The case as contract input, in the shape Core would have sent."""
        dimension_scores: Dict[str, object] = {}
        question_aggregates: Dict[str, object] = {}
        questions: List[Tuple[str, str, str]] = []

        for dimension_id in AI_ANALYTICS_DIMENSION_IDS:
            spec = self.dimensions[dimension_id]
            if sum(spec.spread) != self.total_responses:
                # Caught here rather than by the contract parser, so the case
                # that is wrong is named instead of the question it produced.
                raise ValueError(
                    f"{self.case_id}/{dimension_id}: spread {spec.spread} "
                    f"does not sum to {self.total_responses} responses"
                )
            dimension_scores[dimension_id] = {
                "dimensionId": dimension_id,
                "averageScore": spec.score,
                "computedStatus": status_for(spec.score),
                "responseCount": self.total_responses,
            }
            for index, question in enumerate(questions_for(self, dimension_id)):
                question_id = f"{dimension_id}-q{index + 1}"
                green, yellow, red = spec.spread
                questions.append((question_id, dimension_id, question.text))
                question_aggregates[question_id] = {
                    "questionId": question_id,
                    "dimensionId": dimension_id,
                    "questionText": question.text,
                    "averageScore": spec.score,
                    "responseCount": self.total_responses,
                    # `7.0` defines this as the bands of normalised answer
                    # scores, which is what the spread has always declared.
                    "scoreDistribution": {
                        "green": green,
                        "yellow": yellow,
                        "red": red,
                    },
                    "scaleId": question.scale_id,
                    "polarity": question.polarity,
                }

        payload: Dict[str, object] = {
            "contractVersion": CORPUS_CONTRACT_VERSION,
            "roundId": f"eval-{self.case_id}",
            "totalResponses": self.total_responses,
            "privacyThreshold": PRIVACY_THRESHOLD,
            "isLocked": self.locked,
            "dimensionScores": {} if self.locked else dimension_scores,
            "questionAggregates": {} if self.locked else question_aggregates,
            "calculatedAt": "2026-08-04T09:00:00.000Z",
            "organizationId": f"eval-org-{self.case_id}",
            # The questionnaire is real even when the round is locked: the
            # snapshot is what was asked, not what came back.
            "surveyDefinitionHash": survey_definition_hash(questions),
        }
        if self.background:
            payload["backgroundContext"] = dict(self.background)
        return payload


def _uniform(score: float, spread: Tuple[int, int, int]) -> Dict[str, DimensionSpec]:
    return {
        dimension_id: DimensionSpec(score=score, spread=spread)
        for dimension_id in AI_ANALYTICS_DIMENSION_IDS
    }


def _scores(
    default: float,
    default_spread: Tuple[int, int, int],
    overrides: Dict[str, DimensionSpec],
) -> Dict[str, DimensionSpec]:
    specs = _uniform(default, default_spread)
    specs.update(overrides)
    return specs


CASES: Tuple[CorpusCase, ...] = (
    CorpusCase(
        case_id="uniformly-healthy",
        challenge=(
            "Nothing needs fixing. The summary must not invent a problem to "
            "have something to say, and must not congratulate its way into "
            "claims the answers do not support."
        ),
        dimensions=_uniform(84.0, (9, 1, 0)),
    ),
    CorpusCase(
        case_id="uniformly-weak",
        challenge=(
            "Everything is low. The summary has to stay specific and "
            "non-diagnostic instead of sliding into clinical language about "
            "the staff."
        ),
        dimensions=_uniform(34.0, (0, 2, 8)),
    ),
    CorpusCase(
        case_id="mixed-middle",
        challenge=(
            "Ordinary middle ground, and the twin of `polarized`. Same "
            "averages, agreed answers. A summary that reads only averages "
            "will say the same thing about both, which is the failure."
        ),
        dimensions=_uniform(60.0, (1, 8, 1)),
    ),
    CorpusCase(
        case_id="polarized",
        challenge=(
            "Same averages as `mixed-middle`, but the staff is split: half "
            "answer well, half answer badly, almost nobody in between. An "
            "analysis that calls this a moderate middle has missed the round."
        ),
        dimensions=_uniform(60.0, (5, 0, 5)),
    ),
    CorpusCase(
        case_id="contradictory",
        challenge=(
            "The work feels meaningful while management support is the worst "
            "score on the map. Both have to survive into the summary; "
            "averaging them into one mood is the failure."
        ),
        dimensions=_scores(
            62.0,
            (2, 6, 2),
            {
                "meaning": DimensionSpec(score=88.0, spread=(9, 1, 0)),
                "professional-competence": DimensionSpec(
                    score=81.0, spread=(8, 2, 0)
                ),
                "management-support": DimensionSpec(score=28.0, spread=(0, 1, 9)),
                "certainty": DimensionSpec(score=41.0, spread=(0, 3, 7)),
            },
        ),
    ),
    CorpusCase(
        case_id="workload-pressure",
        challenge=(
            "One dimension carries the round and the background explains why. "
            "Recommendations that ignore the staffing context are generic; "
            "a summary that treats the context as a cause has overreached."
        ),
        dimensions=_scores(
            66.0,
            (2, 7, 1),
            {"balance": DimensionSpec(score=31.0, spread=(0, 2, 8))},
        ),
        background={
            "totalStaffCount": 40,
            "notes": "שני מורים בחופשת מחלה ממושכת ושלושה מורים חדשים השנה.",
        },
    ),
    CorpusCase(
        case_id="reversed-demands",
        challenge=(
            "The trap `7.0` sets. The resources are fine and the demands are "
            "not: balance and certainty are red, and the evidence there is a "
            "reverse-scored statement — time pressure, job uncertainty — at a "
            "low normalised average, which means the demand is felt strongly. "
            "A narrative that reads the low number as little pressure has "
            "reversed the round; so has one that reads the healthy "
            "dimensions' low demands as heavy ones."
        ),
        dimensions=_scores(
            78.0,
            (8, 2, 0),
            {
                "balance": DimensionSpec(score=22.0, spread=(0, 2, 8)),
                "certainty": DimensionSpec(score=38.0, spread=(0, 3, 7)),
            },
        ),
    ),
    CorpusCase(
        case_id="dynamic-questionnaire",
        challenge=(
            "Not the default questionnaire: dimensions carry one or three "
            "questions and the ids are the round's own. Metrics must follow "
            "the snapshot rather than the template."
        ),
        dimensions=_scores(
            58.0,
            (3, 7, 4),
            {
                "self-expression": DimensionSpec(
                    score=58.0, spread=(3, 7, 4), question_count=1
                ),
                "balance": DimensionSpec(
                    score=44.0, spread=(1, 4, 9), question_count=1
                ),
                "meaning": DimensionSpec(
                    score=77.0, spread=(10, 4, 0), question_count=2
                ),
            },
        ),
        total_responses=14,
    ),
    CorpusCase(
        case_id="locked-below-threshold",
        challenge=(
            "One respondent short of the threshold. There is nothing to "
            "interpret and no detail may appear; the only correct output is "
            "the locked one."
        ),
        dimensions=_uniform(60.0, (1, 7, 1)),
        total_responses=PRIVACY_THRESHOLD - 1,
        locked=True,
    ),
)

CASES_BY_ID: Dict[str, CorpusCase] = {case.case_id: case for case in CASES}


def case_for_round_id(round_id: str) -> Optional[CorpusCase]:
    """The case a payload belongs to, matched on the round id it carries."""
    if not round_id.startswith("eval-"):
        return None
    return CASES_BY_ID.get(round_id[len("eval-") :])


def dimension_name_hebrew(dimension_id: str) -> str:
    return AI_ANALYTICS_DIMENSION_NAMES_HEBREW[dimension_id]


def questions_for(case: CorpusCase, dimension_id: str) -> List[QuestionSpec]:
    """The statements a dimension carries in this case, in question order.

    A dimension declared with more statements than the bank holds repeats the
    bank from the start, which is how `dynamic-questionnaire` gets its third
    question; one declared with a single statement keeps only the first — the
    positive one — and carries no demand for `polarity_reading` to read.
    """
    spec = case.dimensions[dimension_id]
    bank = QUESTIONS_HEBREW[dimension_id]
    return [bank[index % len(bank)] for index in range(spec.question_count)]


def question_texts_for(case: CorpusCase, dimension_id: str) -> List[str]:
    return [question.text for question in questions_for(case, dimension_id)]
