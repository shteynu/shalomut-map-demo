import type { WellbeingDimensionId } from "@/lib/shalomut-source";
import { COLOUR_SCALE_ID, type AnswerScaleId } from "@/lib/survey/answer-scales";
import { isBuilderAnalyticQuestion, type BuilderQuestion } from "./types";
import type { BuilderAnalyticQuestion } from "./types";

/**
 * Which scale a question the manager is about to write should open on.
 *
 * The builder used to write `wellbeing-colour` into the literal at every place
 * a new question is born. That was the only scale there was until the research
 * instrument, and under a questionnaire of 1–5 and 1–7 blocks it is simply
 * wrong: the manager gets three colour stones inside a Likert block, which the
 * respondent sees as a screen of its own — the flow groups a block by section
 * *and* scale — and which scores against different anchors than everything
 * around it.
 *
 * Nothing here decides anything the manager cannot change; the scale control is
 * in the edit dialog either way. What it decides is which value the dialog
 * opens on, and a default that follows the questionnaire in hand is right far
 * more often than a default that names one scale forever.
 *
 * Polarity is deliberately not derived the same way, and the reason is that it
 * is not the same kind of property. A scale belongs to the questionnaire — a
 * block shares one. Polarity belongs to the sentence: it says a high answer is
 * bad for this dimension, which is a judgement about the wording of that one
 * item. Copying the neighbours' polarity would make the next item reverse-scored
 * because the last one was, and a wrong polarity flips a dimension's score with
 * nothing on screen to say so.
 */
export function scaleForNewQuestion(
  questions: readonly BuilderQuestion[],
  dimensionId: WellbeingDimensionId,
): AnswerScaleId {
  const analytic = questions.filter(isBuilderAnalyticQuestion);
  // Enabled is what the rest of this screen means by "the questionnaire" — the
  // time estimate and the dimension count both read it. A draft with everything
  // switched off still has an answer, and it is a better one than the fallback.
  const enabled = analytic.filter((question) => question.enabled);
  const pool = enabled.length > 0 ? enabled : analytic;
  // The dimension in hand first, because one dimension's items can sit in blocks
  // of different lengths: the draft-wide majority is the weaker guess and is
  // only reached when this dimension holds nothing yet.
  const inDimension = pool.filter(
    (question) => question.dimensionId === dimensionId,
  );

  return (
    mostCommonScale(inDimension.length > 0 ? inDimension : pool) ??
    COLOUR_SCALE_ID
  );
}

/**
 * The scale most of these questions answer on, `null` when there are none.
 *
 * A tie goes to whichever comes first in the questionnaire's own order, which
 * is the order the manager sees, so the answer does not depend on the shape of
 * a map.
 */
function mostCommonScale(
  questions: readonly BuilderAnalyticQuestion[],
): AnswerScaleId | null {
  const counts = new Map<AnswerScaleId, number>();
  for (const question of questions) {
    counts.set(question.scaleId, (counts.get(question.scaleId) ?? 0) + 1);
  }

  let best: AnswerScaleId | null = null;
  let bestCount = 0;
  for (const question of questions) {
    const count = counts.get(question.scaleId) ?? 0;
    if (count > bestCount) {
      best = question.scaleId;
      bestCount = count;
    }
  }

  return best;
}
