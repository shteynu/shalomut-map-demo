export type RoundStatus = "open" | "closed";
export type WellbeingStatus = "green" | "yellow" | "red";

export type Organization = {
  id: string;
  name: string;
  city: string;
  managerName: string;
  staffSize: number;
};

export type Round = {
  id: string;
  organizationId: string;
  period: string;
  openedAt: string;
  closesAt: string;
  status: RoundStatus;
  responseCount: number;
  minimumResponses: number;
  expectedResponses: number;
  shareUrl: string;
  backgroundInputs: {
    teachingStaff: number;
    sicknessDaysThisQuarter: number;
    newStaffMembers: number;
    studentCount: number;
    socioEconomicIndex: number;
    classesPerGrade: Record<string, number>;
    notes: string;
  };
};

export type SurveyQuestion = {
  id: string;
  dimensionId: string;
  text: string;
  required: boolean;
};

export type ResponseMetric = {
  label: string;
  value: string;
  helper: string;
  highlightText?: string;
};

export type WellbeingDimension = {
  id: string;
  label: string;
  conceptLabel: string;
  subtitle: string;
  score: number;
  status: WellbeingStatus;
  mapPosition: {
    top: string;
    right: string;
    size: string;
    rotate: number;
  };
  conceptPosition: {
    top: string;
    right: string;
    width: string;
    height: string;
    rotate: number;
    radius: string;
  };
  conceptColor: string;
  conceptStatusText: string;
  conceptStatusDirection: "up" | "down";
  summary: string[];
  metrics: ResponseMetric[];
  recommendations: {
    title: string;
    body: string;
  }[];
};

export const organization: Organization = {
  id: "org-dror",
  name: "בית ספר דרור",
  city: "חיפה",
  managerName: "דנה לוי",
  staffSize: 34,
};

export const activeRound: Round = {
  id: "round-2026-q1",
  organizationId: organization.id,
  period: "רבעון 1, תשפ״ה",
  openedAt: "12.01.2026",
  closesAt: "26.01.2026",
  status: "open",
  responseCount: 18,
  minimumResponses: 10,
  expectedResponses: 34,
  shareUrl: "https://shteynu.github.io/shalomut-map-demo/survey/dror-q1/",
  backgroundInputs: {
    teachingStaff: 34,
    sicknessDaysThisQuarter: 91,
    newStaffMembers: 5,
    studentCount: 420,
    socioEconomicIndex: 4,
    classesPerGrade: {
      "א": 2,
      "ב": 2,
      "ג": 2,
      "ד": 2,
      "ה": 3,
      "ו": 2
    },
    notes: "שינוי מערכת שעות בחטיבה הצעירה וכניסת צוות חדש בתחילת השנה.",
  },
};

export const surveyQuestions: SurveyQuestion[] = [
  {
    id: "expression-1",
    dimensionId: "self-expression",
    text: "אני יכולה להביע בחופשיות את הרעיונות והמחשבות שלי בעבודה.",
    required: true,
  },
  {
    id: "competence-1",
    dimensionId: "professional-competence",
    text: "אני מקבלת באופן קבוע חיזוק לכך שהמאמצים והכישורים שלי בעלי ערך.",
    required: true,
  },
  {
    id: "social-1",
    dimensionId: "social-resource",
    text: "יש לי לפחות אדם אחד בעבודה שאני סומכת עליו או עליה ושאני יכולה לדבר איתו או איתה בפתיחות.",
    required: true,
  },
  {
    id: "balance-1",
    dimensionId: "balance",
    text: "אני מרגישה שהעומס בעבודה מתאים לי והוא בר ביצוע עבורי.",
    required: true,
  },
  {
    id: "support-1",
    dimensionId: "management-support",
    text: "אני יכולה לפנות למנהל או למנהלת לעזרה בלי חשש.",
    required: true,
  },
  {
    id: "certainty-1",
    dimensionId: "certainty",
    text: "המשימות והאחריות שלי מוגדרות בבירור ואינן משתנות ללא התראה מראש.",
    required: true,
  },
  {
    id: "climate-1",
    dimensionId: "organizational-climate",
    text: "בארגון מקובל לדבר באופן פתוח על קשיים רגשיים ופסיכולוגיים.",
    required: true,
  },
  {
    id: "meaning-1",
    dimensionId: "meaning",
    text: "אני מרגישה שלעבודה שלי יש משמעות והיא חשובה לי באופן אישי.",
    required: true,
  },
];

export const responseOptions = [
  {
    value: "green",
    title: "ירוק",
    text: "ההיגד משקף באופן מלא את מצבי הנוכחי.",
  },
  {
    value: "yellow",
    title: "צהוב",
    text: "המצב סביר, אך יש נקודות שכדאי לתת להן תשומת לב.",
  },
  {
    value: "red",
    title: "אדום",
    text: "ההיבט הזה יוצר מתח או חוסר נוחות ודורש פעולה.",
  },
] as const;

export const wellbeingDimensions: WellbeingDimension[] = [
  {
    id: "self-expression",
    label: "קול אישי",
    conceptLabel: "קול אישי",
    subtitle: "אפשרות לביטוי עצמי",
    score: 82,
    status: "green",
    mapPosition: { top: "10%", right: "12%", size: "8.6rem", rotate: -9 },
    conceptPosition: {
      top: "12.5%",
      right: "29.5%",
      width: "24rem",
      height: "11rem",
      rotate: 0,
      radius: "44% 56% 52% 48% / 48% 38% 62% 52%",
    },
    conceptColor: "#e43e5d",
    conceptStatusText: "המצב מעולה וחשוב לשמר אותו",
    conceptStatusDirection: "up",
    summary: [
      "ממצאי האבחון מראים כי רוב חברי הצוות חשים בנוח להביע את דעתם המקצועית והאישית ומדווחים על תחושת שייכות גבוהה. מרבית המורים מרגישים כי קולם נשמע בפורומים השונים ושמנהלי בית הספר פתוחים לשמוע יוזמות חדשות ורעיונות פדגוגיים יצירתיים.",
      "עם זאת, לצד החוזק הבולט בממד זה, ניכר כי בקבוצות מיעוט מסוימות – בעיקר בקרב מורים חדשים או אנשי צוות פרא-רפואי – קיימת לעיתים רתיעה מהשמעת ביקורת או שיתוף בחששות מקצועיים. הם מתארים חשש משיפוטיות או מחוסר הסכמה שיעיב על היחסים בצוות.",
      "כדי לשמר ולחזק חוזקה זו, מומלץ למסד שגרות המעודדות השמעת קול מגוון. יצירת סבבי שיתוף קצרים בישיבות צוות קטנות או תיבות הצעות דיגיטליות אנונימיות יכולות להעניק ביטחון נוסף גם למי שמתקשה לדבר בפורום רחב.",
    ],
    metrics: [
      {
        value: "82%",
        label: "חופש ביטוי",
        helper: "בחרו ירוק בשאלות הקול האישי",
        highlightText: "דיווחו כי יש להם מרחב לביטוי עצמי ולשיתוף דעה מקצועית.",
      },
      {
        value: "7%",
        label: "סיכון נמוך",
        helper: "בחרו אדום בממד זה",
        highlightText: "דיווחו על קושי עקבי להביע עמדה חינוכית או רגשית.",
      },
      { value: "4.1", label: "ציון ממוצע", helper: "מתוך 5 במדד המשוקלל" },
    ],
    recommendations: [
      {
        title: "לשמר פורומים פתוחים",
        body: "להמשיך לפתוח ישיבות צוות עם מקום קצר להצפת רעיונות או חסמים.",
      },
    ],
  },
  {
    id: "professional-competence",
    label: "מומחיות בטוחה",
    conceptLabel: "מומחיות בטוחה",
    subtitle: "תחושת מסוגלות מקצועית",
    score: 76,
    status: "green",
    mapPosition: { top: "18%", right: "34%", size: "7.9rem", rotate: 7 },
    conceptPosition: {
      top: "15.5%",
      right: "12%",
      width: "15rem",
      height: "15rem",
      rotate: 7,
      radius: "42% 58% 40% 60% / 47% 38% 62% 53%",
    },
    conceptColor: "#23ca10",
    conceptStatusText: "המצב מעולה וחשוב לשמר אותו",
    conceptStatusDirection: "up",
    summary: [
      "ממדי המסוגלות המקצועית והמומחיות בקרב אנשי הצוות מציגים תמונה יציבה וחיובית מאוד. רוב המורים מדווחים כי הם מחזיקים בידע, בכלים ובכישורים הנדרשים לניהול יעיל של כיתותיהם ולהתמודדות עם אתגרים פדגוגיים מורכבים בשגרה.",
      "פילוח הנתונים מגלה כי תחושת הביטחון המקצועי גבוהה במיוחד בקרב המורים הוותיקים המרגישים מוערכים. יחד עם זאת, מורים בשנתם הראשונה או השנייה מדווחים על תחושות בדידות מקצועית וחשש מפני מצבי קיצון בהתנהגות תלמידים או בשיח מול הורים.",
      "לשם חיזוק המענה, מומלץ לבנות מערך מובנה של קבוצות עמיתים קבועות או מפגשי חניכה (מנטורינג) ממוקדים. מתן משוב מעצים וממוקד לצוותים הצעירים יסייע במעבר רך יותר ובביסוס תחושת המומחיות שלהם.",
    ],
    metrics: [
      {
        value: "76%",
        label: "מסוגלות גבוהה",
        helper: "דיווחו על ביטחון מקצועי",
        highlightText: "מרגישים בטוחים ביכולת המקצועית שלהם להוביל כיתה או משימה מורכבת.",
      },
      {
        value: "12%",
        label: "צריכים חיזוק",
        helper: "סימנו אדום או צהוב נמוך",
        highlightText: "מרגישים צורך בליווי, חניכה או משוב תדיר יותר.",
      },
      { value: "5", label: "חברי צוות חדשים", helper: "זקוקים לליווי מובנה" },
    ],
    recommendations: [
      {
        title: "חונכות מקצועית",
        body: "לשדך בין מורה ותיק למורה חדש סביב אתגר הוראה אחד בכל חודש.",
      },
    ],
  },
  {
    id: "social-resource",
    label: "משאב חברתי",
    conceptLabel: "משאב חברתי",
    subtitle: "קשרים חיוביים עם עמיתות ועמיתים",
    score: 64,
    status: "yellow",
    mapPosition: { top: "37%", right: "22%", size: "10.2rem", rotate: -3 },
    conceptPosition: {
      top: "45%",
      right: "23%",
      width: "25rem",
      height: "11rem",
      rotate: 0,
      radius: "36% 64% 40% 60% / 44% 34% 66% 56%",
    },
    conceptColor: "#efa300",
    conceptStatusText: "המצב מעולה וחשוב לשמר אותו",
    conceptStatusDirection: "up",
    summary: [
      "האווירה החברתית הכללית בבית הספר נתפסת כחיובית ומכבדת, ורוב אנשי הצוות מדווחים על יחסי עבודה טובים ונעימים בחדר המורים. קיימת נכונות עקרונית לסייע זה לזה במשימות טכניות והחלפות נקודתיות של שיעורים בעת הצורך.",
      "לצד זאת, הנתונים מצביעים על חסר בתמיכה רגשית עמוקה ובקשרים קרובים המהווים משאב חוסן ברגעי לחץ. מורים רבים מדווחים על תחושת 'בדידות תפקודית' – הם מוקפים באנשים אך מרגישים לבד בהתמודדות עם שחיקה רגשית או עם אירועים מורכבים בכיתה.",
      "כדי להפוך את המרחב החברתי למקור תמיכה ממשי, מומלץ ליזום מפגשי שיח בלתי פורמליים מונחים, סדנאות הוקרה הדדית או שגרות פרגון מובנות. יצירת רשת תמיכה רגשית פנים-ארגונית תסייע במניעת שחיקה ובהגברת שביעות הרצון הכללית.",
    ],
    metrics: [
      {
        value: "78%",
        label: "אווירה חברתית טובה",
        helper: "ציינו כי יש אווירה חברתית טובה במידה רבה או רבה מאוד.",
        highlightText: "ציינו כי יש אווירה חברתית טובה — במידה רבה או רבה מאוד.",
      },
      {
        value: "73%",
        label: "אדם קרוב בעבודה",
        helper: "דיווחו כי יש אדם בעבודה הקרוב לליבם כשהם זקוקים לכך.",
        highlightText:
          "מהמורים דיווחו כי יש אדם בעבודה הקרוב לליבם כשהם זקוקים לכך — במידה רבה או רבה מאוד.",
      },
      {
        value: "21%",
        label: "תחושת בדידות נקודתית",
        helper: "בחרו צהוב או אדום בשאלת התמיכה האישית.",
      },
      {
        value: "64",
        label: "ציון ממד",
        helper: "ציון משוקלל בסולם 0-100.",
      },
    ],
    recommendations: [
      {
        title: "חונכות וקבוצות תמיכה לצוותים חדשים",
        body: "לעודד יצירת קשרים באמצעות מנטורינג: מורה ותיק שמלווה מורה חדש, או חיבורים יזומים בין צוותים.",
      },
      {
        title: "אירועים חברתיים קטנים בתדירות קבועה",
        body: "ארוחות בוקר צוותיות, טיול רבעוני או הפסקת קפה משותפת לחיזוק תחושת שייכות והפגת עומס.",
      },
      {
        title: "שגרות מפגש חברתי-מקצועי",
        body: "מפגשים קצרים אחת לשבועיים ללמידה הדדית, שיתוף רגשי או פשוט לשיחה פתוחה.",
      },
      {
        title: "שיח פתוח עם ההנהלה על תחושת בדידות",
        body: "לייצר מרחב בטוח להעלות תחושת ניתוק או עומס אישי ולטפל בהם יחד.",
      },
      {
        title: "פרגון והוקרה יומיומית",
        body: "לעודד מסגרות פשוטות של הוקרה: לוח מחמאות, דואר פרגון או דקות פרגון בישיבות צוות.",
      },
    ],
  },
  {
    id: "balance",
    label: "איזון",
    conceptLabel: "איזון",
    subtitle: "יחס מאוזן בין כמות המשימות לזמן לביצוען",
    score: 42,
    status: "red",
    mapPosition: { top: "58%", right: "11%", size: "9.4rem", rotate: 10 },
    conceptPosition: {
      top: "54.5%",
      right: "58%",
      width: "22rem",
      height: "12rem",
      rotate: 0,
      radius: "40% 60% 37% 63% / 44% 40% 60% 56%",
    },
    conceptColor: "#ea7fb1",
    conceptStatusText: "המצב סביר",
    conceptStatusDirection: "down",
    summary: [
      "נושא עומס העבודה והיעדר האיזון מהווה את מוקד הסיכון והתורפה המשמעותי ביותר באבחון הנוכחי. מרבית אנשי הצוות מדווחים על שחיקה מצטברת, תחושת הצפה קבועה וקושי ממשי לנתק בין עבודת ההוראה לחיים האישיים בבית.",
      "הלחץ מתגבר במיוחד סביב משימות מנהלתיות, כתיבת דוחות, ישיבות ארוכות לאחר שעות הלימודים ותקופות של הערכה וציונים. הצוות מתאר פער עמוק בין הציפיות התובעניות של המערכת לבין הזמן הריאלי שעומד לרשותם לצורך תכנון, מנוחה והתאוששות.",
      "לטיפול במוקד סיכון זה נדרשת התערבות ניהולית ממוקדת: בחינה מחודשת של חובת הישיבות, הגדרת גבולות ברורים לתקשורת דיגיטלית בערבים (למשל, ללא הודעות אחרי 19:00), וצמצום מטלות בירוקרטיות לטובת פינוי זמן לתכנון פדגוגי איכותי.",
    ],
    metrics: [
      {
        value: "42",
        label: "ציון ממד",
        helper: "נמוך מסף ההתראה שהוגדר",
        highlightText: "הציון הכללי בממד האיזון נמצא מתחת לסף ההתראה.",
      },
      {
        value: "39%",
        label: "עומס גבוה",
        helper: "בחרו אדום בשאלת העומס",
        highlightText: "דיווחו כי עומס המשימות אינו מותאם לזמן הזמין בפועל.",
      },
      { value: "91", label: "ימי מחלה", helper: "דיווח רקע לרבעון" },
    ],
    recommendations: [
      {
        title: "מיפוי עומסים דו שבועי",
        body: "לזהות צווארי בקבוק ולוותר זמנית על משימות שאינן קריטיות.",
      },
    ],
  },
  {
    id: "management-support",
    label: "עוגן",
    conceptLabel: "עורף מקצועי",
    subtitle: "תמיכה מהנהלה",
    score: 69,
    status: "yellow",
    mapPosition: { top: "15%", right: "57%", size: "8.8rem", rotate: -11 },
    conceptPosition: {
      top: "14%",
      right: "57%",
      width: "23rem",
      height: "9.5rem",
      rotate: 4,
      radius: "39% 61% 41% 59% / 48% 36% 64% 52%",
    },
    conceptColor: "#b93ee6",
    conceptStatusText: "המצב סביר",
    conceptStatusDirection: "down",
    summary: [
      "חברי הצוות מביעים הערכה רבה לזמינות הפיזית והנכונות של צוות הניהול להקשיב, ומרגישים שיש להם אוזן קשבת עקרונית בבית הספר. עם זאת, קיים פער בין התפיסה הכללית של תמיכה לבין קבלת ליווי וסיוע אפקטיביים ברגעי משבר או מול אתגרים יומיומיים.",
      "חלק מהמורים מתארים קושי לפנות להנהלה בנושאים אישיים או סביב תחושת חולשה מקצועית, מחשש שהדבר ייתפס כחוסר מקצועיות או יפגע במעמדם. בנוסף, עולה צורך בהנחיות ברורות יותר וגיבוי ניהולי חד-משמעי באירועים מורכבים מול תלמידים והורים.",
      "כדי לחזק את תפקיד ההנהלה כעוגן תומך, מומלץ למסד ערוצי שיח פתוחים ויוזמים, כמו מפגשי משוב מעצים תקופתיים, וקביעת שגרת 'דלת פתוחה' לא רשמית. גיבוי מפורש של ההנהלה בהחלטות מפתח יקנה לצוות את הביטחון הנדרש לפעול.",
    ],
    metrics: [
      {
        value: "69",
        label: "ציון ממד",
        helper: "בטווח צהוב יציב",
        highlightText: "מדווחים על זמינות הנהלה, אך רוצים גב ותיווך מהירים יותר.",
      },
      {
        value: "31%",
        label: "צריכים יותר משוב",
        helper: "בחרו צהוב או אדום",
        highlightText: "מרגישים צורך במענה שוטף, משוב והרגעה סביב קבלת החלטות.",
      },
      { value: "2", label: "מוקדי שיחה", helper: "משוב ותמיכה רגשית" },
    ],
    recommendations: [
      {
        title: "חלונות נגישות קבועים",
        body: "לקבוע שעות קצרות וקבועות שבהן ניתן לפנות להנהלה בלי תיאום מוקדם.",
      },
    ],
  },
  {
    id: "certainty",
    label: "ודאות",
    conceptLabel: "ודאות",
    subtitle: "ודאות בסביבת עבודה",
    score: 58,
    status: "yellow",
    mapPosition: { top: "38%", right: "52%", size: "8.4rem", rotate: 8 },
    conceptPosition: {
      top: "35.5%",
      right: "46%",
      width: "15rem",
      height: "11rem",
      rotate: -3,
      radius: "45% 55% 42% 58% / 36% 46% 54% 64%",
    },
    conceptColor: "#e43e5d",
    conceptStatusText: "המצב סביר",
    conceptStatusDirection: "down",
    summary: [
      "רמת הוודאות והיציבות בסביבת העבודה נתפסת כבינונית ומעוררת דאגה מסוימת בקרב הצוות. מורים רבים מדווחים כי שינויים תכופים במערכת השעות, ביטולי שיעורים ברגע האחרון והנחיות סותרות לגבי פרויקטים פוגעים ביכולת התכנון שלהם.",
      "היעדר ודאות זה מייצר תחושת חוסר אונים וחוסר שליטה, המגבירים את רמות המתח השבועיות. הצוות מציין כי לרוב המידע על אירועים מיוחדים או שינויי לו\"ז מגיע באיחור, מה שמקשה על ההיערכות הפדגוגית ומצריך שינויים מאולתרים בכיתות.",
      "לשיפור מדד זה, מומלץ לייצר שקיפות גדולה יותר במידע הארגוני. הפצת לוח תכנון שבועי נעול בכל יום חמישי בצהריים, הגדרת נוהל ברור לשינויי מערכת דחופים, ופרסום מוקדם ככל הניתן של אירועים מיוחדים יסייעו להחזיר את תחושת השליטה והביטחון.",
    ],
    metrics: [
      {
        value: "58",
        label: "ציון ממד",
        helper: "דורש תשומת לב",
        highlightText: "קיימים שינויים לא צפויים שמחלישים תחושת יציבות ושליטה.",
      },
      {
        value: "46%",
        label: "בהירות גבוהה",
        helper: "סימנו ירוק",
        highlightText: "דיווחו כי הציפיות והמשימות שלהם ברורות לאורך השבוע.",
      },
      { value: "28%", label: "חוסר ודאות", helper: "סימנו אדום או צהוב נמוך" },
    ],
    recommendations: [
      {
        title: "שבוע עבודה ברור",
        body: "לשלוח בכל יום חמישי תמונת שבוע קצרה עם שינויים צפויים.",
      },
    ],
  },
  {
    id: "organizational-climate",
    label: "עורף מקצועי",
    conceptLabel: "אקלים ארגוני",
    subtitle: "קידום רווחה נפשית כחלק מתרבות הארגון",
    score: 71,
    status: "green",
    mapPosition: { top: "57%", right: "42%", size: "8rem", rotate: -5 },
    conceptPosition: {
      top: "70.5%",
      right: "26.5%",
      width: "25rem",
      height: "11rem",
      rotate: 0,
      radius: "42% 58% 38% 62% / 49% 39% 61% 51%",
    },
    conceptColor: "#34398d",
    conceptStatusText: "המצב מעולה וחשוב לשמר אותו",
    conceptStatusDirection: "up",
    summary: [
      "האקלים הארגוני בבית הספר תומך באופן יחסי ברווחה האישית של המורים, וניכר כי קיים רצון אמיתי לשמור על יחסים חמים ותרבות מכבדת. השיח על קשיים רגשיים או שחיקה מתאפשר בעיקר בתוך צוותי המקצוע או צוותי השכבות המצומצמים המהווים סביבה בטוחה.",
      "עם זאת, האקלים עדיין חסר מנגנונים מערכתיים קבועים מטעם הנהלת בית הספר המקדמים רווחה נפשית כחלק מתרבות העבודה המובנית. נושאי שלומות מועלים לרוב באופן מקרי או כמענה למשבר נקודתי, ולא כחלק מהתפיסה השוטפת של ניהול המשאב האנושי.",
      "על מנת לבסס אקלים תומך יציב, מומלץ לשלב סדנאות חוסן רגשי מונחות בתוכנית הפיתוח המקצועי השנתית, ליצור שגרות למידה של התמודדות עם מתחים, ולעודד מנהיגות מקדמת שלומות (Wellbeing) בקרב כלל בעלי התפקידים בבית הספר.",
    ],
    metrics: [
      {
        value: "71",
        label: "ציון ממד",
        helper: "בטווח הירוק",
        highlightText: "יש שפה ארגונית שמאפשרת לדבר על רווחה רגשית באופן ענייני.",
      },
      {
        value: "68%",
        label: "שיח פתוח",
        helper: "בחרו ירוק בשאלת האקלים",
        highlightText: "בחרו ירוק על היכולת לדבר בפתיחות על קושי רגשי.",
      },
      { value: "11%", label: "חסם רגשי", helper: "בחרו אדום" },
    ],
    recommendations: [
      {
        title: "שפה ארגונית אחידה",
        body: "להגדיר יחד איך מדברים על עומס רגשי ואילו ערוצי סיוע זמינים.",
      },
    ],
  },
  {
    id: "meaning",
    label: "משמעות",
    conceptLabel: "משמעות",
    subtitle: "תחושת ערך ומשמעות בעבודה",
    score: 88,
    status: "green",
    mapPosition: { top: "32%", right: "75%", size: "8.8rem", rotate: 5 },
    conceptPosition: {
      top: "55%",
      right: "4%",
      width: "19rem",
      height: "10.5rem",
      rotate: 0,
      radius: "44% 56% 40% 60% / 44% 34% 66% 56%",
    },
    conceptColor: "#18a6d0",
    conceptStatusText: "המצב סביר",
    conceptStatusDirection: "down",
    summary: [
      "תחושת הערך והמשמעות המקצועית עולה כחוזקה הגבוהה והבולטת ביותר באבחון הנוכחי. אנשי הצוות חשים חיבור עמוק לשליחות המקצועית שלהם, ורואים ערך רב בעבודה היומיומית שלהם עם התלמידים ובתרומה לעתידם.",
      "רובם המוחלט של המורים מדווחים כי העשייה החינוכית מעניקה להם סיפוק אישי ותחושת מטרה ברורה, המסייעת להם להתגבר על אתגרים קשים ושחיקה שוטפת. זהו המנוע הפנימי החזק ביותר שמחזיק את אנשי הצוות במערכת.",
      "שימור החוזקה הזו דורש הזנה מתמדת. מומלץ לתעד ולשתף סיפורי הצלחה והשפעה חיובית של מורים על תלמידים במסגרת פלטפורמות בית-ספריות, ולהקצות זמן קבוע בישיבות להבלטת רגעי משמעות קטנים שעברו על אנשי הצוות במהלך השבוע.",
    ],
    metrics: [
      {
        value: "88",
        label: "ציון ממד",
        helper: "הגבוה בסבב האבחון הנוכחי",
        highlightText: "המשמעות היא החוזקה הבולטת ביותר בסבב האבחון הנוכחי.",
      },
      {
        value: "91%",
        label: "ערך אישי",
        helper: "בחרו ירוק בשאלת המשמעות",
        highlightText: "מרגישים שהעבודה שלהם משמעותית ובעלת השפעה אישית.",
      },
      { value: "3%", label: "סיכון", helper: "בחרו אדום" },
    ],
    recommendations: [
      {
        title: "להבליט סיפורי השפעה",
        body: "לפתוח ישיבות בסיפור קצר שמחבר בין מאמץ הצוות לתוצאה אצל תלמידים.",
      },
    ],
  },
];

export const statusLabels: Record<WellbeingStatus, string> = {
  green: "המצב מעולה וחשוב לשמר אותו",
  yellow: "המצב סביר ודורש תשומת לב",
  red: "דרוש טיפול דחוף",
};

export function getDimensionById(id: string) {
  return wellbeingDimensions.find((dimension) => dimension.id === id);
}

export function getDimensionStaticParams() {
  return wellbeingDimensions.map((dimension) => ({
    dimension: dimension.id,
  }));
}

export function getStatusCount(status: WellbeingStatus) {
  return wellbeingDimensions.filter((dimension) => dimension.status === status).length;
}
