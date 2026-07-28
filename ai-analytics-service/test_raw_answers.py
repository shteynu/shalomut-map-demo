"""
Experimental test: send raw question texts + individual answers to LLM
and ask for 3 stones (interpretations) per dimension section.

This is a STANDALONE test script - it does not modify any existing code.
It calls llm_provider_service._complete_with_retries directly with a
custom richer prompt.

Privacy note: uses mock/simulated answers only - no real respondent data.
"""

import time
from dotenv import load_dotenv

load_dotenv(".env")

from src.services.llm_provider import llm_provider_service

# ---------------------------------------------------------------------------
# Mock data: one dimension ("balance" / איזון) with 2 questions and
# 10 simulated (anonymous) answers each.  All values are invented.
# ---------------------------------------------------------------------------

DIMENSION_ID = "balance"
DIMENSION_HEBREW = "איזון"
SCORE = 45.0
STATUS = "red"  # red = requires intervention

# Each question has:
#   - text (as stored in the round)
#   - 10 anonymous numeric answers (1–5 scale)
QUESTIONS_WITH_ANSWERS = [
    {
        "questionText": "האם אתה מרגיש שיש לך זמן מספיק לעצמך מחוץ לעבודה?",
        "averageScore": 40.0,
        "responseCount": 10,
        "scoreDistribution": {"green": 1, "yellow": 2, "red": 7},
        # individual answers (anonymous, numeric 1-5)
        "rawAnswers": [1, 1, 2, 2, 2, 3, 3, 4, 1, 2],
    },
    {
        "questionText": "האם אתה מצליח לנתק את עצמך מהעבודה בסוף יום העבודה?",
        "averageScore": 50.0,
        "responseCount": 10,
        "scoreDistribution": {"green": 2, "yellow": 4, "red": 4},
        "rawAnswers": [2, 3, 3, 3, 4, 4, 2, 1, 3, 4],
    },
]

ALL_DIMENSION_SCORES = {
    "balance":       {"averageScore": 45.0, "computedStatus": "red"},
    "meaning":       {"averageScore": 85.0, "computedStatus": "green"},
    "relationships": {"averageScore": 72.0, "computedStatus": "yellow"},
    "growth":        {"averageScore": 68.0, "computedStatus": "yellow"},
    "environment":   {"averageScore": 80.0, "computedStatus": "green"},
    "recognition":   {"averageScore": 55.0, "computedStatus": "yellow"},
    "wellbeing":     {"averageScore": 61.0, "computedStatus": "yellow"},
    "autonomy":      {"averageScore": 77.0, "computedStatus": "green"},
}

NUM_STONES = 3  # how many interpretations (stones) to generate per dimension


# ---------------------------------------------------------------------------
# Build the richer prompt
# ---------------------------------------------------------------------------

def build_rich_prompt(
    dim_hebrew: str,
    score: float,
    status: str,
    questions_with_answers: list[dict],
    all_dimension_scores: dict,
    stone_index: int,
    num_stones: int,
) -> str:
    STATUS_LABELS = {"green": "תקין", "yellow": "דורש תשומת לב", "red": "דורש התערבות"}
    status_heb = STATUS_LABELS.get(status, status)

    # Cross-dimension context
    dim_names_heb = {
        "balance":       "איזון",
        "meaning":       "משמעות",
        "relationships": "קשרים",
        "growth":        "צמיחה",
        "environment":   "סביבה",
        "recognition":   "הכרה",
        "wellbeing":     "רווחה",
        "autonomy":      "אוטונומיה",
    }
    cross_dim_lines = []
    for d_id, d_val in all_dimension_scores.items():
        d_heb = dim_names_heb.get(d_id, d_id)
        s = STATUS_LABELS.get(d_val["computedStatus"], d_val["computedStatus"])
        cross_dim_lines.append(f"- {d_heb}: ציון {d_val['averageScore']:.0f}, מצב {s}")
    cross_dim_section = "\n".join(cross_dim_lines)

    # Questions with raw answers
    q_lines = []
    for q in questions_with_answers:
        answers_str = ", ".join(str(a) for a in q["rawAnswers"])
        dist = q["scoreDistribution"]
        q_lines.append(
            f"שאלה: {q['questionText']}\n"
            f"  ממוצע: {q['averageScore']:.0f} | תשובות: {dist['green']} ירוק, "
            f"{dist['yellow']} צהוב, {dist['red']} אדום\n"
            f"  ערכים בודדים (אנונימיים, סקלה 1–5): {answers_str}"
        )
    questions_block = "\n\n".join(q_lines)

    stone_instruction = (
        f"זוהי פרשנות מספר {stone_index} מתוך {num_stones} לממד זה. "
        f"כל פרשנות צריכה להדגיש זווית אחרת: "
        f"פרשנות 1 — תיאור המצב הנוכחי; "
        f"פרשנות 2 — הגורמים האפשריים; "
        f"פרשנות 3 — המלצה ארגונית קונקרטית."
    )

    return (
        "את/ה פסיכולוג/ית ארגוני/ת המנתח/ת נתוני רווחת צוות חינוכי. "
        "הנתונים כוללים גם ערכים בודדים אנונימיים (ללא זיהוי משיב) וגם נתונים מצרפיים.\n\n"
        f"ממד: {dim_hebrew}. ציון: {score:.0f} מתוך 100. מצב: {status_heb}.\n\n"
        f"תמונת שמונת הממדים:\n{cross_dim_section}\n\n"
        f"שאלות הממד עם ערכי תשובות:\n\n{questions_block}\n\n"
        f"{stone_instruction}\n\n"
        "כתוב בין 2 ל-4 משפטים שלמים. "
        "בסס כל טענה על הנתונים שלמעלה, אל תמציא סיבות או עובדות שאינן בנתונים. "
        "כתוב בעברית בלבד, בלי אותיות לטיניות, ורשום מספרים בספרות ולא במילים."
    )


def is_acceptable(candidate: str, finish_reason: object) -> bool:
    """Simple acceptability check: Hebrew, complete sentences, stop finish."""
    if finish_reason != "stop":
        return False
    return llm_provider_service.is_complete_hebrew_copy(candidate, contract_version="5.0")


# ---------------------------------------------------------------------------
# Run the experiment
# ---------------------------------------------------------------------------

def run():
    print("=" * 70)
    print(f"EXPERIMENT: raw answers → LLM → {NUM_STONES} stones per dimension")
    print(f"Dimension: {DIMENSION_HEBREW} | Score: {SCORE} | Status: {STATUS}")
    print("=" * 70)

    results = []

    for i in range(1, NUM_STONES + 1):
        prompt = build_rich_prompt(
            dim_hebrew=DIMENSION_HEBREW,
            score=SCORE,
            status=STATUS,
            questions_with_answers=QUESTIONS_WITH_ANSWERS,
            all_dimension_scores=ALL_DIMENSION_SCORES,
            stone_index=i,
            num_stones=NUM_STONES,
        )

        print(f"\n--- Stone {i}/{NUM_STONES} ---")
        print(f"[prompt length: {len(prompt)} chars]")

        model_name = llm_provider_service._model_for_tier("fast")
        text, attempts, fallback_reason = llm_provider_service._complete_with_retries(
            build_prompt=lambda p=prompt: p,
            system_prompt=(
                "את/ה פסיכולוג/ית ארגוני/ת תמציתי/ת עבור צוותי חינוך. "
                "ענה תמיד בעברית בלבד."
            ),
            model_name=model_name,
            is_acceptable=is_acceptable,
        )
        from src.services.llm_provider import InterpretationGeneration
        result = (
            InterpretationGeneration(text=text, outcome="llm", attempts=attempts)
            if text is not None
            else InterpretationGeneration(text=f"[fallback: {fallback_reason}]", outcome="deterministic_fallback", attempts=attempts)
        )

        print(f"outcome : {result.outcome}")
        print(f"attempts: {result.attempts}")
        print(f"text    : {result.text}")
        results.append(result)
        time.sleep(0.5)  # brief pause between calls

    print("\n" + "=" * 70)
    print("SUMMARY")
    print("=" * 70)
    for i, r in enumerate(results, 1):
        print(f"\nStone {i} [{r.outcome}]:\n{r.text}")

    llm_outcomes = [r.outcome for r in results]
    print(f"\nAll outcomes: {llm_outcomes}")
    all_llm = all(o == "llm" for o in llm_outcomes)
    print(f"All via real LLM (not fallback): {'✅' if all_llm else '⚠️  some used fallback'}")


if __name__ == "__main__":
    run()
