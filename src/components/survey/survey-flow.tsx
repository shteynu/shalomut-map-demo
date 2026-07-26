"use client";

import Link from "next/link";
import { Check, ChevronLeft, ChevronRight, Frown, Loader2, Meh, ShieldCheck, Smile, type LucideIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { calculatePercentage } from "@/lib/utils/math";
import { getNavigationAction } from "@/lib/navigation";
import { responseScale } from "@/lib/shalomut-source";
import type { SurveyDefinitionQuestion } from "@/lib/types/backend";

type AnswerValue = (typeof responseScale)[number]["value"];

type SurveyFlowProps = {
  variant?: "internal" | "public";
  shareCode: string;
  surveyTitle: string;
  introText: string;
  anonymityText: string;
  questions: SurveyDefinitionQuestion[];
};

const optionIcons: Record<AnswerValue, LucideIcon> = {
  green: Smile,
  yellow: Meh,
  red: Frown,
};

async function getAnonymousTokenHash(shareCode: string) {
  const storageKey = `shalomut-anonymous-token:${shareCode}`;
  let token = window.localStorage.getItem(storageKey);

  if (!token) {
    token = crypto.randomUUID();
    window.localStorage.setItem(storageKey, token);
  }

  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(token),
  );

  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export function SurveyFlow({
  variant = "internal",
  shareCode,
  surveyTitle,
  introText,
  anonymityText,
  questions,
}: SurveyFlowProps) {
  const [answers, setAnswers] = useState<Record<string, AnswerValue>>({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isPublicLink = variant === "public";
  const trackRoundAction = getNavigationAction("trackRound");

  const surveyQuestions = questions;
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
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    setSubmitError(null);

    const formattedAnswers = Object.entries(answers).map(([questionId, value]) => {
      const q = surveyQuestions.find((item) => item.id === questionId);
      return {
        questionId,
        dimensionId: q?.dimensionId || "self-expression",
        value,
      };
    });

    try {
      const anonymousTokenHash = await getAnonymousTokenHash(shareCode);
      const res = await fetch(`/api/survey/${encodeURIComponent(shareCode)}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers: formattedAnswers, anonymousTokenHash }),
      });
      if (res.ok) {
        setSubmitted(true);
      } else {
        const payload = (await res.json().catch(() => null)) as
          | { error?: string }
          | null;
        setSubmitError(payload?.error ?? "לא ניתן היה לשמור את התשובות. נסו שוב.");
        setSubmitting(false);
      }
    } catch {
      setSubmitError("לא ניתן להתחבר לשרת. בדקו את החיבור ונסו שוב.");
      setSubmitting(false);
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
              {anonymityText}
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
        <h1>{surveyTitle}</h1>
        <p>{introText}</p>
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
          <button className="primary-button" type="button" disabled={!canSubmit || submitting} onClick={handleSubmit}>
            {submitting ? (
              <>
                <Loader2 size={18} className="animate-spin" aria-hidden="true" />
                שולח תשובות...
              </>
            ) : (
              <>
                שליחת שאלון
                <ChevronLeft size={18} aria-hidden="true" />
              </>
            )}
          </button>
        </div>
      ) : (
        <div className="survey-focus-card" key={question.id}>
          <span className="question-index" aria-hidden="true">
            {currentIndex + 1}
          </span>
          <h2>{question.text}</h2>
          <div className="survey-answer-stones">
            {responseScale.map((option) => {
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
      {submitError ? (
        <p className="survey-submit-error" role="alert">
          {submitError}
        </p>
      ) : null}
    </section>
  );
}
