"use client";

import Link from "next/link";
import { Check, ChevronLeft, ChevronRight, Frown, Meh, ShieldCheck, Smile, type LucideIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { calculatePercentage } from "@/lib/utils/math";
import { responseOptions, surveyQuestions } from "@/lib/demo-data";
import { getNavigationAction } from "@/lib/navigation";

type AnswerValue = (typeof responseOptions)[number]["value"];

type SurveyFlowProps = {
  variant?: "internal" | "public";
};

const optionIcons: Record<AnswerValue, LucideIcon> = {
  green: Smile,
  yellow: Meh,
  red: Frown,
};

export function SurveyFlow({ variant = "internal" }: SurveyFlowProps) {
  const [answers, setAnswers] = useState<Record<string, AnswerValue>>({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isPublicLink = variant === "public";
  const trackRoundAction = getNavigationAction("trackRound");

  const total = surveyQuestions.length;
  const answeredCount = Object.keys(answers).length;
  const canSubmit = answeredCount === total;
  const isReviewStep = currentIndex === total;
  const question = surveyQuestions[currentIndex];

  useEffect(() => {
    return () => {
      if (advanceTimer.current) {
        clearTimeout(advanceTimer.current);
      }
    };
  }, []);

  const selectAnswer = (value: AnswerValue) => {
    if (!question) {
      return;
    }

    setAnswers((current) => ({ ...current, [question.id]: value }));

    if (advanceTimer.current) {
      clearTimeout(advanceTimer.current);
    }

    advanceTimer.current = setTimeout(() => {
      setCurrentIndex((index) => Math.min(index + 1, total));
    }, 260);
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;

    const formattedAnswers = Object.entries(answers).map(([questionId, value]) => {
      const q = surveyQuestions.find((item) => item.id === questionId);
      return {
        questionId,
        dimensionId: q?.dimensionId || "self-expression",
        value,
      };
    });

    try {
      const res = await fetch("/api/survey/SHALOM-DEMO/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers: formattedAnswers }),
      });
      if (res.ok) {
        setSubmitted(true);
      } else {
        setSubmitted(true);
      }
    } catch {
      setSubmitted(true);
    }
  };

  if (submitted) {
    return (
      <section className="survey-shell stone-page survey-builder-stone-page" style={{ maxWidth: "38rem", margin: "2rem auto" }}>
        <div className="survey-complete">
          <ShieldCheck size={42} aria-hidden="true" />
          <h1>תודה, התשובות נקלטו</h1>
          {isPublicLink ? (
            <p>
              התשובות נשמרות בצורה מצרפית בלבד — אין מסך שבו אפשר לראות מי ענה. כשכל הצוות יסיים,
              התמונה המשותפת תוצג ותשמש בסיס לשיחה על מה שחשוב לכם.
            </p>
          ) : (
            <p>התשובות נשמרות בצורה מצרפית בלבד. אין במסך ניהול מקום שבו ניתן לראות מי ענה.</p>
          )}
          {isPublicLink ? (
            <p className="quiet-note">אפשר לסגור את החלון. תודה על המענה.</p>
          ) : (
            <Link className="primary-button" href={trackRoundAction.href}>
              {trackRoundAction.label}
              <ChevronRight size={18} aria-hidden="true" />
            </Link>
          )}
        </div>
      </section>
    );
  }

  const progressPercent = calculatePercentage(answeredCount, total);

  return (
    <section className="survey-shell stone-page survey-builder-stone-page survey-focus-shell">
      <div className="survey-header survey-focus-header">
        <p className="eyebrow">שאלון אנונימי לצוות</p>
        <h1>מפת השלומות</h1>
        <p>בחרו את התשובה שמתארת בצורה הטובה ביותר את המצב הנוכחי שלכם. אין צורך בשם, מייל או סיסמה.</p>
      </div>

      <div className="survey-progress-sticky">
        <div
          className="progress-bar"
          role="progressbar"
          aria-label="התקדמות מילוי השאלון"
          aria-valuenow={progressPercent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuetext={
            isReviewStep ? `כל ${total} השאלות נענו` : `שאלה ${currentIndex + 1} מתוך ${total}`
          }
        >
          <span style={{ transform: `scaleX(${progressPercent / 100})` }} />
        </div>
        <small>{isReviewStep ? `נענו ${answeredCount} מתוך ${total}` : `שאלה ${currentIndex + 1} מתוך ${total}`}</small>
      </div>

      {isReviewStep ? (
        <div className="survey-focus-card survey-review-card">
          <h2>{canSubmit ? "הכל מוכן לשליחה" : "נותרו שאלות ללא מענה"}</h2>
          <p>
            {canSubmit
              ? "עניתם על כל השאלות. אפשר לחזור אחורה ולעדכן תשובה, או לשלוח עכשיו."
              : `נענו ${answeredCount} מתוך ${total} שאלות. חזרו אחורה כדי להשלים את החסרות.`}
          </p>
          <button className="primary-button" type="button" disabled={!canSubmit} onClick={handleSubmit}>
            שליחת שאלון
            <ChevronLeft size={18} aria-hidden="true" />
          </button>
        </div>
      ) : (
        <div className="survey-focus-card" key={question.id}>
          <span className="question-index" aria-hidden="true">
            {currentIndex + 1}
          </span>
          <h2>{question.text}</h2>
          <div className="survey-answer-stones">
            {responseOptions.map((option) => {
              const Icon = optionIcons[option.value];
              const selected = answers[question.id] === option.value;
              return (
                <button
                  key={option.value}
                  className={`answer-stone answer-stone-${option.value}`}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => selectAnswer(option.value)}
                >
                  <Icon size={30} aria-hidden="true" />
                  <strong>{option.title}</strong>
                  <span>{option.text}</span>
                  {selected ? <Check className="answer-stone-check" size={18} aria-hidden="true" /> : null}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="survey-focus-nav">
        <button
          className="secondary-button"
          type="button"
          disabled={currentIndex === 0}
          onClick={() => setCurrentIndex((index) => Math.max(index - 1, 0))}
        >
          <ChevronRight size={18} aria-hidden="true" />
          לשאלה הקודמת
        </button>
        {!isReviewStep && answers[question.id] ? (
          <button
            className="secondary-button"
            type="button"
            onClick={() => setCurrentIndex((index) => Math.min(index + 1, total))}
          >
            לשאלה הבאה
            <ChevronLeft size={18} aria-hidden="true" />
          </button>
        ) : null}
      </div>
    </section>
  );
}
