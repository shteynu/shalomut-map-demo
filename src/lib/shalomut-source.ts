import { SCORING_BANDS } from "./scoring-bands";

export type WellbeingStatus = "green" | "yellow" | "red";

export type WellbeingDimensionId =
  | "self-expression"
  | "professional-competence"
  | "social-resource"
  | "balance"
  | "management-support"
  | "certainty"
  | "organizational-climate"
  | "meaning";

export type SourceMaterial = {
  id: string;
  title: string;
  kind: "form" | "design" | "pdf";
  role: string;
  url?: string;
  path?: string;
  retrievedAt: string;
};

export type SurveyResponseOption = {
  value: WellbeingStatus;
  title: string;
  text: string;
  description: string;
  score: number;
};

export type ScoringThreshold = {
  status: WellbeingStatus;
  label: string;
  min: number;
  max: number;
};

export type SurveyQuestion = {
  id: string;
  dimensionId: WellbeingDimensionId;
  text: string;
  required: boolean;
  source: "google-form";
};

export type SurveyDimension = {
  id: WellbeingDimensionId;
  label: string;
  conceptLabel: string;
  subtitle: string;
  sourceLabel: string;
  questions: SurveyQuestion[];
};

export type SurveyInstrument = {
  id: string;
  title: string;
  description: string;
  language: "he";
  direction: "rtl";
  estimatedMinutes: {
    min: number;
    max: number;
  };
  privacyThresholdDefault: number;
  dimensions: SurveyDimension[];
  questions: SurveyQuestion[];
};

export const sourceMaterials: SourceMaterial[] = [
  {
    id: "google-form-survey-v1",
    title: "מפת שלומות",
    kind: "form",
    role: "Canonical questionnaire: 8 dimensions, 24 required statements, shared green/yellow/red response scale.",
    url: "https://docs.google.com/forms/d/e/1FAIpQLSdoDKUwm_tcRD_mOp4_1t1Zn-3LFE-hOkiEx9Ejey91GuPelQ/viewform",
    retrievedAt: "2026-07-02",
  },
  {
    id: "adobe-xd-map-concept",
    title: "מפת השלומות",
    kind: "design",
    role: "Visual reference for the organic stone map and dashboard flow. It contains 4 web artboards last modified on 2025-06-17.",
    url: "https://xd.adobe.com/view/29896c9d-096a-4259-88bb-1dfb621f1131-7cda/grid/",
    retrievedAt: "2026-07-02",
  },
  {
    id: "platform-mvp-brief-he",
    title: "הסבר מפורט: פלטורפמת מפת שלומות",
    kind: "pdf",
    role: "Hebrew MVP brief: roles, organizations, rounds, survey, scoring, dashboard, privacy, permissions, and future recommendations.",
    path: "/Users/maxim.berenshtein/Downloads/הסבר מפורט_ פלטורפמת מפת שלומות.pdf",
    retrievedAt: "2026-07-02",
  },
  {
    id: "teachers-wellbeing-map-research",
    title: "Sasha Klyachkina: Teachers' Wellbeing Map",
    kind: "pdf",
    role: "Research and strategy context: rationale, wellbeing definitions, three-year plan, pilot framing, and theory of change.",
    path: "/Users/maxim.berenshtein/Downloads/Sasha Klyachkina_ Teachers' Wellbeing Map.pdf",
    retrievedAt: "2026-07-02",
  },
  {
    id: "one-page-initiative-he",
    title: "מיזם ״מפת שלומות״",
    kind: "pdf",
    role: "One-page Hebrew initiative summary for positioning, narrative, AI framing, and partner context.",
    path: "/Users/maxim.berenshtein/Downloads/מיזם ״מפת שלומות״ (3).pdf",
    retrievedAt: "2026-07-02",
  },
  {
    id: "ira-workshop-deck-he",
    title: "שלומות לאירה",
    kind: "pdf",
    role: "Workshop/storytelling deck with the journey metaphor and the 8-dimension map narrative.",
    path: "/Users/maxim.berenshtein/Downloads/שלומות לאירה.pdf",
    retrievedAt: "2026-07-02",
  },
  {
    id: "darcha-human-space-deck-he",
    title: "המרחב האנושי דרכא",
    kind: "pdf",
    role: "Hebrew deck with burnout/wellbeing framing, the 8 dimensions, response scale language, and reflection prompts.",
    path: "/Users/maxim.berenshtein/Downloads/המרחב האנושי דרכא (2).pdf",
    retrievedAt: "2026-07-02",
  },
];

export const responseScale: SurveyResponseOption[] = [
  {
    value: "green",
    title: "ירוק",
    text: "ההיגד משקף באופן מלא את מצבי הנוכחי.",
    description:
      "ההיגד הזה משקף באופן מלא את מצבי הנוכחי. אני מרגישה נוחות ורוגע כשאני חושבת על ההיבט הזה בעבודתי. כרגע אינני רואה צורך לשנות או לשפר משהו מהותי בנושא הזה.",
    score: 100,
  },
  {
    value: "yellow",
    title: "צהוב",
    text: "המצב סביר, אך יש נקודות שכדאי לתת להן תשומת לב.",
    description:
      "ההיגד הזה משקף רק חלקית את מצבי הנוכחי. באופן כללי המצב סביר, אבל יש נקודות שמטרידות אותי או שהייתי רוצה לראות בהן שיפור. אני מרגישה שכדאי לתת להיבט הזה יותר תשומת לב ולבצע בו שינוי מסוים.",
    score: 60,
  },
  {
    value: "red",
    title: "אדום",
    text: "ההיבט הזה יוצר מתח או חוסר נוחות ודורש פעולה.",
    description:
      "ההיגד הזה אינו משקף כלל את מצבי הנוכחי. כשאני חושבת על ההיבט הזה, אני מרגישה מתח, דאגה, עייפות או חוסר נוחות ממשיים. ברור לי שכאן דרושים שינוי ופעולה קונקרטית, ועדיף בזמן הקרוב.",
    score: 0,
  },
];

export const statusLabels: Record<WellbeingStatus, string> = {
  green: "הכל טוב",
  yellow: "מצב סביר",
  red: "נדרש טיפול מיידי",
};

// The numbers come from `contracts/scoring-bands.json`, which the AI analytics
// service reads too; only the Hebrew labels belong to this file.
export const scoringThresholds: ScoringThreshold[] = SCORING_BANDS.map(
  (band) => ({
    status: band.status,
    label: statusLabels[band.status],
    min: band.min,
    max: band.max,
  }),
);

function question(id: string, dimensionId: WellbeingDimensionId, text: string): SurveyQuestion {
  return {
    id,
    dimensionId,
    text,
    required: true,
    source: "google-form",
  };
}

const surveyDimensions: SurveyDimension[] = [
  {
    id: "self-expression",
    label: "ביטוי עצמי",
    conceptLabel: "קול אישי",
    subtitle: "אפשרות לביטוי עצמי",
    sourceLabel: "ביטוי עצמי",
    questions: [
      question("self-expression-1", "self-expression", "אני יכולה להביע בחופשיות את הרעיונות והמחשבות שלי בעבודה."),
      question("self-expression-2", "self-expression", "אני מרגישה ששומעים אותי ומתחשבים בדעתי."),
      question("self-expression-3", "self-expression", "אני מרגישה שאני עצמי בעבודה, ושאין לי צורך להעמיד פנים."),
    ],
  },
  {
    id: "professional-competence",
    label: "מסוגלות מקצועית",
    conceptLabel: "מומחיות בטוחה",
    subtitle: "תחושת מסוגלות מקצועית",
    sourceLabel: "מסוגלות מקצועית",
    questions: [
      question(
        "professional-competence-1",
        "professional-competence",
        "אני מקבלת באופן קבוע חיזוק לכך שהמאמצים והכישורים שלי בעלי ערך.",
      ),
      question("professional-competence-2", "professional-competence", "אני בטוחה במומחיות המקצועית שלי וביכולות שלי."),
      question("professional-competence-3", "professional-competence", "אני מרגישה כשירה מספיק כדי להתמודד עם המשימות שעולות."),
    ],
  },
  {
    id: "social-resource",
    label: "קשרים חברתיים",
    conceptLabel: "משאב חברתי",
    subtitle: "קשרים חיוביים עם עמיתות ועמיתים",
    sourceLabel: "קשרים חברתיים",
    questions: [
      question(
        "social-resource-1",
        "social-resource",
        "יש לי לפחות אדם אחד בעבודה שאני סומכת עליו/עליה ושאני יכולה לדבר איתו/איתה בפתיחות.",
      ),
      question("social-resource-2", "social-resource", "בצוות קיימים כבוד הדדי ותמיכה."),
      question("social-resource-3", "social-resource", "התקשורת עם הקולגות נותנת לי אנרגיה ורגשות חיוביים."),
    ],
  },
  {
    id: "balance",
    label: "איזון",
    conceptLabel: "איזון",
    subtitle: "היחס בין היקף המשימות לבין הזמן לביצוען",
    sourceLabel: "איזון: היחס בין היקף המשימות לבין הזמן לביצוען",
    questions: [
      question("balance-1", "balance", "אני מצליחה לבצע את משימות העבודה בזמן שנקבע."),
      question("balance-2", "balance", "יש לי מספיק זמן למנוחה ולהתאוששות אחרי העבודה."),
      question("balance-3", "balance", "אני מרגישה שהעומס בעבודה מתאים לי והוא בהישג יד/בר־ביצוע עבורי."),
    ],
  },
  {
    id: "management-support",
    label: "עורף מקצועי",
    conceptLabel: "עורף מקצועי",
    subtitle: "תמיכה מהנהלה",
    sourceLabel: "עורף מקצועי: תמיכת הנהלה",
    questions: [
      question("management-support-1", "management-support", "אני מקבלת באופן קבוע תמיכה ומשוב מההנהלה."),
      question("management-support-2", "management-support", "אני יכולה לפנות למנהל/ת לעזרה בלי חשש."),
      question("management-support-3", "management-support", "המנהל/ת מעריכ/ה את המאמצים שלי ומביע/ה זאת באופן גלוי."),
    ],
  },
  {
    id: "certainty",
    label: "ודאות",
    conceptLabel: "ודאות",
    subtitle: "ודאות בסביבת עבודה",
    sourceLabel: "ודאות",
    questions: [
      question("certainty-1", "certainty", "אני מבינה מה מצפה לי בעבודה מחר ובזמן הקרוב."),
      question("certainty-2", "certainty", "בעבודה יש מינימום שינויים בלתי צפויים ולא מתוכננים."),
      question("certainty-3", "certainty", "המשימות והאחריות שלי מוגדרות בבירור ואינן משתנות ללא התראה מראש."),
    ],
  },
  {
    id: "organizational-climate",
    label: "אקלים ארגוני",
    conceptLabel: "אקלים ארגוני",
    subtitle: "קידום רווחה נפשית כחלק מתרבות הארגון",
    sourceLabel: "אקלים ארגוני: תמיכה ברווחה פסיכולוגית ברמה ארגונית",
    questions: [
      question(
        "organizational-climate-1",
        "organizational-climate",
        "בארגון מקובל לדבר באופן פתוח על קשיים רגשיים ופסיכולוגיים.",
      ),
      question("organizational-climate-2", "organizational-climate", "המצב הנפשי שלי נלקח בחשבון בעת חלוקת המשימות."),
      question("organizational-climate-3", "organizational-climate", "האווירה בצוות חיובית ואינה יוצרת לחץ מיותר."),
    ],
  },
  {
    id: "meaning",
    label: "משמעות",
    conceptLabel: "משמעות",
    subtitle: "תחושת ערך ומשמעות בעבודה",
    sourceLabel: "משמעות",
    questions: [
      question("meaning-1", "meaning", "אני רואה תועלת ברורה עבור אנשים אחרים בעבודה שלי."),
      question("meaning-2", "meaning", "ברור לי למה אני עושה את מה שאני עושה."),
      question("meaning-3", "meaning", "אני מרגישה שלעבודה שלי יש משמעות והיא חשובה לי באופן אישי."),
    ],
  },
];

export const surveyInstrument: SurveyInstrument = {
  id: "shalomut-organizational-diagnosis-v1",
  title: "מפת שלומות",
  description: "אבחון שלומות ארגונית",
  language: "he",
  direction: "rtl",
  estimatedMinutes: {
    min: 15,
    max: 20,
  },
  privacyThresholdDefault: 10,
  dimensions: surveyDimensions,
  questions: surveyDimensions.flatMap((dimension) => dimension.questions),
};
