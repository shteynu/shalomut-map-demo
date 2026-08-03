import { ChevronLeft, EyeOff, HandHeart, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";

/**
 * What the respondent is told before the first question.
 *
 * The questionnaire asks staff about their own school. Someone who answers
 * without knowing who reads the result, and at what resolution, has not really
 * agreed to anything — so the promises below are stated before answering can
 * begin, and answering is what accepting them means.
 *
 * The component sends nothing and knows nothing about the network. Declining
 * therefore cannot leave a trace anywhere, which is the whole point of putting
 * this step before the attempt rather than inside it.
 */

type SurveyConsentStepProps = {
  surveyTitle: string;
  introText: string;
  anonymityText: string;
  estimatedMinutes: number;
  questionCount: number;
  onAccept: () => void;
  onDecline: () => void;
};

/**
 * The promises the product makes, owned by the code.
 *
 * Deliberately not `introText`/`anonymityText`: those two are edited by a
 * manager in the builder, and a manager can weaken, contradict or simply
 * forget them. What the system actually guarantees is enforced elsewhere —
 * aggregate-only reporting above the privacy threshold, no identifying fields
 * collected — so it is stated here in words that no editor can change.
 */
const PROMISES: readonly { icon: LucideIcon; text: string }[] = [
  {
    icon: EyeOff,
    text: "לא נאספים שם, כתובת מייל, כתובת IP או כל פרט מזהה אחר.",
  },
  {
    icon: Users,
    text: "ההנהלה רואה תמונה מצרפית בלבד, ורק אחרי שנאספו מספיק מענים. תשובה בודדת לא מוצגת לאיש.",
  },
  {
    icon: HandHeart,
    text: "ההשתתפות התנדבותית. אפשר לעצור בכל רגע, והתשובות נשלחות רק בלחיצה על השליחה בסוף.",
  },
];

export function SurveyConsentStep({
  surveyTitle,
  introText,
  anonymityText,
  estimatedMinutes,
  questionCount,
  onAccept,
  onDecline,
}: SurveyConsentStepProps) {
  return (
    <section className="survey-shell stone-page survey-builder-stone-page survey-focus-shell">
      <div className="survey-header survey-focus-header">
        <p className="eyebrow">שאלון אנונימי לצוות</p>
        <h1>{surveyTitle}</h1>
        <p>{introText}</p>
      </div>

      <div className="survey-focus-card survey-consent-card">
        <h2>לפני שמתחילים</h2>

        <p className="survey-consent-scope">
          {questionCount} שאלות, כ־{estimatedMinutes} דקות.
        </p>

        <ul className="survey-consent-promises">
          {PROMISES.map(({ icon: Icon, text }) => (
            <li key={text}>
              <Icon size={20} aria-hidden="true" />
              <span>{text}</span>
            </li>
          ))}
        </ul>

        {/* The manager's own wording, kept visually lighter than the promises
            above it: it may add context, but it must never read as the stronger
            claim, because it is the one nobody verifies. */}
        <p className="survey-consent-manager-note">{anonymityText}</p>

        <div className="survey-consent-actions">
          <button className="primary-button" type="button" onClick={onAccept}>
            הבנתי, אפשר להתחיל
            <ChevronLeft size={18} aria-hidden="true" />
          </button>
          <button
            className="secondary-button"
            type="button"
            onClick={onDecline}
          >
            לא עכשיו
          </button>
        </div>
      </div>
    </section>
  );
}
