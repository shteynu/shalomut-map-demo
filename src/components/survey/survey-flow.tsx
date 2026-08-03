"use client";

import Link from "next/link";
import { AlertTriangle, Check, ChevronLeft, ChevronRight, Frown, Loader2, Meh, RefreshCw, RotateCcw, ShieldCheck, Smile, type LucideIcon } from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { calculatePercentage } from "@/lib/utils/math";
import { getNavigationAction } from "@/lib/navigation";
import { responseScale } from "@/lib/shalomut-source";
import {
  createAttemptTokenSource,
  hashAnonymousToken,
  type SurveyAttemptTokenSource,
} from "@/lib/survey-attempt-token";
import {
  clearSurveyDraft,
  createSurveyDraft,
  createSurveyDraftStore,
  getSurveyDraftStorage,
  questionnaireFingerprint,
  surveyDraftStorageKey,
  writeSurveyDraft,
} from "@/lib/survey-draft-storage";
import { resolveSubmissionOutcome } from "@/lib/survey-submission-outcome";
import type { SurveyDefinitionQuestion } from "@/lib/types/backend";

type AnswerValue = (typeof responseScale)[number]["value"];

/**
 * Long enough that answering quickly does not write on every keystroke-like
 * tap, short enough to be invisible. It is not the last line of defence: the
 * flush on `pagehide` is, because an answer given moments before a refresh
 * would otherwise be the one thing autosave failed to save.
 */
const SAVE_DEBOUNCE_MS = 400;

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
  const [seeded, setSeeded] = useState(false);
  const [restoredDraft, setRestoredDraft] = useState(false);
  const [writeRefused, setWriteRefused] = useState(false);
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Held as state, not a ref: it is read inside effects and callbacks, and a
  // lazy initializer gives one stable source for the whole attempt without
  // touching a ref during render.
  const [attemptToken] = useState<SurveyAttemptTokenSource>(
    createAttemptTokenSource,
  );
  const isPublicLink = variant === "public";
  const trackRoundAction = getNavigationAction("trackRound");

  const surveyQuestions = questions;
  const total = surveyQuestions.length;
  const answeredCount = Object.keys(answers).length;
  const canSubmit = answeredCount === total;
  const isReviewStep = currentIndex === total;
  const question = surveyQuestions[currentIndex];

  // Until the consent step lands this is the moment the attempt began. The two
  // coincide once answering can only start after an explicit accept.
  const [attemptStartedAt, setAttemptStartedAt] = useState(() =>
    new Date().toISOString(),
  );

  const storageKey = useMemo(
    () => surveyDraftStorageKey(shareCode),
    [shareCode],
  );

  const draftExpectation = useMemo(
    () => ({
      shareCode,
      questionnaireFingerprint: questionnaireFingerprint(surveyQuestions),
      questionIds: new Set(surveyQuestions.map((item) => item.id)),
      questionCount: surveyQuestions.length,
    }),
    [shareCode, surveyQuestions],
  );

  const draftStore = useMemo(
    () => createSurveyDraftStore(storageKey, draftExpectation),
    [draftExpectation, storageKey],
  );

  const stored = useSyncExternalStore(
    draftStore.subscribe,
    draftStore.getSnapshot,
    draftStore.getServerSnapshot,
  );

  useEffect(() => {
    return () => {
      if (advanceTimer.current) {
        clearTimeout(advanceTimer.current);
      }
    };
  }, []);

  /**
   * Seeds the attempt from whatever this tab had stored.
   *
   * A render-phase update rather than an effect, which is what React prescribes
   * for adjusting state to a changed input: the component re-renders with the
   * restored answers before anything is committed, so the save effect below
   * never observes the empty initial state and never writes it over the draft.
   * `stored.checked` is false on the server and during hydration, so this runs
   * exactly once, on the client, after the two passes agree.
   */
  if (!seeded && stored.checked) {
    setSeeded(true);

    if (stored.draft) {
      setAnswers(stored.draft.answers);
      setCurrentIndex(stored.draft.currentIndex);
      setAttemptStartedAt(stored.draft.consentAcceptedAt);
      setRestoredDraft(true);
    }
  }

  /**
   * Brings the attempt token back with the answers.
   *
   * Without it a refresh after a lost `200` would submit under a fresh token,
   * and the round would record the same person twice. This is the one thing
   * that cannot be seeded during render: the token source is an external object
   * rather than React state, so telling it about the restored attempt belongs
   * in an effect.
   */
  useEffect(() => {
    if (stored.draft) attemptToken.restore(stored.draft.attemptToken);
  }, [attemptToken, stored.draft]);

  const persistDraft = useCallback(() => {
    const storage = getSurveyDraftStorage();
    if (!storage) return;

    const result = writeSurveyDraft(
      storage,
      storageKey,
      createSurveyDraft({
        shareCode,
        questionnaireFingerprint: draftExpectation.questionnaireFingerprint,
        attemptToken: attemptToken.current(),
        answers,
        currentIndex,
        consentAcceptedAt: attemptStartedAt,
      }),
    );

    setWriteRefused(!result.ok);
  }, [
    answers,
    attemptStartedAt,
    attemptToken,
    currentIndex,
    draftExpectation.questionnaireFingerprint,
    shareCode,
    storageKey,
  ]);

  // Either the browser refused storage outright, or it accepted it and then
  // refused a write. The respondent needs the same warning for both.
  const draftUnavailable =
    (stored.checked && !stored.storageAvailable) || writeRefused;

  const dropDraft = useCallback(() => {
    const storage = getSurveyDraftStorage();
    if (storage) clearSurveyDraft(storage, storageKey);
  }, [storageKey]);

  useEffect(() => {
    if (!seeded || submitted) return;

    const timer = setTimeout(persistDraft, SAVE_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [persistDraft, seeded, submitted]);

  /**
   * Writes immediately when the page is going away.
   *
   * `selectAnswer` advances after 260 ms, so a respondent can answer and reload
   * well inside the debounce window. Without this the feature would lose the
   * most recent answer — exactly the one the respondent expects to find on the
   * way back. `pagehide` covers reload, navigation and mobile app switching;
   * `visibilitychange` covers the backgrounding that never fires `pagehide`.
   */
  useEffect(() => {
    if (!seeded || submitted) return;

    const flush = () => {
      if (document.visibilityState === "hidden") persistDraft();
    };
    const flushNow = () => persistDraft();

    window.addEventListener("pagehide", flushNow);
    document.addEventListener("visibilitychange", flush);

    return () => {
      window.removeEventListener("pagehide", flushNow);
      document.removeEventListener("visibilitychange", flush);
    };
  }, [persistDraft, seeded, submitted]);

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
      const anonymousTokenHash = await hashAnonymousToken(
        attemptToken.current(),
      );
      const res = await fetch(`/api/survey/${encodeURIComponent(shareCode)}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers: formattedAnswers, anonymousTokenHash }),
      });
      const payload = res.ok
        ? null
        : ((await res.json().catch(() => null)) as { code?: unknown } | null);
      const outcome = resolveSubmissionOutcome({
        ok: res.ok,
        code: payload?.code,
      });

      if (outcome.kind === "complete") {
        // Either the round stored this attempt just now, or it stored it before
        // the connection dropped and the retry carried the same token. Both mean
        // the answers are safe, and the draft has nothing left to protect.
        dropDraft();
        setSubmitted(true);
        return;
      }

      setSubmitError(outcome.message);
      setSubmitting(false);
    } catch {
      setSubmitError("לא ניתן להתחבר לשרת. בדקו את החיבור ונסו שוב.");
      setSubmitting(false);
    }
  };

  /** Starts a separate anonymous attempt on the same device, with its own token. */
  const startAnotherResponse = () => {
    // The next person at this computer must inherit nothing: not the token,
    // which would make the round refuse their answers as a duplicate, and not
    // the draft, which would show them what the previous person answered.
    dropDraft();
    attemptToken.reset();
    setAttemptStartedAt(new Date().toISOString());
    setAnswers({});
    setCurrentIndex(0);
    setSubmitError(null);
    setSubmitting(false);
    setSubmitted(false);
    setRestoredDraft(false);
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
            <>
              <p className="quiet-note">אפשר לסגור את החלון. תודה על המענה.</p>
              <button
                className="secondary-button"
                type="button"
                onClick={startAnotherResponse}
              >
                <RefreshCw size={18} aria-hidden="true" />
                מילוי שאלון נוסף
              </button>
              <p className="quiet-note">
                מיועד למחשב משותף: כל מילוי נשמר כתשובה אנונימית נפרדת.
              </p>
            </>
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

      {restoredDraft ? (
        <p className="survey-draft-note" role="status">
          <RotateCcw size={18} aria-hidden="true" />
          ההתקדמות מהטעינה הקודמת שוחזרה. אפשר להמשיך מאותה נקודה.
        </p>
      ) : null}

      {draftUnavailable ? (
        <p className="survey-draft-note survey-draft-note-warning" role="status">
          <AlertTriangle size={18} aria-hidden="true" />
          לא ניתן לשמור התקדמות בדפדפן הזה. אפשר להמשיך לענות, אך רענון הדף יאפס
          את המענה.
        </p>
      ) : null}

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
