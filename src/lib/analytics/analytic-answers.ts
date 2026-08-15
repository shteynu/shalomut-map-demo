import {
  AnalyticSurveyQuestion,
  QuestionAnswerRecord,
  SurveyResponseRecord,
} from '../types/backend';

/**
 * One answer that is allowed to count towards a dimension average.
 *
 * The question is carried alongside the answer because every caller needs it —
 * to name the dimension, to read the question text, or to bucket the answer's
 * own value — and looking it up again from the id is how the two readers of
 * this data drifted apart in the first place.
 */
export type AnalyticAnswer = {
  readonly question: AnalyticSurveyQuestion;
  readonly answer: QuestionAnswerRecord;
  readonly score: number;
};

/**
 * The answers of one response that may be scored, in submission order.
 *
 * Every rule here decides whether a number reaches a published average, so
 * there is exactly one copy of them. The round's aggregate and the per-group
 * breakdown are the same arithmetic over different partitions of the same
 * responses; if they disagreed about which answers count, a group's score and
 * the round's score would be computed from different data and a manager would
 * read the difference as a finding.
 *
 * What is refused, and why each one is not paranoia:
 *
 * - **A question not in the enabled analytic set.** A background answer, a
 *   disabled question, or an answer to a question this round does not ask.
 * - **A second answer to the same question.** The persistence layer enforces
 *   one answer per question per response, so this is defence against a record
 *   assembled in memory; the first answer wins rather than the last.
 * - **A `dimensionId` that disagrees with the question's.** The client sends
 *   the dimension alongside the answer, so a stale or forged submission can
 *   name a dimension the question does not belong to. Trusting it would let a
 *   respondent choose which stone their answer lands on.
 * - **A missing or out-of-range score.** Scores are written by the server at
 *   submission, so an absent one is a background answer and an impossible one
 *   is corruption. Either way it is not an opinion about a dimension.
 */
export function readAnalyticAnswers(
  response: SurveyResponseRecord,
  questionsById: ReadonlyMap<string, AnalyticSurveyQuestion>,
): AnalyticAnswer[] {
  const seen = new Set<string>();
  const collected: AnalyticAnswer[] = [];

  for (const answer of response.answers) {
    const question = questionsById.get(answer.questionId);
    const score = answer.score;

    if (
      !question ||
      seen.has(answer.questionId) ||
      answer.dimensionId !== question.dimensionId ||
      score === undefined ||
      !Number.isFinite(score) ||
      score < 0 ||
      score > 100
    ) {
      continue;
    }

    seen.add(answer.questionId);
    collected.push({ question, answer, score });
  }

  return collected;
}

/**
 * The mean of a set of scores as a whole number, or `undefined` for no scores
 * at all.
 *
 * `undefined` rather than `0`: a group nobody in answered a dimension's
 * questions has no score, and zero is the worst score there is. The callers
 * that cannot receive `undefined` — the round aggregate, where the lock rule
 * already guarantees every dimension has answers — say so by never asking.
 */
export function averageScore(scores: readonly number[]): number | undefined {
  if (scores.length === 0) return undefined;

  return Math.round(
    scores.reduce((sum, score) => sum + score, 0) / scores.length,
  );
}
