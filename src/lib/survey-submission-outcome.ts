/**
 * What the respondent should see after the submit endpoint answers.
 *
 * Kept apart from the component for two reasons. It is the piece worth testing
 * — every branch here is a state a person ends up in — and it is where the
 * server's English stops. The endpoint speaks codes and English messages meant
 * for developers; the questionnaire is Hebrew and speaks to a teacher, so the
 * translation happens once, here, instead of leaking a raw API string into an
 * RTL screen.
 */

import type { SurveySubmissionErrorCode } from './types/backend';

export type SurveySubmissionOutcome =
  /** The round holds this attempt's answers. Show the completion screen. */
  | { kind: 'complete' }
  /** Nothing was recorded. Show the message and let the respondent retry. */
  | { kind: 'error'; message: string };

const MESSAGES: Record<SurveySubmissionErrorCode, string> = {
  ROUND_NOT_FOUND: 'הקישור לשאלון אינו תקף יותר. בקשו קישור עדכני מההנהלה.',
  ROUND_NOT_ACTIVE: 'סבב האבחון נסגר ואינו מקבל תשובות נוספות.',
  DEFINITION_INVALID:
    'יש תקלה בהגדרת השאלון. עדכנו את ההנהלה — התשובות לא נשמרו.',
  INVALID_ANSWERS: 'חלק מהתשובות לא התקבלו. חזרו אחורה והשלימו את החסרות.',
  // Never reached: a duplicate is a completion, not an error. Present so the
  // record stays exhaustive and a new code cannot be added without a message.
  ALREADY_SUBMITTED: '',
  // A respondent whose browser dropped the attempt token — a cleared session
  // mid-answer, an extension, a hand-made request. Reloading mints a new one,
  // and the draft is what carries their answers across the reload.
  ATTEMPT_TOKEN_REQUIRED:
    'ההפעלה של השאלון פגה. רעננו את הדף — התשובות שמולאו נשמרות בדפדפן.',
  ROUND_FULL:
    'סבב האבחון קיבל את מלוא התשובות שהוא יכול לקבל. עדכנו את ההנהלה — התשובות לא נשמרו.',
};

const UNKNOWN_FAILURE = 'לא ניתן היה לשמור את התשובות. נסו שוב.';

function isSubmissionErrorCode(
  value: unknown,
): value is SurveySubmissionErrorCode {
  return typeof value === 'string' && value in MESSAGES;
}

/**
 * `ALREADY_SUBMITTED` is a completion, not a failure.
 *
 * It is the ordinary ending of a recovered attempt: the server stored the
 * response, the connection dropped before the `200` reached the browser, and
 * the retry carried the same attempt token. The respondent already did the
 * work — asking them to answer again would be both wrong and impossible, since
 * the round refuses the second write anyway.
 *
 * A refusal the server did not name is treated as retryable. Guessing a
 * specific cause would tell the respondent something neither side knows.
 */
export function resolveSubmissionOutcome(response: {
  ok: boolean;
  code?: unknown;
}): SurveySubmissionOutcome {
  if (response.ok) return { kind: 'complete' };

  if (response.code === 'ALREADY_SUBMITTED') return { kind: 'complete' };

  return {
    kind: 'error',
    message: isSubmissionErrorCode(response.code)
      ? MESSAGES[response.code]
      : UNKNOWN_FAILURE,
  };
}
