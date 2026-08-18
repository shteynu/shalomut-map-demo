import { scoringThresholds, statusColorLabels } from "@/lib/shalomut-source";
import { MINIMUM_PRIVACY_THRESHOLD } from "@/lib/survey-definition";

/**
 * What a manager is told about how the product works, on the one screen that
 * exists to answer that.
 *
 * The content lives in a module rather than in JSX for the same reason the
 * scoring bands do: every number in it is derived from the source that owns it,
 * and a test can then prove that. A help screen that says "ten" while the
 * product enforces something else is worse than no help screen — it is the
 * product lying about itself in its own voice.
 *
 * What this screen deliberately does not carry: hosting providers, regions,
 * queue mechanics, contract versions, retry budgets. Those belong to
 * `docs/platform-handbook.md`, whose reader is a team member rather than a
 * principal. The rule of thumb is that a topic earns a place here only if a
 * manager could hit it on a screen and be unable to act without the answer.
 */

export type HelpTopicId =
  | "privacy"
  | "colors"
  | "ai"
  | "round"
  | "questionnaire"
  | "goals"
  | "data";

export interface HelpTopic {
  id: HelpTopicId;
  /** The question a manager would actually ask, in their words. */
  title: string;
  /** One or two sentences that answer it before any detail. */
  summary: string;
  /** What follows from the answer, including what the manager can do. */
  points: string[];
}

/** The anchor a screen links to when it wants one topic rather than the page. */
export function helpTopicAnchor(id: HelpTopicId): string {
  return `help-${id}`;
}

function privacyTopic(): HelpTopic {
  return {
    id: "privacy",
    title: "למה התוצאה נעולה?",
    summary:
      `כדי שאי אפשר יהיה לזהות מי ענה מה. כל עוד לא התקבלו לפחות ` +
      `${MINIMUM_PRIVACY_THRESHOLD} תשובות, המפה נשארת סגורה במלואה.`,
    points: [
      `${MINIMUM_PRIVACY_THRESHOLD} משיבים הם גם ברירת המחדל וגם המינימום. אפשר להעלות את הסף לבית הספר שלך, אי אפשר להוריד אותו.`,
      "הנעילה היא הכול או כלום: גם אם רק בשאלה אחת חסרות תשובות, כל הפירוט נשאר סגור. הסתרה של שאלה בודדת הייתה מאפשרת לחשב את התשובות החסרות מתוך מה שכן הוצג.",
      "מספר המשיבים עצמו מוצג תמיד, גם כשהתוצאה נעולה — כך אפשר לדעת כמה חסר.",
      "מה שאפשר לעשות: להאריך את האיסוף ולבקש שוב מחדר המורים. אין דרך לפתוח את התוצאה מוקדם יותר, וזו הנקודה.",
    ],
  };
}

function colorsTopic(): HelpTopic {
  const bands = scoringThresholds
    .map((band) => `${statusColorLabels[band.status]} — ${band.min} עד ${band.max}`)
    .join("; ");

  return {
    id: "colors",
    title: "איך נקבע הצבע של אבן?",
    summary:
      "חשבון פשוט, לא בינה מלאכותית. כל תשובה הופכת למספר בין 0 ל־100, " +
      "הממוצע של כל השאלות באותו צד קובע את הצבע.",
    points: [
      `הגבולות זהים לכל בתי הספר: ${bands}.`,
      "אותו ממוצע תמיד ייתן את אותו צבע. הטקסט שנכתב על האבן אינו יכול לשנות אותה.",
      "אבן ירוקה אינה 'סיימנו כאן'. היא חוזקה לשימור, והפעולות שיוצעו לה הן פעולות לשימור ולא יעדי שיפור.",
      "אבן אדומה אינה כישלון של אף אחד. היא תחום שזקוק לטיפול, וכך היא גם מנוסחת.",
      "לצד כל צבע מופיע גם סטטוס במילים, כדי שאפשר יהיה לקרוא את המפה בלי להסתמך על הצבע.",
    ],
  };
}

function aiTopic(): HelpTopic {
  return {
    id: "ai",
    title: "מה הבינה המלאכותית כותבת, ומה היא לא מחליטה?",
    summary:
      "היא כותבת את המילים בלבד. המספרים, הצבעים והסטטוסים מחושבים במערכת " +
      "לפני שהיא נקראת, והיא אינה יכולה לשנות אותם.",
    points: [
      "היא מקבלת ממוצעים בלבד. אף תשובה של אדם מסוים, ואף פרט רקע, אינם מגיעים אליה.",
      "ההמלצות נבחרות מתוך קטלוג התערבויות שכתבו אנשי מקצוע, ורק הניסוח מותאם לסבב שלך.",
      "אם הכלי לא הצליח לכתוב, המסך יאמר זאת. לא יוצג טקסט ממולא במקום ניתוח שלא נעשה.",
      "לפעמים פסקה נכתבת על ידי המערכת עצמה מתוך הנתונים בלבד, בלי מודל שפה. במקרה כזה כתוב על המסך במפורש שהטקסט לא נכתב על ידי הבינה המלאכותית.",
      "הכלי אינו קובע סיבות. הוא מתאר מצב ומציע כיווני פעולה; הפרשנות למה שקורה בבית הספר נשארת אצלכם.",
    ],
  };
}

function roundTopic(): HelpTopic {
  return {
    id: "round",
    title: "מה קורה כשסוגרים סבב?",
    summary:
      "סגירת הסבב היא מה שמזמין את הניתוח. כל עוד הסבב פתוח התמונה עוד משתנה, " +
      "ולכן אין ניתוח באמצע האיסוף.",
    points: [
      "מרגע הסגירה הסבב אינו מקבל עוד תשובות.",
      "הניתוח אינו מיידי: הוא לוקח כמה דקות, והמפה מופיעה כשהוא מסתיים. אפשר לעזוב את המסך ולחזור.",
      "לבית ספר יש סבב פעיל אחד בכל רגע. הפעלת סבב חדש סוגרת את הקודם, כדי שלא יסתובבו שני קישורים באותו חדר מורים.",
      "אפשר לבקש ניתוח נוסף לסבב שכבר נסגר. זו דעה שנייה על אותם נתונים, ולא ניתוח של תשובות חדשות.",
      "אם הניתוח נכשל, המערכת אינה מנסה שוב מעצמה. הבקשה החוזרת היא שלך, וזה מכוון.",
    ],
  };
}

function questionnaireTopic(): HelpTopic {
  return {
    id: "questionnaire",
    title: "למה אי אפשר לשנות את השאלון באמצע?",
    summary:
      "מרגע שהתקבלה התשובה הראשונה, שאלות הסבב ננעלות. אם חלק מהצוות ענה על " +
      "ניסוח אחד וחלק על אחר, הממוצע ביניהם אינו אומר דבר.",
    points: [
      "לפני התשובה הראשונה אפשר לערוך בחופשיות, וכל שמירה נשמרת כגרסה שאפשר לחזור אליה.",
      "כל שמונת הצדדים חייבים להיות מכוסים בשאלה אחת לפחות. עד אז הסבב נשאר טיוטה ואינו מנפיק קישור.",
      "שאלות רקע — גיל, ותק, תפקיד, היקף משרה — אינן מנוקדות ואינן משפיעות על אף אבן. הן משמשות רק לפילוח לפי קבוצות.",
      "רוצים לשנות שאלות אחרי שהתחיל האיסוף? זה סבב חדש, ולא עריכה של הקיים.",
    ],
  };
}

function goalsTopic(): HelpTopic {
  return {
    id: "goals",
    title: "מה קורה ליעד שבחרתי?",
    summary:
      "היעד נשמר עם הנוסח שהיה על המסך ברגע הבחירה, ושייך לבית הספר ולא לסבב.",
    points: [
      "ניתוח חדש משכתב את ההמלצות, אך אינו מוחק יעד שכבר נבחר. הוא יישאר עם ציון שנבחר מתוך ניתוח קודם.",
      "ליעד אין אחראי ואין תאריך יעד. זו החלטה מכוונת: מדידה אינה מערכת ניהול משימות.",
      "לצד יעד לא מוצג מספר. שינוי באבן אינו התוצאה של אותו יעד, והצגתם יחד הייתה רומזת על קשר שאיש אינו יכול להוכיח.",
      "הפסקת מעקב אחרי יעד מסירה אותו, וההמלצה חוזרת להיות זמינה לבחירה.",
    ],
  };
}

function dataTopic(): HelpTopic {
  return {
    id: "data",
    title: "מה נשמר על המשיבים?",
    summary:
      "לא שם, לא דוא״ל ולא מזהה אישי. השדות האלה אינם קיימים במערכת, ולא רק " +
      "שאינם בשימוש.",
    points: [
      "מה שנשמר: התשובות עצמן, מתי הן נשלחו, ותווית אקראית של מפגש המילוי שנועדה למנוע ספירה כפולה.",
      "התווית אינה מזהה אדם או מכשיר, ונמחקת בין אנשים במחשב משותף.",
      "החוצה, אל שירות הניתוח, יוצאים ממוצעים ונוסח השאלות בלבד. שאלות הרקע אינן יוצאות כלל.",
      "בפילוח לפי קבוצות, כל תא קטן מדי מוסתר — ובאופן שאי אפשר לחשב אותו בחזרה מתוך הסכומים שכן מוצגים.",
      "אין ואף לא תהיה אפשרות להסיר משיב מהחישוב. שתי תוצאות של אותו סבב, אחת עם כולם ואחת בלעדיו, היו חושפות בדיוק את תשובותיו.",
    ],
  };
}

/**
 * Every topic, in the order a manager meets the questions rather than in the
 * order the system does them: the locked screen comes before the colours,
 * because a locked round is what a school sees first.
 */
export function managerHelpTopics(): HelpTopic[] {
  return [
    privacyTopic(),
    colorsTopic(),
    aiTopic(),
    roundTopic(),
    questionnaireTopic(),
    goalsTopic(),
    dataTopic(),
  ];
}
