import { responseScale } from "@/lib/shalomut-source";

/**
 * The scales a question can be answered on.
 *
 * Until the research instrument, there was one — three colour stones, scored
 * `100`/`60`/`0` — and it was not named anywhere because nothing else existed
 * to tell it apart from. The instrument brings two Likert lengths and a second
 * set of 1–5 anchors, so the scale becomes a property of the question rather
 * than a property of the product.
 *
 * `wellbeing-colour` is the existing one under a name. Every questionnaire
 * persisted before this module answers on it, and its scores stay exactly what
 * they were — see `answerScales` below for why that is derived rather than
 * retyped.
 */
export type AnswerScaleId =
  | "wellbeing-colour"
  | "likert-5-extent"
  | "likert-5-extent-low"
  | "likert-7-frequency";

export const ANSWER_SCALE_IDS: readonly AnswerScaleId[] = [
  "wellbeing-colour",
  "likert-5-extent",
  "likert-5-extent-low",
  "likert-7-frequency",
] as const;

/**
 * The one scale whose points are themselves wellbeing statuses.
 *
 * Named rather than written as a literal wherever behaviour turns on it,
 * because "is this the colour scale" is a question about meaning and not about
 * a string: an answer on this scale is a colour the respondent chose, and an
 * answer on any other has no colour until a score band gives it one.
 */
export const COLOUR_SCALE_ID: AnswerScaleId = "wellbeing-colour";

/**
 * Which direction a high answer points for the dimension the question belongs
 * to.
 *
 * The canonical 24 are all `positive`: agreeing with `אני מרגיש/ה ששומעים אותי`
 * is good for `self-expression`. The research instrument mixes them inside one
 * questionnaire — a high `לחץ זמן` is bad and a high `תמיכה קולגיאלית` is good
 * — so without this a dimension average would add the two together and mean
 * nothing. `negative` is scored as its own complement, which is the only
 * transformation that leaves the neutral midpoint where the respondent put it.
 */
export type AnswerPolarity = "positive" | "negative";

export type AnswerScalePoint = {
  /** What `QuestionAnswer.value` holds. Stable: never renumber a shipped scale. */
  value: string;
  /** The anchor a respondent reads, in Hebrew. */
  label: string;
  /** 0–100 under `positive` polarity. */
  score: number;
};

export type AnswerScale = {
  id: AnswerScaleId;
  /** How the scale is named to a manager choosing one in the builder. */
  label: string;
  points: AnswerScalePoint[];
};

/**
 * Endpoints at 0 and 100 with the rest spaced evenly between them, rounded to
 * whole numbers because `QuestionAnswer.score` is an integer column.
 *
 * Rounding costs at most half a point per answer on the seven-point scale
 * (`83.33` becomes `83`) and averages out across respondents. Widening the
 * column to a float would buy precision the scoring bands cannot use — they
 * are whole numbers 25 points apart.
 */
function evenlySpacedScores(pointCount: number): number[] {
  return Array.from({ length: pointCount }, (_, index) =>
    Math.round((index / (pointCount - 1)) * 100),
  );
}

function likertScale(
  id: AnswerScaleId,
  label: string,
  anchors: string[],
): AnswerScale {
  const scores = evenlySpacedScores(anchors.length);

  return {
    id,
    label,
    points: anchors.map((anchor, index) => ({
      value: String(index + 1),
      label: anchor,
      score: scores[index],
    })),
  };
}

/**
 * The colour scale is built from `responseScale` rather than retyped here.
 *
 * Its three scores are `100`/`60`/`0`, not the `100`/`50`/`0` even spacing
 * would produce: yellow is deliberately closer to green than to red, because
 * «המצב סביר» is not the midpoint between fine and urgent. Copying those
 * numbers into this file would be a second place to change them, and the
 * failure mode is silent — every round persisted before today would keep
 * scoring one way while new ones scored another.
 */
const wellbeingColourScale: AnswerScale = {
  id: "wellbeing-colour",
  label: "סקאלת צבעים",
  points: responseScale.map((option) => ({
    value: option.value,
    label: option.title,
    score: option.score,
  })),
};

const EXTENT_ANCHORS = [
  "כלל לא או במידה מועטה מאוד",
  "במידה מועטה",
  "במידה בינונית",
  "במידה רבה",
  "במידה רבה מאוד",
];

/**
 * The same five steps with `נמוכה` where the others say `מועטה`.
 *
 * It exists because `סיפוק בחיים` in the source instrument is worded that way
 * and one block wording it differently is not this repository's to correct. If
 * the owner answers defect §4.5 of the plan by calling it a typo, this scale is
 * deleted and that block moves to `likert-5-extent`; until then, showing a
 * respondent anchors the instrument did not use is the larger error.
 */
const EXTENT_LOW_ANCHORS = [
  "כלל לא או במידה נמוכה מאוד",
  "במידה נמוכה",
  "במידה בינונית",
  "במידה רבה",
  "במידה רבה מאוד",
];

const FREQUENCY_ANCHORS = [
  "כמעט אף פעם לא",
  "לעיתים רחוקות מאוד",
  "לעיתים די רחוקות",
  "לפעמים",
  "לעיתים די קרובות",
  "לעיתים קרובות מאוד",
  "כמעט תמיד",
];

export const answerScales: Record<AnswerScaleId, AnswerScale> = {
  "wellbeing-colour": wellbeingColourScale,
  "likert-5-extent": likertScale(
    "likert-5-extent",
    "סולם 1–5 (מידה)",
    EXTENT_ANCHORS,
  ),
  "likert-5-extent-low": likertScale(
    "likert-5-extent-low",
    "סולם 1–5 (מידה נמוכה)",
    EXTENT_LOW_ANCHORS,
  ),
  "likert-7-frequency": likertScale(
    "likert-7-frequency",
    "סולם 1–7 (תדירות)",
    FREQUENCY_ANCHORS,
  ),
};

export function isAnswerScaleId(value: unknown): value is AnswerScaleId {
  return (
    typeof value === "string" &&
    ANSWER_SCALE_IDS.includes(value as AnswerScaleId)
  );
}

export function getAnswerScale(scaleId: AnswerScaleId): AnswerScale {
  return answerScales[scaleId];
}

/**
 * The score a stored answer contributes, or `undefined` when the value is not
 * on the scale at all.
 *
 * Undefined rather than a fallback on purpose. The version this replaces
 * answered an unrecognised value with `60` — yellow — so a corrupt or
 * mismatched submission scored as a mild positive instead of being refused,
 * and the round it landed in looked slightly better than the answers it held.
 * A caller that cannot make sense of an answer has to say so.
 */
export function scoreForAnswer(
  scaleId: AnswerScaleId,
  value: string,
  polarity: AnswerPolarity = "positive",
): number | undefined {
  const point = answerScales[scaleId].points.find(
    (candidate) => candidate.value === value,
  );
  if (!point) return undefined;

  return polarity === "negative" ? 100 - point.score : point.score;
}

export function isValueOnScale(scaleId: AnswerScaleId, value: string): boolean {
  return answerScales[scaleId].points.some(
    (point) => point.value === value,
  );
}
