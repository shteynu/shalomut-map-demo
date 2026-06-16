"use client";

import Link from "next/link";
import { Check, ChevronLeft, ShieldCheck } from "lucide-react";
import { useMemo, useState } from "react";
import { responseOptions, surveyQuestions } from "@/lib/demo-data";

type AnswerValue = (typeof responseOptions)[number]["value"];

export function SurveyFlow() {
  const [answers, setAnswers] = useState<Record<string, AnswerValue>>({});
  const [submitted, setSubmitted] = useState(false);

  const answeredCount = Object.keys(answers).length;
  const progress = Math.round((answeredCount / surveyQuestions.length) * 100);
  const canSubmit = answeredCount === surveyQuestions.length;
  const groupedQuestions = useMemo(() => surveyQuestions, []);

  if (submitted) {
    return (
      <section className="survey-complete">
        <ShieldCheck size={42} aria-hidden="true" />
        <h1>תודה, התשובות נקלטו</h1>
        <p>התשובות נשמרות בדמו בצורה מצרפית בלבד. אין במסך ניהול מקום שבו ניתן לראות מי ענה.</p>
        <Link className="primary-button" href="/round">
          חזרה לסטטוס הסבב
          <ChevronLeft size={18} aria-hidden="true" />
        </Link>
      </section>
    );
  }

  return (
    <section className="survey-shell">
      <div className="survey-header">
        <p className="eyebrow">שאלון אנונימי לצוות</p>
        <h1>מפת השלומות</h1>
        <p>
          בחרו את הצבע שמתאר בצורה הטובה ביותר את המצב הנוכחי שלכם. אין צורך בשם, מייל או סיסמה.
        </p>
        <div className="progress-bar" aria-label={`התקדמות ${progress} אחוז`}>
          <span style={{ width: `${progress}%` }} />
        </div>
        <small>
          {answeredCount} מתוך {surveyQuestions.length} שאלות
        </small>
      </div>

      <div className="legend-row" aria-label="מקרא צבעים">
        {responseOptions.map((option) => (
          <article key={option.value} className={`legend-card option-${option.value}`}>
            <strong>{option.title}</strong>
            <span>{option.text}</span>
          </article>
        ))}
      </div>

      <div className="question-list">
        {groupedQuestions.map((question, index) => (
          <article className="question-card" key={question.id}>
            <span className="question-index">{index + 1}</span>
            <h2>{question.text}</h2>
            <div className="answer-grid">
              {responseOptions.map((option) => {
                const selected = answers[question.id] === option.value;
                return (
                  <button
                    key={option.value}
                    className={`answer-button option-${option.value}`}
                    type="button"
                    aria-pressed={selected}
                    onClick={() =>
                      setAnswers((current) => ({
                        ...current,
                        [question.id]: option.value,
                      }))
                    }
                  >
                    <span>{option.title}</span>
                    {selected ? <Check size={18} aria-hidden="true" /> : null}
                  </button>
                );
              })}
            </div>
          </article>
        ))}
      </div>

      <div className="sticky-submit">
        <button className="primary-button" type="button" disabled={!canSubmit} onClick={() => setSubmitted(true)}>
          שליחת שאלון
          <ChevronLeft size={18} aria-hidden="true" />
        </button>
      </div>
    </section>
  );
}
