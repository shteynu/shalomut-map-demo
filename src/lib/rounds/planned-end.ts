import type { RoundStatus } from '../types/backend';
import { isRoundCollecting } from './round-status';

/**
 * What the round's end date is allowed to say about itself.
 *
 * The date is collected at setup, stored and shown — and read by no rule in the
 * product. Nothing closes when it arrives, nothing warns, and the questionnaire
 * keeps accepting answers. The screen nevertheless labelled it `סגירה`, so a
 * manager whose date passed last week was looking at a card that said the
 * collection had ended while teachers were still filling the form.
 *
 * Making the date close a round is a product decision with consequences for
 * respondents mid-questionnaire, and it is not this function's to make. What is
 * fixed here is the claim: the card says what the date is — an intention — and,
 * once it has passed on a round still collecting, says that out loud.
 */

/**
 * The product serves Israeli schools, so "has the date passed" is asked in the
 * school's own day rather than in whichever zone the server happens to run in.
 * A round ending today would otherwise read as overdue from 2am local time.
 */
const SCHOOL_TIME_ZONE = 'Asia/Jerusalem';

const dayFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: SCHOOL_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** The calendar day in the school's zone, as `YYYY-MM-DD`, which sorts. */
function schoolDay(moment: Date): string {
  return dayFormatter.format(moment);
}

export interface PlannedEndDescription {
  /** The card's label. Never `סגירה`: the date closes nothing. */
  label: string;
  helper: string;
  /** True once the date has passed on a round that is still collecting. */
  isOverdue: boolean;
}

export function describePlannedEnd(
  endDate: Date | null | undefined,
  status: RoundStatus,
  now: Date,
): PlannedEndDescription {
  const label = 'סיום מתוכנן';

  if (!endDate || Number.isNaN(endDate.getTime())) {
    return {
      label,
      helper: 'לא נקבע תאריך יעד. הסבב נסגר ידנית ממסך זה.',
      isOverdue: false,
    };
  }

  // A round that is no longer collecting has nothing to be late for; the date
  // is history, and whether it matched the closing is not this card's subject.
  const isCollecting = isRoundCollecting(status);
  if (!isCollecting) {
    return { label, helper: 'תאריך היעד שנקבע לסבב.', isOverdue: false };
  }

  if (schoolDay(endDate) < schoolDay(now)) {
    return {
      label,
      helper: 'התאריך עבר והסבב עדיין אוסף תשובות. הסגירה היא ידנית.',
      isOverdue: true,
    };
  }

  return {
    label,
    helper: 'תאריך יעד בלבד — הסבב אינו נסגר מעצמו כשהוא מגיע.',
    isOverdue: false,
  };
}
