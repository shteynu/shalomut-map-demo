import {
  LOW_PRIVACY_THRESHOLD_WARNING,
  RECOMMENDED_PRIVACY_THRESHOLD,
} from "@/lib/survey-definition";

/**
 * The reminder a manager sees while a round is configured below the
 * methodological threshold.
 *
 * The product runs on a threshold of 1 everywhere — the database column, the
 * Core default and the AI service all accept it — so a manager can walk the
 * whole flow alone. Nothing in the runtime says that ten is what the method
 * asks for, and a number the screens never mention is a number nobody raises.
 * The text is graded rather than repeated: below five the average stops hiding
 * the individual respondent, which is a different statement from "the
 * recommended number is ten".
 */
export function privacyThresholdNoticeText(
  minimumResponses: number,
): string | null {
  if (
    !Number.isFinite(minimumResponses) ||
    minimumResponses >= RECOMMENDED_PRIVACY_THRESHOLD
  ) {
    return null;
  }

  const opening =
    `הסף המתודולוגי הנדרש הוא ${RECOMMENDED_PRIVACY_THRESHOLD} משיבים, ` +
    `ובסבב הזה נבחרו ${minimumResponses}.`;

  if (minimumResponses < LOW_PRIVACY_THRESHOLD_WARNING) {
    return (
      `${opening} בסף כזה הממוצע המוצג במפה משקף תשובות של יחידים וניתן ` +
      "לשייך אותן לאדם מסוים, ולכן הוא מתאים לבדיקות פנימיות בלבד ולא לסבב אמיתי."
    );
  }

  return (
    `${opening} מתחת לסף הזה עדיין אפשר להסיק על תשובות של בודדים, ` +
    "במיוחד בשאלה שבה ענו מעט אנשי צוות."
  );
}

export function PrivacyThresholdNotice({
  minimumResponses,
  emphasis = "quiet",
}: {
  minimumResponses: number;
  /** "form" keeps the stronger styling the manager already sees while choosing. */
  emphasis?: "quiet" | "form";
}) {
  const text = privacyThresholdNoticeText(minimumResponses);
  if (!text) {
    return null;
  }

  const isBelowProtection = minimumResponses < LOW_PRIVACY_THRESHOLD_WARNING;
  const className =
    emphasis === "form" && isBelowProtection
      ? "survey-submit-error"
      : "quiet-note";

  return (
    // A span so the notice is valid inside the privacy tooltip as well as in a
    // form; the reminder is carried by the words, never by colour alone.
    <span
      className={className}
      style={{ display: "block" }}
      role={emphasis === "form" ? "status" : undefined}
    >
      {text}
    </span>
  );
}
