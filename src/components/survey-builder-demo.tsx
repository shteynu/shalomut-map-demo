"use client";

import Link from "next/link";
import { CheckCircle2, Clipboard, ClipboardList, Clock3, Copy, Eye, GripVertical, Plus, Settings2, ShieldCheck } from "lucide-react";
import { useState, type CSSProperties } from "react";
import { PageIntro } from "@/components/app-shell";
import { activeRound, responseOptions, surveyQuestions, wellbeingDimensions } from "@/lib/demo-data";

type BuilderQuestion = {
  id: string;
  text: string;
  dimensionId: string;
  required: boolean;
  enabled: boolean;
  answerMode: string;
};

const questionBank = [
  {
    text: "אני יודעת למי לפנות כשאני זקוקה לעזרה מקצועית או רגשית במהלך יום העבודה.",
    dimensionId: "management-support",
    required: true,
    enabled: true,
    answerMode: "סקאלת צבעים",
  },
  {
    text: "יש לי זמן מספק להתכונן למשימות חדשות שמגיעות במהלך השבוע.",
    dimensionId: "certainty",
    required: false,
    enabled: true,
    answerMode: "סקאלת צבעים",
  },
  {
    text: "בישיבות צוות יש מקום אמיתי לשתף רעיונות גם אם הם שונים מהקיים.",
    dimensionId: "self-expression",
    required: true,
    enabled: true,
    answerMode: "סקאלת צבעים",
  },
];

const initialQuestions: BuilderQuestion[] = surveyQuestions.map((question) => ({
  ...question,
  enabled: true,
  answerMode: "סקאלת צבעים",
}));

function getDimensionLabel(dimensionId: string) {
  return wellbeingDimensions.find((dimension) => dimension.id === dimensionId)?.conceptLabel ?? dimensionId;
}

function getDimensionColor(dimensionId: string) {
  return wellbeingDimensions.find((dimension) => dimension.id === dimensionId)?.conceptColor ?? "#e49902";
}

function createDraftId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 7)}`;
}

export function SurveyBuilderDemo() {
  const [title, setTitle] = useState("שאלון שלומות צוות - סבב חורף");
  const [audience, setAudience] = useState("כלל צוות ההוראה");
  const [estimatedMinutes, setEstimatedMinutes] = useState(15);
  const [minimumResponses, setMinimumResponses] = useState(activeRound.minimumResponses);
  const [introText, setIntroText] = useState(
    "השאלון נשלח כקישור אנונימי לצוות. התוצאות מוצגות רק ברמה מצרפית אחרי הגעה לסף פרטיות.",
  );
  const [anonymityText, setAnonymityText] = useState(
    "לא נאספים שם, כתובת מייל או פרטים מזהים. רק מנהלת בית הספר רואה תמונת מצב מצרפית.",
  );
  const [questions, setQuestions] = useState<BuilderQuestion[]>(initialQuestions);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const [bankCursor, setBankCursor] = useState(0);

  const enabledQuestions = questions.filter((question) => question.enabled);
  const requiredQuestions = enabledQuestions.filter((question) => question.required);
  const activeDimensions = new Set(enabledQuestions.map((question) => question.dimensionId)).size;
  const nextSuggestedQuestion = questionBank[bankCursor % questionBank.length];
  const summaryStones = [
    {
      value: enabledQuestions.length,
      label: "שאלות פעילות",
      helper: `מתוכן ${requiredQuestions.length} שאלות חובה`,
      className: "stone-variant-navy",
    },
    {
      value: activeDimensions,
      label: "מרכיבי שלומות",
      helper: "פריסה על פני כל ממדי הדשבורד",
      className: "stone-variant-teal",
    },
    {
      value: estimatedMinutes,
      label: "דקות למילוי",
      helper: "הערכת זמן להצגת הקישור לצוות",
      className: "stone-variant-orange",
    },
    {
      value: minimumResponses,
      label: "סף פרטיות",
      helper: "תוצאות ייפתחו רק לאחר מינימום משיבים",
      className: "stone-variant-green",
    },
  ];

  function updateQuestion(id: string, updater: (question: BuilderQuestion) => BuilderQuestion) {
    setQuestions((current) => current.map((question) => (question.id === id ? updater(question) : question)));
  }

  function duplicateQuestion(id: string) {
    setQuestions((current) => {
      const index = current.findIndex((question) => question.id === id);
      const source = current[index];

      if (!source) {
        return current;
      }

      const duplicate = {
        ...source,
        id: createDraftId("duplicate"),
      };

      return [...current.slice(0, index + 1), duplicate, ...current.slice(index + 1)];
    });
  }

  function addQuestionFromBank() {
    const template = questionBank[bankCursor % questionBank.length];
    const nextQuestion: BuilderQuestion = {
      ...template,
      id: createDraftId("bank"),
    };

    setQuestions((current) => [...current, nextQuestion]);
    setBankCursor((current) => current + 1);
  }

  async function copyRespondentLink() {
    try {
      await navigator.clipboard.writeText(activeRound.shareUrl);
      setCopied(true);
    } catch {
      setCopied(true);
    }
  }

  return (
    <div className="page survey-builder-stone-page">
      <PageIntro
        eyebrow="בניית שאלון"
        title={title}
        description="מסך זה מדגים עריכת שאלון לפני הפצה: קהל יעד, ניסוח פתיח, שאלות פעילות וקישור המשיבים החיצוני."
        actions={
          <>
            <button
              className="primary-button"
              type="button"
              onClick={() => {
                setSaved(true);
              }}
            >
              שמירת טיוטה
              <CheckCircle2 size={18} aria-hidden="true" />
            </button>
            <Link className="secondary-button" href={activeRound.shareUrl} target="_blank" rel="noreferrer">
              פתיחת קישור המשיבים
              <Eye size={18} aria-hidden="true" />
            </Link>
          </>
        }
      />

      <section className="metric-grid survey-builder-metric-grid" aria-label="תקציר שאלון">
        {summaryStones.map((stone) => (
          <article key={stone.label} className={`metric-card survey-builder-metric-stone ${stone.className}`}>
            <strong>{stone.value}</strong>
            <span>{stone.label}</span>
            <small>{stone.helper}</small>
          </article>
        ))}
      </section>

      <div className="survey-builder-layout">
        <div className="survey-builder-main">
          <section className="survey-builder-panel survey-builder-settings-panel">
            <div className="survey-builder-heading">
              <div>
                <p className="eyebrow">הגדרות בסיס</p>
                <h2>תצורת שאלון לסבב</h2>
              </div>
              <span className="status-badge status-green">
                <Settings2 size={16} aria-hidden="true" />
                טיוטת מנהל
              </span>
            </div>

            <div className="builder-form-grid">
              <label>
                שם השאלון
                <input value={title} onChange={(event) => setTitle(event.target.value)} />
              </label>
              <label>
                קהל יעד
                <input value={audience} onChange={(event) => setAudience(event.target.value)} />
              </label>
              <label>
                זמן מילוי משוער
                <input
                  type="number"
                  value={estimatedMinutes}
                  onChange={(event) => setEstimatedMinutes(Number(event.target.value) || 0)}
                />
              </label>
              <label>
                סף מינימום להצגת תוצאות
                <input
                  type="number"
                  value={minimumResponses}
                  onChange={(event) => setMinimumResponses(Number(event.target.value) || 0)}
                />
              </label>
            </div>

            <label>
              טקסט פתיחה למשיבים
              <textarea rows={3} value={introText} onChange={(event) => setIntroText(event.target.value)} />
            </label>

            <label>
              הודעת אנונימיות
              <textarea rows={3} value={anonymityText} onChange={(event) => setAnonymityText(event.target.value)} />
            </label>
          </section>

          <section className="survey-builder-panel survey-builder-questions-panel">
            <div className="survey-builder-heading">
              <div>
                <p className="eyebrow">מבנה השאלון</p>
                <h2>שאלות לעריכה</h2>
              </div>
              <button className="secondary-button" type="button" onClick={addQuestionFromBank}>
                הוספת שאלה לדוגמה
                <Plus size={18} aria-hidden="true" />
              </button>
            </div>

            <div className="survey-builder-question-list">
              {questions.map((question, index) => (
                <article
                  key={question.id}
                  className={`survey-builder-question-card${question.enabled ? "" : " is-disabled"}`}
                  style={{ "--question-color": getDimensionColor(question.dimensionId) } as CSSProperties}
                >
                  <div className="survey-builder-question-row">
                    <span className="survey-builder-order">
                      <GripVertical size={16} aria-hidden="true" />
                      {index + 1}
                    </span>

                    <div className="survey-builder-question-copy">
                      <strong className="survey-builder-dimension-stone">{getDimensionLabel(question.dimensionId)}</strong>
                      <p>{question.text}</p>
                    </div>
                  </div>

                  <div className="survey-builder-tags">
                    <span className={`status-badge ${question.enabled ? "status-green" : "status-yellow"}`}>
                      <ClipboardList size={15} aria-hidden="true" />
                      {question.enabled ? "פעילה בסבב" : "מוסתרת מהמשיבים"}
                    </span>
                    <span className={`status-badge ${question.required ? "status-green" : "status-yellow"}`}>
                      <ShieldCheck size={15} aria-hidden="true" />
                      {question.required ? "שאלת חובה" : "שאלת רשות"}
                    </span>
                    <span className="status-badge status-yellow">
                      <Clock3 size={15} aria-hidden="true" />
                      {question.answerMode}
                    </span>
                  </div>

                  <div className="survey-builder-question-actions">
                    <button
                      className="ghost-button"
                      type="button"
                      onClick={() =>
                        updateQuestion(question.id, (current) => ({
                          ...current,
                          required: !current.required,
                        }))
                      }
                    >
                      {question.required ? "להפוך לרשות" : "להפוך לחובה"}
                    </button>
                    <button
                      className="ghost-button"
                      type="button"
                      onClick={() =>
                        updateQuestion(question.id, (current) => ({
                          ...current,
                          enabled: !current.enabled,
                        }))
                      }
                    >
                      {question.enabled ? "להסתיר מהסבב" : "להחזיר לסבב"}
                    </button>
                    <button className="ghost-button" type="button" onClick={() => duplicateQuestion(question.id)}>
                      שכפול שאלה
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </div>

        <aside className="survey-builder-side">
          <section className="survey-builder-panel survey-builder-share-panel">
            <div className="survey-builder-heading">
              <div>
                <p className="eyebrow">הפצה חיצונית</p>
                <h2>קישור משיבים</h2>
              </div>
              <span className="status-badge status-green">
                <ShieldCheck size={16} aria-hidden="true" />
                נפרד ממסכי הניהול
              </span>
            </div>

            <div className="copy-row">
              <input readOnly value={activeRound.shareUrl} aria-label="קישור משיבים חיצוני" />
              <button className="icon-button" type="button" onClick={copyRespondentLink} aria-label="העתקת קישור">
                <Clipboard size={18} aria-hidden="true" />
              </button>
            </div>

            {copied ? <p className="success-note">קישור המשיבים הועתק ומוכן לשליחה לצוות.</p> : null}

            <div className="round-actions">
              <Link className="secondary-button" href={activeRound.shareUrl} target="_blank" rel="noreferrer">
                תצוגת המשיב
                <Eye size={18} aria-hidden="true" />
              </Link>
              <button className="ghost-button" type="button" onClick={copyRespondentLink}>
                העתקת קישור
                <Copy size={18} aria-hidden="true" />
              </button>
            </div>
          </section>

          <section className="survey-builder-panel survey-builder-legend-panel">
            <div className="survey-builder-heading">
              <div>
                <p className="eyebrow">מקרא מענה</p>
                <h2>אפשרויות תשובה</h2>
              </div>
            </div>

            <div className="builder-response-list">
              {responseOptions.map((option) => (
                <article key={option.value} className={`legend-card option-${option.value}`}>
                  <strong>{option.title}</strong>
                  <span>{option.text}</span>
                </article>
              ))}
            </div>
          </section>

          <section className="survey-builder-panel survey-builder-library-panel">
            <div className="survey-builder-heading">
              <div>
                <p className="eyebrow">שאלה מומלצת הבאה</p>
                <h2>ספריית דמו</h2>
              </div>
            </div>

            <article
              className="survey-builder-suggestion"
              style={{ "--suggestion-color": getDimensionColor(nextSuggestedQuestion.dimensionId) } as CSSProperties}
            >
              <strong className="survey-builder-dimension-stone">
                {getDimensionLabel(nextSuggestedQuestion.dimensionId)}
              </strong>
              <p>{nextSuggestedQuestion.text}</p>
              <button className="secondary-button" type="button" onClick={addQuestionFromBank}>
                הוספת השאלה
                <Plus size={18} aria-hidden="true" />
              </button>
            </article>

            {saved ? <p className="success-note">טיוטת השאלון נשמרה בדמו וניתן להמשיך להפצה.</p> : null}
          </section>
        </aside>
      </div>
    </div>
  );
}
