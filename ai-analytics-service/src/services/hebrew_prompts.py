from src.contracts import AI_ANALYTICS_V4_CONTRACT_VERSION, AI_ANALYTICS_V5_CONTRACT_VERSION, AI_ANALYTICS_CONTRACT_VERSION
from src.schemas.contract_registry import get_capabilities
"""The Hebrew this service composes itself.

Two kinds of it: the prompts sent to a provider, and the one interpretation
written here on purpose — the green dimension's, reached either because the
provider was not asked or because it did not answer. Both are text construction
over a round's aggregates and neither needs a network, so they sit apart from the
transport that carries them.
"""

import re
from typing import Any, Dict, Iterable, Optional

from src.contracts import (
    AI_ANALYTICS_DIMENSION_NAMES_HEBREW,
    AI_ANALYTICS_QUESTIONS,
)

# How a status is named to the model. Deliberately not a colour: the copy is
# refused for naming a foreign colour, so handing the model colour words to
# echo would be entrapment. The buckets keep their colours, because there the
# word is attached to a count.
_STATUS_LABELS_HEBREW = {
    "green": "תקין",
    "yellow": "דורש מעקב",
    "red": "דורש התערבות",
}


def status_label(status: str) -> str:
    return _STATUS_LABELS_HEBREW.get(status, status)


def question_text(aggregate: Dict[str, Any]) -> str:
    dynamic_text = aggregate.get("questionText")
    if isinstance(dynamic_text, str):
        return dynamic_text
    legacy_text = aggregate.get("questionTextHebrew")
    return legacy_text if isinstance(legacy_text, str) else ""


def background_context_lines(
    background_context: Optional[Dict[str, Any]],
) -> list[str]:
    """School-level context lines shared by every prompt that carries it."""
    if not isinstance(background_context, dict):
        return []

    lines = []
    if background_context.get("notes"):
        lines.append(f"הערות רקע מהמנהלת: {background_context['notes']}")
    if background_context.get("audience"):
        lines.append(f"קהל יעד: {background_context['audience']}")
    if background_context.get("studentCount"):
        lines.append(f"מספר תלמידים: {background_context['studentCount']}")
    if background_context.get("socioEconomicIndex"):
        lines.append(f"מדד טיפוח: {background_context['socioEconomicIndex']}")
    if background_context.get("newStaffMembers"):
        lines.append(f"צוות חדש: {background_context['newStaffMembers']}")
    if background_context.get("sicknessDaysThisQuarter"):
        lines.append(
            "ימי מחלה ברבעון: "
            f"{background_context['sicknessDaysThisQuarter']}"
        )
    classes = background_context.get("classesPerGrade")
    if isinstance(classes, dict) and classes:
        classes_str = ", ".join(
            f"שכבה {grade}: {count}"
            for grade, count in classes.items()
            if count
        )
        if classes_str:
            lines.append(f"כיתות: {classes_str}")
    return lines


def summed_distribution(
    question_aggregates: Iterable[Dict[str, Any]],
) -> Optional[Dict[str, int]]:
    totals = {"green": 0, "yellow": 0, "red": 0}
    seen = False
    for aggregate in question_aggregates:
        distribution = aggregate.get("scoreDistribution")
        if not isinstance(distribution, dict):
            continue
        for bucket in totals:
            count = distribution.get(bucket)
            if isinstance(count, int) and not isinstance(count, bool):
                totals[bucket] += count
                seen = True
    return totals if seen else None


def interpretation_prompt(
    dim_id: str,
    dim_hebrew: str,
    score: float,
    status: str,
    question_aggregates: list[Dict[str, Any]],
    background_context: Optional[Dict[str, Any]] = None,
    contract_version: str = AI_ANALYTICS_CONTRACT_VERSION,
    all_dimension_scores: Optional[Dict[str, Any]] = None,
) -> str:
    uses_dynamic_questions = any(
        isinstance(aggregate.get("questionText"), str)
        for aggregate in question_aggregates
    )
    lines = []
    for aggregate in question_aggregates:
        dist_str = ""
        if get_capabilities(contract_version).supportsScoreDistribution and isinstance(aggregate.get("scoreDistribution"), dict):
            dist = aggregate["scoreDistribution"]
            dist_str = f" (תשובות: {dist.get('green', 0)} ירוק, {dist.get('yellow', 0)} צהוב, {dist.get('red', 0)} אדום)"
        lines.append(
            f"- {question_text(aggregate)} ממוצע {aggregate['averageScore']:.0f}, מספר תשובות {aggregate['responseCount']}{dist_str}"
        )
    aggregate_lines = "\n".join(lines)

    bg_lines = background_context_lines(background_context)
    bg_section = ("\nרקע בית הספר:\n" + "\n".join(bg_lines)) if bg_lines else ""

    cross_dim_section = ""
    if get_capabilities(contract_version).supportsScoreDistribution and isinstance(all_dimension_scores, dict) and all_dimension_scores:
        cd_lines = []
        for d_id, d_val in all_dimension_scores.items():
            s_val = d_val.get("averageScore", 0.0) if isinstance(d_val, dict) else getattr(d_val, "averageScore", 0.0)
            st_val = d_val.get("computedStatus", "") if isinstance(d_val, dict) else getattr(d_val, "computedStatus", "")
            d_heb = AI_ANALYTICS_DIMENSION_NAMES_HEBREW.get(d_id, d_id)
            cd_lines.append(
                f"- {d_heb}: ציון {s_val:.0f}, מצב {status_label(st_val)}"
            )
        cross_dim_section = "\nתמונת שמונת הממדים:\n" + "\n".join(cd_lines) + "\n"

    length_instruction = (
        "כתוב בין 2 ל-5 משפטים שלמים."
        if get_capabilities(contract_version).supportsScoreDistribution
        else "כתוב בדיוק שני משפטים שלמים."
    )

    # Only 5.0 shows the model the buckets, so only 5.0 needs the rule for
    # quoting them — and gating it here keeps the prompt of the closed
    # versions exactly what it was when their results were written.
    # Measured on `gemini-3.5-flash-lite`, 2026-07-29: shown 8 green, 9 yellow
    # and 3 red on one question, the model wrote "12 of 20 reported a lack of
    # support". The arithmetic is real and the sentence is false — yellow is
    # attention, not absence — and no validator catches a number that was
    # merely added up wrong.
    bucket_instruction = (
        " צטט כל קבוצת תשובות בנפרד: אל תחבר קבוצות צבע או שאלות שונות "
        "למספר אחד, וזכור שצהוב מסמן מעקב ולא חוסר."
        if get_capabilities(contract_version).supportsScoreDistribution
        else ""
    )

    return (
        "את/ה פסיכולוג/ית ארגוני/ת המנתח/ת אך ורק נתונים מצרפיים "
        "שאינם חושפים משיבים, על רווחת צוות חינוכי.\n"
        f"ממד: {dim_hebrew}. ציון: {score:.0f} מתוך 100. "
        f"מצב: {status_label(status)}.{bg_section}\n"
        f"{cross_dim_section}"
        f"{'שאלות הממד כפי שנשמרו' if uses_dynamic_questions else 'שאלות הממד'}"
        f":\n{aggregate_lines}\n"
        f"{length_instruction} בסס כל טענה על הנתונים שלמעלה, אל תמציא "
        "סיבות, אבחנות, זהויות או עובדות על משיב יחיד, ושמור על עקביות "
        f"עם המצב שצוין.{bucket_instruction} כתוב בעברית בלבד, בלי "
        "אותיות לטיניות, ורשום מספרים בספרות ולא במילים."
    )


def overall_summary_prompt(
    dim_scores: Dict[str, Any],
    question_aggregates: Iterable[Dict[str, Any]] | None = None,
    background_context: Optional[Dict[str, Any]] = None,
) -> str:
    """The round-level picture: eight dimensions with their distributions.

    Score and status alone cannot separate "everyone answered yellow" from
    "half green, half red", which are different rounds to write about.
    """
    aggregates = list(question_aggregates or [])
    dim_lines = []
    for dimension_id, dimension_score in dim_scores.items():
        score_value = (
            dimension_score.get("averageScore", 0.0)
            if isinstance(dimension_score, dict)
            else getattr(dimension_score, "averageScore", 0.0)
        )
        status_value = (
            dimension_score.get("computedStatus", "")
            if isinstance(dimension_score, dict)
            else getattr(dimension_score, "computedStatus", "")
        )
        hebrew_name = AI_ANALYTICS_DIMENSION_NAMES_HEBREW.get(
            dimension_id,
            dimension_id,
        )
        line = (
            f"- {hebrew_name}: ציון {score_value:.0f}, "
            f"מצב {status_label(status_value)}"
        )
        distribution = summed_distribution(
            aggregate
            for aggregate in aggregates
            if aggregate.get("dimensionId") == dimension_id
        )
        if distribution:
            # The buckets are summed over the dimension's questions, so they
            # count answers and outrun the respondents as soon as a dimension
            # has more than one question. Stating the total next to them is
            # what stops the model reading them as a headcount — see the
            # instruction below.
            answers_total = (
                distribution["green"]
                + distribution["yellow"]
                + distribution["red"]
            )
            line += (
                f" (פיזור: {distribution['green']} ירוק / "
                f"{distribution['yellow']} צהוב / "
                f"{distribution['red']} אדום, "
                f"מתוך {answers_total} תשובות)"
            )
        dim_lines.append(line)

    lines = background_context_lines(background_context)
    background_section = (
        "\nרקע בית הספר:\n" + "\n".join(lines)
        if lines
        else ""
    )

    return (
        "את/ה פסיכולוג/ית ארגוני/ת המסכם/ת את התמונה הכוללת של רווחת "
        "הצוות בבית ספר אחד.\n"
        "ציוני הממדים:\n" + "\n".join(dim_lines) + "\n"
        f"{background_section}\n"
        "כתוב בין 2 ל-4 משפטים שלמים המסכמים את המצב הכולל. ציין את "
        "החוזקות המרכזיות ואת תחומי העדיפות, והישען על הפיזור ולא על "
        "הממוצע בלבד. מספרי הפיזור הם תשובות ולא משיבים, שכן כל משיב עונה "
        "על כל שאלות הממד: אל תציג אותם כמספר אנשי צוות ואל תחבר מספרים "
        "בין ממדים או בין קבוצות צבע. שמור על טון מקצועי ותומך המעוגן "
        "בנתונים, אל תמציא סיבות או אבחנות, כתוב בעברית בלבד בלי אותיות "
        "לטיניות, ורשום מספרים בספרות ולא במילים."
    )


def canonical_statements_for_dimension(dimension_id: str) -> list[str]:
    """The instrument's own items for one dimension.

    They are the style the suggestion has to match: the respondent rates
    agreement on a six-point scale, so an item is a first-person statement about
    the writer's own week, never a question and never two ideas in one line.
    """
    return [
        question["textHebrew"]
        for question in AI_ANALYTICS_QUESTIONS
        if question["dimensionId"] == dimension_id
    ]


def question_suggestion_prompt(
    *,
    dimension_id: str,
    dimension_hebrew: str,
    existing_texts: Iterable[str] = (),
) -> str:
    """Ask for one more item for one dimension of the questionnaire.

    This prompt is not about a round: it carries no scores, no aggregates and no
    school, because a questionnaire is built before anyone has answered it. What
    it carries is the instrument — the canonical items of this dimension as the
    style to match — and whatever the manager has already written, so the model
    does not hand back a line the questionnaire already has.

    The suggestion is a draft for a person to rewrite, which is why the prompt
    asks for the mechanical properties a draft must have (one Hebrew sentence,
    no numbers) and leaves the judgement about wording to the manager.
    """
    examples = canonical_statements_for_dimension(dimension_id)
    example_section = (
        "היגדים קיימים בממד זה בשאלון המקורי:\n"
        + "\n".join(f"- {example}" for example in examples)
        + "\n"
        if examples
        else ""
    )
    already = [text.strip() for text in existing_texts if text and text.strip()]
    already_section = (
        "היגדים שכבר נמצאים בטיוטת השאלון ואסור לחזור עליהם או על משמעותם:\n"
        + "\n".join(f"- {text}" for text in already)
        + "\n"
        if already
        else ""
    )

    return (
        "את/ה מומחה/ית לבניית שאלוני רווחה לצוותי חינוך.\n"
        f"הממד המבוקש: {dimension_hebrew}.\n"
        f"{example_section}"
        f"{already_section}"
        "כתוב היגד אחד חדש לממד הזה, שהמשיב מדרג את הסכמתו איתו בסולם של "
        "שש דרגות. ההיגד בגוף ראשון על החוויה של המשיב עצמו בעבודה, "
        "בלשון נקבה כמו בדוגמאות, רעיון אחד בלבד, משפט אחד שמסתיים בנקודה. "
        "כתוב בעברית בלבד בלי אותיות לטיניות, בלי מספרים, בלי סימן שאלה "
        "ובלי מירכאות. אל תתייחס לאדם מסוים, לתפקיד מזהה או לנתונים של בית "
        "הספר. החזר את ההיגד עצמו בלבד, בלי כותרת, בלי מספור ובלי הסבר."
    )


def adaptation_aggregate_lines(
    question_aggregates: list[Dict[str, Any]],
) -> list[str]:
    """The dimension's numbers as the adaptation prompts state them.

    Shared by the single and the batched prompt so the model is shown one
    description of a dimension, not two that could drift apart.
    """
    aggregate_lines = []
    for aggregate in question_aggregates:
        line = (
            f"- {question_text(aggregate)} "
            f"ממוצע {float(aggregate.get('averageScore', 0.0)):.0f}, "
            f"מספר תשובות {aggregate.get('responseCount', 0)}"
        )
        distribution = aggregate.get("scoreDistribution")
        if isinstance(distribution, dict):
            line += (
                f" (תשובות: {distribution.get('green', 0)} ירוק, "
                f"{distribution.get('yellow', 0)} צהוב, "
                f"{distribution.get('red', 0)} אדום)"
            )
        aggregate_lines.append(line)
    return aggregate_lines


def adaptation_batch_prompt(
    *,
    interventions: list[Dict[str, Any]],
    dim_hebrew: str,
    score: float,
    status: str,
    question_aggregates: list[Dict[str, Any]],
    background_context: Optional[Dict[str, Any]] = None,
) -> str:
    """Every catalog entry of one dimension, adapted in a single request.

    The dimension's aggregates, status and school background are identical for
    all of its entries, so stating them once per entry spent a request of a
    twenty-a-day quota on repetition. The answer keeps the single-entry line
    format inside each block and separates blocks by a line of "===".

    The summary line is the recommendation, not a report about rewriting one.
    Asked only to "rephrase", a model answers with the task: measured on
    `gemini-3.5-flash-lite` on 2026-07-29, one block opened with "adapting
    recommendations to reduce the load", which is what a manager would then
    read on the dashboard.
    """
    aggregate_lines = adaptation_aggregate_lines(question_aggregates)
    lines = background_context_lines(background_context)
    background_section = (
        "\nרקע בית הספר:\n" + "\n".join(lines)
        if lines
        else ""
    )

    entry_sections = []
    for index, intervention in enumerate(interventions, start=1):
        entry_steps = [
            str(step) for step in intervention.get("actionable_steps", [])
        ]
        catalog_steps = "\n".join(f"- {step}" for step in entry_steps)
        entry_sections.append(
            f"המלצה {index}:\n"
            f"כותרת ההמלצה בקטלוג: {intervention.get('title', '')}\n"
            f"תקציר ההמלצה בקטלוג: {intervention.get('summary', '')}\n"
            f"שלבי ההמלצה בקטלוג ({len(entry_steps)} שלבים):\n"
            f"{catalog_steps}"
        )

    block_shapes = ", ".join(
        f"בלוק {index} — {len(intervention.get('actionable_steps', [])) + 1} שורות"
        for index, intervention in enumerate(interventions, start=1)
    )

    return (
        f"את/ה מתאים/ה {len(interventions)} המלצות מתוך קטלוג לבית ספר "
        "יחיד, על סמך נתונים מצרפיים בלבד שאינם חושפים משיבים.\n"
        f"ממד: {dim_hebrew}. ציון: {score:.0f} מתוך 100. "
        f"מצב: {status_label(status)}.{background_section}\n"
        "שאלות הממד:\n" + "\n".join(aggregate_lines) + "\n\n"
        + "\n\n".join(entry_sections) + "\n\n"
        f"נסח מחדש כל אחת מ-{len(interventions)} ההמלצות עבור בית הספר הזה, "
        f"לפי הסדר. ענה בעברית בלבד, בלי אותיות לטיניות, ב-"
        f"{len(interventions)} בלוקים המופרדים בשורה שכולה '===' "
        "ובלי שורת הפרדה לפני הבלוק הראשון או אחרי האחרון. "
        "בכל בלוק השורה הראשונה היא התקציר המנוסח מחדש והיא מצטטת לפחות "
        "מספר אחד מהנתונים שלמעלה בספרות, למשל 41 או 6, ולא במילים כמו "
        "'שישה' או 'עשרה'. כל שורה אחריה פותחת ב'- ' ומכילה שלב "
        f"אחד מנוסח מחדש: {block_shapes}. "
        "התקציר הוא ההמלצה עצמה כפי שהיא תוצג לצוות בית הספר: אל תתאר את "
        "פעולת ההתאמה, אל תזכיר את הקטלוג ואל תפתח במילים כמו 'התאמת "
        "המלצות'. "
        "שמור על כוונת כל המלצה ועל סדר השלבים, שמור על עקביות עם המצב "
        "שצוין, אל תמציא סיבות, אבחנות, זהויות או מספרים שאינם למעלה, "
        "אל תחבר קבוצות צבע או שאלות שונות למספר אחד, "
        "וכשאתה מזכיר קבוצת צבע כתוב באותו משפט את מספר התשובות שלה "
        "בספרות, למשל '0 תשובות ירוקות', ולא במילים כמו 'היעדר' או 'אפס'. "
        "רשום מספרים בספרות ולא במילים."
    )


def heuristic_interpretation(
    dim_hebrew: str,
    score: float,
    status: str,
    question_aggregates: list[Dict[str, Any]] | None = None,
) -> str:
    """The interpretation the service writes without asking a model.

    Reached only for a green dimension: either `ONLY_LLM_FOR_PROBLEMATIC` kept it
    away from the provider, or the provider was asked and never answered. Nothing
    is papered over either way — the sentence is built from the aggregates and
    the provenance says `deterministic_fallback` with the attempts that were
    spent, so a reader can tell the two apart.
    """
    aggregates = question_aggregates or []
    if aggregates:
        selected = (
            max(aggregates, key=lambda aggregate: aggregate["averageScore"])
            if status == "green"
            else min(
                aggregates,
                key=lambda aggregate: aggregate["averageScore"],
            )
        )
        selected_text = question_text(selected)
        question_sentence = (
            selected_text
            if re.search(r"[.!?؟]\s*$", selected_text)
            else f"{selected_text}."
        )
        aggregate_score = float(selected["averageScore"])
        score_text = (
            str(int(aggregate_score))
            if aggregate_score.is_integer()
            else f"{aggregate_score:.1f}"
        ).replace(".", ",")
        implication = {
            "green": "משקף חוזקה שכדאי לשמר לאורך זמן",
            "yellow": "מסמן תחום שכדאי לחזק באופן ממוקד",
            "red": "מסמן צורך בתשומת לב מיידית בתחום זה",
        }.get(status, "מציג את המצב המצרפי בתחום זה")
        return (
            f"השאלה המצרפית הבולטת במדד {dim_hebrew} היא: "
            f"{question_sentence} "
            f"ממוצע המענה עליה הוא {score_text} מתוך 100, והוא "
            f"{implication}."
        )

    score_text = (
        str(int(score))
        if float(score).is_integer()
        else f"{score:.1f}"
    ).replace(".", ",")
    if status == "red":
        return (
            f"מדד {dim_hebrew} נמצא באזור אדום עם ציון {score_text}. "
            "הנתון המצרפי מסמן צורך בתשומת לב מיידית בתחום זה."
        )
    if status == "yellow":
        return (
            f"מדד {dim_hebrew} נמצא באזור צהוב עם ציון {score_text}. "
            "הנתון המצרפי מסמן תחום שכדאי לחזק באופן ממוקד."
        )
    return (
        f"מדד {dim_hebrew} נמצא באזור ירוק עם ציון {score_text}. "
        "הנתון המצרפי משקף חוזקה שכדאי לשמר לאורך זמן."
    )
