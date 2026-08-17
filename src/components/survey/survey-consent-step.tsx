import {
  ChevronLeft,
  EyeOff,
  HandHeart,
  Server,
  Sparkles,
  Timer,
  Users,
} from "lucide-react";
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
 *
 * Each line is a claim about the whole system and not only about this
 * repository, which is why the second and fourth exist. The first promise used
 * to end "...כתובת IP או כל פרט מזהה אחר", and of the application code that was
 * exactly true: nothing here reads an address, and no analytics package is
 * installed. It was not true of the stack the code runs on. Every request
 * terminates at a hosting edge that logs client addresses, as every hosting
 * edge does, and a promise that holds for the code but not for the deployment
 * is the kind a teacher would rightly feel betrayed by. So the address is now
 * described rather than denied. `docs/data-flow-and-subprocessors.md` is the
 * long form of these six sentences, and it is what to check when one of them
 * stops being true.
 *
 * The timing line was added on 2026-08-17, when the browser began counting how
 * long the questionnaire was on screen. It sits second because the first
 * promise says the answers are stored with nothing that links them to a person,
 * and this number is stored beside them — a respondent who learns that
 * afterwards would be right to read the first line as having been narrower than
 * it sounded. It also states the limit that makes the measurement bearable: no
 * per-question timing, which is a property of what is collected rather than of
 * what is shown, and therefore not something a later feature can quietly
 * relax without this sentence becoming false.
 */
const PROMISES: readonly { icon: LucideIcon; text: string }[] = [
  {
    icon: EyeOff,
    text: "לא נאספים שם, כתובת מייל או פרט מזהה אחר. התשובות נשמרות בלי דבר שמקשר אותן לאדם מסוים.",
  },
  {
    icon: Timer,
    text: "נמדד כמה זמן השאלון היה פתוח על המסך, והמספר נשמר יחד עם התשובות. ההנהלה רואה ממנו תמונה מצרפית בלבד — כמה זמן לקח המילוי האמצעי וכמה מילויים היו קצרים במיוחד. לא נמדד זמן לכל שאלה בנפרד.",
  },
  {
    icon: Server,
    text: "כמו בכל אתר, כתובת ה־IP מגיעה לשרתים שמארחים את השאלון ונרשמת ביומני התשתית שלהם. היא לא נשמרת יחד עם התשובות, ואיש בבית הספר לא רואה אותה.",
  },
  {
    icon: Users,
    text: "ההנהלה רואה תמונה מצרפית בלבד, ורק אחרי שנאספו מספיק מענים. תשובה בודדת לא מוצגת לאיש.",
  },
  {
    icon: Sparkles,
    text: "הניתוח נכתב בעזרת מודל שפה של ספק חיצוני. נשלחים אליו ממוצעים ברמת השאלה בלבד, לעולם לא תשובה של אדם מסוים.",
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
