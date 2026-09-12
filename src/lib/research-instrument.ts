import { optionsForScale, type AnswerScaleId } from "./survey/answer-scales";
import { estimateMinutesForQuestionnaire } from "./survey/survey-duration";
import type {
  AnalyticSurveyQuestion,
  BackgroundSurveyQuestion,
  SurveyDefinition,
  SurveyDefinitionQuestion,
  SurveyQuestionOption,
  WellbeingDimensionId,
} from "./types/backend";

/**
 * The owner's 126-item research instrument, authored as data.
 *
 * This is the instrument the plan of 2026-08-14 designates as the replacement
 * for the canonical 24 — sixteen background items, two allocation grids of
 * thirteen rows and 108 Likert statements in thirteen blocks — written out from
 * the source document (Google Doc `1W7bQhdo0oyJ-WL73MmrsZB3XJqNDo_lE`, read
 * 2026-09-12) with the source's own defects resolved as
 * `docs/methodologist-questions-analysis-2026-09-12.md` §7 proposes: one
 * duplicated item dropped, one unnumbered item kept, the grids' duplicated
 * component removed, garbled option lists restored, and the one
 * double-negative statement reworded.
 *
 * **Which stone each statement belongs to, and which are reverse-scored, is
 * the proposal of that same analysis (§2), accepted by the owner on
 * 2026-09-12 as the working mapping — not a methodologist's answer.** Every
 * row of that table carries a confidence mark, and a correction from the
 * methodologist is an edit here plus an edit there, in that order of
 * authority. Thirty of the 108 statements are collected and not scored
 * (§2, principles 1–2): they are `background` questions whose options are the
 * scale's own anchors, so a respondent answers them inside the same block (as its
 * optional rows) and no stone ever reads them.
 *
 * What this module deliberately is not: the default. `createCanonicalSurveyDefinition`
 * still builds the 24, because contract `6.0` cannot carry 108 metric
 * narratives and a three-colour distribution does not describe a 1–7 item
 * (plan §5, phase 5). Until `7.0` exists, this instrument is reachable only by
 * name — the local seed's `--research` walk — and nothing offers it to a
 * manager.
 */
export const RESEARCH_INSTRUMENT_ID = "shalomut-research-instrument-2026-09";

const SECTION = {
  demands: "דרישות וגורמי לחץ בעבודה",
  resources: "משאבים בעבודה",
  burnout: "שאלון שחיקה",
  outcomes: "תוצאות תעסוקתיות נחוות",
  affect: "רגש בעבודה",
  climate: "אקלים ארגוני",
  fit: "התאמה בין ערכים",
  detachment: "ניתוק מהעבודה",
  peerBurnout: "שחיקה בקרב עמיתים",
  leisure: "עיסוק ופנאי",
  symptoms: "סימפטומים פיזיים",
  nonWorkLoad: "עומס מחוץ לעבודה",
  lifeSatisfaction: "סיפוק בחיים",
} as const;

export const RESEARCH_INSTRUMENT_SECTIONS: readonly string[] =
  Object.values(SECTION);

type Polarity = "+" | "−";

function analytic(
  id: string,
  sectionId: string,
  scaleId: AnswerScaleId,
  dimensionId: WellbeingDimensionId,
  polarity: Polarity,
  text: string,
  required = true,
): AnalyticSurveyQuestion {
  return {
    id,
    kind: "analytic",
    text,
    required,
    enabled: true,
    sectionId,
    dimensionId,
    scaleId,
    polarity: polarity === "+" ? "positive" : "negative",
  };
}

/**
 * A statement the instrument asks and no stone reads.
 *
 * Background on purpose, with the scale's anchors as its options: the
 * respondent sees it in the block beside the scored statements, the answer is
 * stored like any other, and the analytic filter that keeps the AI and the
 * aggregates to scored questions keeps it out of both.
 *
 * Optional, where a scored statement is required, for the reason ADR-004
 * gives: one analytic question short of the threshold locks the whole round,
 * so a scored statement a respondent may skip is a risk to the school's
 * result, and an unscored one is not. The block marks optional rows `(רשות)`,
 * so the two kinds are distinguishable on screen by that mark alone — which is
 * a statement about what may be skipped, not about what counts.
 */
function unscored(
  id: string,
  sectionId: string,
  scaleId: AnswerScaleId,
  text: string,
): BackgroundSurveyQuestion {
  return {
    id,
    kind: "background",
    text,
    required: false,
    enabled: true,
    sectionId,
    answerMode: "single-choice",
    options: optionsForScale(scaleId),
  };
}

function choice(
  id: string,
  text: string,
  labels: readonly string[],
): BackgroundSurveyQuestion {
  const options: SurveyQuestionOption[] = labels.map((label, index) => ({
    value: String(index + 1),
    label,
  }));

  return {
    id,
    kind: "background",
    text,
    required: false,
    enabled: true,
    answerMode: "single-choice",
    options,
  };
}

const TENURE_BANDS = ["0–2", "3–8", "9–14", "מעל 15"] as const;

/** The sixteen background items, in the source's order. */
function backgroundQuestions(): BackgroundSurveyQuestion[] {
  return [
    choice("bg-school-type", "סוג בית הספר במערכת החינוך בו את/ה עובד/ת", [
      "בית ספר יסודי",
      "חטיבה",
      "תיכון",
    ]),
    choice("bg-age", "גיל", [
      "20 ומטה",
      "21–30",
      "31–40",
      "41–50",
      "51–60",
      "61 ומעלה",
    ]),
    choice("bg-gender", "מין", ["זכר", "נקבה", "מעדיף/ה לא לענות"]),
    choice("bg-family-status", "מצב משפחתי", [
      "רווק/ה",
      "נשוי/אה או בזוגיות קבועה",
      "גרוש/ה",
      "אלמן/ה",
      "אחר",
    ]),
    choice("bg-children-under-18", "מספר ילדים מתחת לגיל 18", [
      "0",
      "1",
      "2",
      "3",
      "4 ומעלה",
      "כל ילדיי מעל גיל 18",
    ]),
    choice("bg-education", "השכלה", [
      "פחות מ-12 שנות לימוד",
      "12 שנות לימוד",
      "תעודה מקצועית",
      "תואר ראשון",
      "תואר שני",
      "PhD",
      "אחר",
    ]),
    choice("bg-role", "תפקיד בעבודה", [
      "מורה בבית הספר",
      "מורה ותפקיד ריכוז",
      "מורה ובעל/ת תפקיד ניהולי",
    ]),
    choice("bg-management-role", "תפקיד ניהולי", ["כן", "לא"]),
    choice("bg-tenure-profession", "שנות ותק בתחום העיסוק המקצועי", TENURE_BANDS),
    choice("bg-tenure-school", "שנות ותק בבית הספר הנוכחי", TENURE_BANDS),
    choice("bg-employment-share", "היקף / אחוז משרה", [
      "25%",
      "50%",
      "75%",
      "100%",
      "מעל 100%",
    ]),
    {
      id: "bg-daily-hours",
      kind: "background",
      text: "מספר שעות עבודה יומי ממוצע",
      required: false,
      enabled: true,
      answerMode: "number",
    },
    choice(
      "bg-after-hours-work",
      "זמן עיסוק בנושאי עבודה מחוץ לשעות העבודה (מיילים, טלפונים, הכנה של שיעורים, הכנת/בדיקת מבחנים וכו')",
      [
        "מתחת לשעה ביום",
        "שעה עד שלוש שעות ביום",
        "מעל 3 שעות ביום",
        "אינני עובד/ת כלל מחוץ לשעות העבודה",
      ],
    ),
    choice("bg-commute", "זמן נסיעה לעבודה ממקום מגוריי", [
      "פחות מ-15 דקות",
      "15–30 דקות",
      "30–60 דקות",
      "60–90 דקות",
      "מעל 90 דקות",
      "לא נדרשת נסיעה לעבודה ממקום מגוריי",
    ]),
    choice("bg-salary-vs-average", "שכרך ביחס לשכר הממוצע במשק", [
      "מתחת לממוצע",
      "ממוצע",
      "מעל הממוצע",
    ]),
    choice("bg-work-mode", "מאפייני העבודה שלי הם:", [
      "100% במקום העבודה",
      "באופן משולב, בית ומקום עבודה",
    ]),
  ];
}

/**
 * The thirteen components both grids share, after the source's duplicated
 * `בדיקת מבחנים` is counted once. The same list twice on purpose: the
 * diagnostic reading of the grids is the difference between a component's
 * share of time and its share of load, which only exists if the rows match.
 */
export const ALLOCATION_COMPONENTS: readonly string[] = [
  "לימוד בכיתה",
  "השתתפות בישיבות מורים",
  "כתיבת תוכניות לימוד",
  "בדיקת מבחנים",
  "פגישות עם גורמי מקצוע אחרים",
  "השתתפות בישיבות הנהלה",
  "בדיקת מטלות",
  "שיעורי בית",
  "מענה טלפוני להורים",
  "שיחות עם תלמידים",
  "עבודה משרדית בירוקרטית",
  "הדרכה",
  "אחר",
];

export const TIME_ALLOCATION_GROUP_ID = "time-allocation";
export const LOAD_ALLOCATION_GROUP_ID = "load-allocation";

function allocationGrid(groupId: string): BackgroundSurveyQuestion[] {
  return ALLOCATION_COMPONENTS.map((text, index) => ({
    id: `${groupId}-${String(index + 1).padStart(2, "0")}`,
    kind: "background",
    text,
    required: false,
    enabled: true,
    answerMode: "allocation-100",
    allocationGroupId: groupId,
  }));
}

const E5 = "likert-5-extent";
const F7 = "likert-7-frequency";

function demands(): SurveyDefinitionQuestion[] {
  const s = SECTION.demands;
  const d = (n: number, dim: WellbeingDimensionId, text: string, required = true) =>
    analytic(`demands-${String(n).padStart(2, "0")}`, s, E5, dim, "−", text, required);
  const u = (n: number, text: string) =>
    unscored(`demands-${String(n).padStart(2, "0")}`, s, E5, text);

  return [
    d(1, "balance", "לחץ זמן"),
    d(2, "balance", "עומס מטלות"),
    d(3, "certainty", "דרישות סותרות בעבודה (למשל גם איכות וגם הספק)"),
    d(4, "balance", "שעות עבודה מעבר להגדרת היקף התפקיד"),
    d(5, "balance", "ציפייה לזמינות בכל שעה, גם מחוץ לשעות מוגדרות של עבודה"),
    d(6, "certainty", "צורך לטפל בדברים דחופים ולא צפויים"),
    d(7, "social-resource", "יחסים מתוחים בין עובדים (כמו יריבות, תחרות)"),
    d(8, "management-support", "יחסים מתוחים בין עובדים להנהלה"),
    d(9, "organizational-climate", "יחס פוגעני כלפיי במילים או בהתנהגות"),
    d(10, "certainty", "הגדרת תפקיד וטווח אחריות לא ברורים ולא מובנים לי"),
    // Optional: the one statement a respondent may have a reason not to answer
    // even anonymously. Analysis §2, note 1.
    d(11, "organizational-climate", "הטרדות מיניות (הערות, בדיחות, פעולות)", false),
    d(
      12,
      "management-support",
      "התערבות פוגענית באופי העבודה שלי על ידי הנהלה (צמצום אחריות / היקף, ניתוק מעבודה עם עמיתים, צמצום אוטונומיה)",
    ),
    d(13, "balance", "כוח אדם לא מספיק ביחס לדרישות העבודה"),
    // Challenge demands: their polarity is undecided, so they are collected and
    // not scored. Analysis §2, note 2.
    u(14, "עבודה הדורשת קבלת החלטות מורכבות ומסובכות"),
    u(15, "עבודה הדורשת ריכוז, קשב וערנות גבוהים ומתמשכים"),
    u(16, "צורך לבצע משימות שונות בו זמנית"),
    // Unnumbered in the source; kept as the block's seventeenth item.
    d(17, "certainty", "אי ודאות לגבי המשך העסקה"),
    d(18, "certainty", "התמודדות עם טכנולוגיה מורכבת ומשתנה"),
    d(19, "certainty", "שינויים תכופים בתהליכי עבודה או במבנה ארגוני"),
    d(
      20,
      "certainty",
      "תקשורת ארגונית לא מספקת (העדר מידע, מסרים והנחיות לא ברורים, נתק בין יחידות או מחלקות)",
    ),
    d(21, "balance", "דרישות וביקורת של הורים"),
    d(22, "balance", "התמודדות עם בעיות משמעת של תלמידים"),
  ];
}

function resources(): SurveyDefinitionQuestion[] {
  const s = SECTION.resources;
  const r = (n: number, dim: WellbeingDimensionId, text: string) =>
    analytic(`resources-${String(n).padStart(2, "0")}`, s, E5, dim, "+", text);
  const u = (n: number, text: string) =>
    unscored(`resources-${String(n).padStart(2, "0")}`, s, E5, text);

  return [
    r(1, "self-expression", "יכולת לכוון את קצב או אופן העבודה שלי על פי יכולותיי וצרכיי"),
    r(2, "self-expression", "יכולת להשתתף ולהשפיע בקבלת ההחלטות משמעותיות בארגון"),
    r(3, "certainty", "שקיפות ושיתוף לגבי שינויים ארגוניים מתוכננים מטעם ההנהלה"),
    r(4, "management-support", "תמיכה של דרג ניהולי בדרג עבודה"),
    r(5, "balance", "הפסקות שמאפשרות מנוחה והתרעננות"),
    u(6, "שכר הולם עבור העבודה שלי"),
    r(7, "organizational-climate", "צדק והוגנות והעדר אפלייה ארגוניים"),
    u(8, "סביבת עבודה נוחה ומותאמת לצרכים"),
    r(9, "certainty", "החזון והיעדים של בית הספר ידועים וברורים לי"),
    u(10, "החזון והיעדים של מערכת החינוך בישראל ידועים וברורים לי"),
    r(11, "meaning", "אני מזדהה עם החזון והיעדים של בית הספר"),
    u(12, "אני מזדהה עם החזון והיעדים של מערכת החינוך בישראל"),
    r(13, "management-support", "יכולת להתייעץ עם מנהל/ת ישיר/ה ולקבל הכוונה בעבודה"),
    r(14, "social-resource", "תמיכה קולגיאלית, צוותית"),
    r(15, "social-resource", "יש אדם הקרוב לליבי בקירבתי בעבודה כאשר אני זקוק/ה לכך"),
    r(16, "social-resource", "אווירה חברתית טובה"),
    r(17, "meaning", "גיוון, עניין ואתגר בעבודה"),
    r(18, "professional-competence", "אפשרויות התפתחות וקידום מקצועי בבית הספר או מערכת החינוך"),
    r(19, "balance", "זמן מספיק לפנאי, חברים, תחביבים, בילויים"),
    r(20, "balance", "זמן מספיק למנוחה והתאוששות במהלך שבוע העבודה"),
    r(21, "professional-competence", "הערכת ביצועים, משוב, הכשרה, אימון ואפשרויות למידה"),
    r(22, "meaning", "תחושת ערך ומשמעות לעבודה שלי"),
    r(23, "professional-competence", "יכולת להביא לידי ביטוי ולנצל את המיומנויות והיכולות שלי"),
    r(
      24,
      "self-expression",
      "בטחון ונינוחות להיות עצמי ולבטא את עצמי בעבודה (גם על רקע מגדרי, תרבותי, עדתי)",
    ),
    r(25, "professional-competence", "אפשרויות למידה ופיתוח כישורים"),
    r(26, "management-support", "קבלת הכרה והערכה לתרומה שלי בעבודה מההנהלה"),
    u(27, "קבלת הכרה והערכה לתרומה שלי בעבודה מההורים"),
    r(28, "meaning", "קבלת הכרה והערכה לתרומה שלי בעבודה מהתלמידים/ות"),
    r(29, "social-resource", "קבלת הכרה והערכה לתרומה שלי בעבודה מהקולגות"),
    u(30, "קבלת הכרה והערכה לתרומה שלי בעבודה מהחברים"),
  ];
}

/**
 * The Shirom–Melamed Burnout Measure, fourteen items on the seven-point
 * frequency scale. All on `balance`, reverse-scored — analysis §2, note 3,
 * variant A: exhaustion reaches the stone whose recommendations are about
 * workload and pace, at the cost of that stone reading partly as exhaustion.
 */
function burnout(): SurveyDefinitionQuestion[] {
  return [
    "מרגיש/ה עייף/ה, סחוט/ה",
    "אין לי כוח ללכת לעבודה בבוקר",
    "מרגיש/ה סחוט/ה פיזית",
    "\"נשבר\" לי",
    "ה\"מצברים\" שלי התרוקנו",
    "מרגיש/ה שחוק/ה",
    "מרגיש/ה שאני חושב/ת בצורה איטית",
    "קשה לי להתרכז",
    "הראש שלי לא צלול",
    "מרגיש/ה שאני מפוזר/ת",
    "קשה לי לחשוב על דברים מסובכים",
    "אין לי יכולת להיות רגיש/ה לצרכים של הורים או לקולגות בעבודה",
    "אין לי כוח להשקיע רגשית בתלמידים/ות",
    "מרגיש/ה שאין לי יכולת להיות סימפטי/ת לתלמידים/ות",
  ].map((text, index) =>
    analytic(
      `burnout-${String(index + 1).padStart(2, "0")}`,
      SECTION.burnout,
      F7,
      "balance",
      "−",
      text,
    ),
  );
}

function outcomes(): SurveyDefinitionQuestion[] {
  const s = SECTION.outcomes;
  const o = (n: number, dim: WellbeingDimensionId, text: string) =>
    analytic(`outcomes-${String(n).padStart(2, "0")}`, s, E5, dim, "−", text);
  const u = (n: number, text: string) =>
    unscored(`outcomes-${String(n).padStart(2, "0")}`, s, E5, text);

  return [
    o(1, "balance", "לא מספיק/ה להוציא אל הפועל את תוכנית הלימודים"),
    o(2, "balance", "מתקשה ליצור סדר עדיפויות נכון בעבודה"),
    o(3, "balance", "לא מצליח/ה להיכנס לרצף של עבודה ללא הפרעות"),
    o(4, "balance", "לא מצליח/ה להתעמק בנושא שאני עובד/ת עליו"),
    u(5, "עושה טעויות של חוסר תשומת לב בעבודה שלי"),
    u(6, "עושה שגיאות בשיקול דעת בעבודה שלי"),
    o(7, "balance", "לא מקפיד/ה על הנחיות ותקנות בגלל לחץ זמן"),
    u(8, "נוטה לקונפליקטים עם הורים של תלמידים בגלל הבדל בתפיסות חינוכיות"),
    u(9, "היו לי בשנה האחרונה היעדרויות לא מוצדקות מהעבודה"),
    u(10, "היו לי בשנה האחרונה היעדרויות מהעבודה על רקע בריאותי"),
    o(11, "social-resource", "נוטה לקונפליקטים עם קולגות בעבודה בגלל עומס"),
    u(12, "חושב/ת על עזיבת מקום העבודה שלי"),
    u(13, "חושב/ת על עזיבת המקצוע או תחום העיסוק שלי"),
    o(14, "professional-competence", "מתקשה לעמוד ביעדים שלי"),
    u(15, "לא מצליח/ה לשמור על תזונה תקינה"),
    o(16, "balance", "מרגיש/ה פגיעה בתחומי חיים אחרים שלי"),
    o(17, "balance", "מרגיש/ה פגיעה בשינה שלי"),
    u(18, "מזניח/ה טיפול בבריאות שלי"),
    o(19, "balance", "מרגיש/ה שאני נקרע/ת בין העבודה שלי לבין המשפחה שלי"),
    o(20, "balance", "יש לי קשיים באיזון הזמן בין פעילות בעבודה לבין פעילות בבית"),
    o(21, "balance", "הימים חולפים במהירות מבלי שאני מספיק/ה לעשות דבר"),
    o(22, "meaning", "מרגיש/ה אכזבה מהאופן בו אני משקיע/ה את הזמן שלי"),
  ];
}

function shortBlocks(): SurveyDefinitionQuestion[] {
  return [
    unscored("affect-01", SECTION.affect, E5, "עצב, דכדוך"),
    unscored("affect-02", SECTION.affect, E5, "מתח, חרדה, אי שקט"),
    analytic("affect-03", SECTION.affect, E5, "social-resource", "−", "בדידות"),

    analytic("climate-01", SECTION.climate, E5, "organizational-climate", "+", "ההנהלה פועלת למניעת לחץ ועומס בבית הספר"),
    analytic("climate-02", SECTION.climate, E5, "organizational-climate", "+", "איכות חיים ורווחה של העובדים/ות היא בעדיפות גבוהה מבחינת בית הספר"),
    analytic("climate-03", SECTION.climate, E5, "organizational-climate", "+", "בית הספר מנגיש ומיידע לגבי שירותי תמיכה פסיכולוגיים"),

    analytic("fit-01", SECTION.fit, E5, "meaning", "+", "הערכים בבית הספר שאני עובד/ת בו תואמים לערכים האישיים שלי"),
    analytic("fit-02", SECTION.fit, E5, "meaning", "+", "אני מזדהה עם מדיניות ומטרות בית הספר"),
    unscored("fit-03", SECTION.fit, E5, "אני מזדהה עם מדיניות ומטרות מערכת החינוך בישראל"),

    analytic("detachment-01", SECTION.detachment, E5, "balance", "+", "כשאני מגיע/ה הביתה אני יכול/ה בקלות להירגע ולהתנתק מהעבודה"),
    // Reworded from the source's double negative; analysis §7, defect 7.
    analytic("detachment-02", SECTION.detachment, E5, "balance", "−", "העבודה ממשיכה להעסיק אותי גם כשאני הולך/ת לישון"),

    unscored("peer-burnout-01", SECTION.peerBurnout, E5, "באיזו מידה להערכתך חבריך/חברותיך לעבודה חווים/ות שחיקה?"),

    unscored("leisure-01", SECTION.leisure, E5, "ספורט ופעילות גופנית"),
    unscored("leisure-02", SECTION.leisure, E5, "מיינדפולנס, יוגה ומדיטציה"),
    unscored("leisure-03", SECTION.leisure, E5, "תחביבים ועיסוק פנאי (כגון אמנות, קריאה, למידה והעשרה, נגינה ועוד)"),

    unscored("symptoms-01", SECTION.symptoms, E5, "כאבי גב, צוואר או מפרקים"),
    unscored("symptoms-02", SECTION.symptoms, E5, "בעיות עיכול וקיבה, כאבי בטן"),
    unscored("symptoms-03", SECTION.symptoms, E5, "כאבי ראש"),

    unscored("non-work-load-01", SECTION.nonWorkLoad, E5, "באיזו מידה את/ה חווה לחץ ועומס בתחומים שאינם קשורים לעבודה (בית, משפחה, מצב כלכלי ועוד)"),

    // `במידה נמוכה` in the source read as a typo (analysis §7, defect 5), so
    // the block answers on the same anchors as every other 1–5 block.
    unscored("life-satisfaction-01", SECTION.lifeSatisfaction, E5, "אני מסופק/ת מחיי"),
  ];
}

/**
 * The 126 items in the order a respondent meets them — 150 stored questions,
 * because each grid's thirteen components are thirteen rows.
 */
export function researchInstrumentQuestions(): SurveyDefinitionQuestion[] {
  return [
    ...backgroundQuestions(),
    ...allocationGrid(TIME_ALLOCATION_GROUP_ID),
    ...allocationGrid(LOAD_ALLOCATION_GROUP_ID),
    ...demands(),
    ...resources(),
    ...burnout(),
    ...outcomes(),
    ...shortBlocks(),
  ];
}

/** The two grids' shared question, one per grid, shown above its rows. */
export const ALLOCATION_GRID_PROMPTS: Readonly<Record<string, string>> = {
  [TIME_ALLOCATION_GROUP_ID]:
    "מה הקצאת הזמן שלך ביום עבודה ממוצע, לכל אחד ממרכיבי העיסוק? אם מרכיב אינו רלוונטי — 0; אם הוא תופס רבע מהיום — 25. הסכום צריך להיות 100.",
  [LOAD_ALLOCATION_GROUP_ID]:
    "מהי חוויית העומס והלחץ שלך ביום עבודה ממוצע, לכל אחד ממרכיבי העיסוק? אם מרכיב אינו רלוונטי — 0; אם הוא תופס רבע מחוויית העומס — 25. הסכום צריך להיות 100.",
};

export function createResearchInstrumentDefinition(
  title: string,
  minimumResponses: number,
): SurveyDefinition {
  const questions = researchInstrumentQuestions();

  return {
    title,
    audience: "כלל צוות ההוראה",
    estimatedMinutes: estimateMinutesForQuestionnaire(questions),
    minimumResponses,
    // The source's own consent text, with its "about 15 minutes" corrected to
    // what the questionnaire actually takes (analysis §7, defect 6).
    introText:
      "שלום רב, שאלון זה מיועד להערכה של חווית העבודה שלך. משך המענה לשאלון הוא כ-20–25 דקות. אנחנו מעריכים מאוד את נכונותך להקדיש מזמנך. המענה שלך תורם במידה משמעותית להבנת חווית העובד/ת ועשוי לתרום לפתרונות לשיפורה.",
    anonymityText:
      "המענה לשאלון הוא אנונימי לחלוטין: לא נאספים פרטים מזהים ואין יכולת לקשר בין התשובות לבין המשיב/ה. התוצאות מוצגות רק ברמה מצרפית, אחרי הגעה לסף פרטיות.",
    questions,
    instrumentId: RESEARCH_INSTRUMENT_ID,
  };
}
