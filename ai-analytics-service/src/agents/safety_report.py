"""What the safety validator refused, in a form the next attempt can use.

The validator already narrowed a replay to the dimensions that failed. What it
could not do was say *why*: it wrote a joined sentence into ``safety_feedback``
that nothing read, so a rejected dimension was asked again with the identical
prompt on a heavier model and no idea what had been wrong with the first
answer. This module turns each refusal into a code, and each code into one
Hebrew line the repair prompt carries.
"""

from typing import Dict, Iterable, List, Literal, NotRequired, Optional, TypedDict


SafetyViolationTarget = Literal[
    "interpretation",
    "recommendation",
    "overall_summary",
]


class SafetyViolation(TypedDict):
    """One refusal, addressed to the thing that has to be written again."""

    code: str
    target: SafetyViolationTarget
    dimensionId: NotRequired[str]


# Only refusals about copy a model wrote appear here.
#
# `provenance_invalid` and `unavailable_not_empty` describe this service's own
# bookkeeping — which questions fed a prompt, whether an absent interpretation
# was left absent. Handing those to the model as a critique would ask it to fix
# something it never wrote, and the words would land in the one place they can
# do harm: the prompt that produces a manager's copy.
#
# `v6_intervention_count` is the catalog's business too. Five entries come from
# the vector store, not from a generation, so telling the model to write five
# would be advice about a step it does not perform.
_CRITIQUES: Dict[str, str] = {
    "status_inconsistent": (
        "הניסוח הקודם סתר את המצב שצוין עבור הממד. שמור על עקביות מלאה עם "
        "המצב, ואל תתאר מצב טוב או חמור יותר מזה שבנתונים."
    ),
    "interpretation_invalid": (
        "הניסוח הקודם נדחה: או שלא נכתב בעברית בלבד, או שלא שמר על מספר "
        "המשפטים הנדרש, או שסתר את המצב שצוין. כתוב ניסוח חדש לפי הכללים "
        "שלמעלה."
    ),
    "v6_narrative_invalid": (
        "הפסקאות או תובנות המדדים הקודמות נדחו: לא נשמרו שלוש פסקאות, אורך "
        "הנרטיב הנדרש, כיסוי מלא של השאלות או עברית בלבד. כתוב אותן מחדש "
        "בדיוק לפי המבנה שנדרש למעלה."
    ),
    "intervention_invalid": (
        "ניסוח ההמלצות הקודם נדחה: שמור על עברית בלבד, על עקביות עם המצב "
        "שצוין ועל אורך הנרטיב הנדרש, ואל תשנה את זהות ההמלצות או את סדרן."
    ),
    "overall_summary_not_hebrew": (
        "הסיכום הקודם לא נכתב בעברית בלבד. כתוב אותו מחדש בעברית בלבד, בלי "
        "אותיות משפות אחרות."
    ),
}


def violation(
    code: str,
    target: SafetyViolationTarget,
    dimension_id: Optional[str] = None,
) -> SafetyViolation:
    """Build one violation record."""
    record: SafetyViolation = {"code": code, "target": target}
    if dimension_id is not None:
        record["dimensionId"] = dimension_id
    return record


def critique(
    violations: Iterable[SafetyViolation],
    target: SafetyViolationTarget,
    dimension_id: Optional[str] = None,
) -> Optional[str]:
    """Return the Hebrew critique for one target, or ``None``.

    ``None`` covers three ordinary cases and they are worth keeping apart from
    an error: nothing was refused, the refusals belong to another dimension, or
    every refusal here is one of the codes that describes our bookkeeping
    rather than the model's copy. A first attempt reaches this function too,
    with no violations at all.
    """
    lines: List[str] = []
    for record in violations:
        if record.get("target") != target:
            continue
        if dimension_id is not None and record.get("dimensionId") != dimension_id:
            continue
        line = _CRITIQUES.get(record.get("code", ""))
        if line and line not in lines:
            lines.append(line)

    if not lines:
        return None
    return " ".join(lines)
