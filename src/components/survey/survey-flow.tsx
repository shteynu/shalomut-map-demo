"use client";

import { AlertTriangle, ChevronLeft, ChevronRight, Loader2, RefreshCw, RotateCcw, ShieldCheck } from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { calculatePercentage } from "@/lib/utils/math";
import { isAnswerValueValid } from "@/lib/survey/answer-validity";
import { estimateMinutesForSteps } from "@/lib/survey/survey-duration";
import {
  buildSurveySteps,
  isStepComplete,
  questionIndexForStep,
  questionsInStep,
  submissionBlocker,
} from "@/lib/survey/survey-steps";
import { SurveyAnswerInput } from "./survey-answer-input";
import { SurveyConsentStep } from "./survey-consent-step";
import {
  createAttemptTokenSource,
  hashAnonymousToken,
  type SurveyAttemptTokenSource,
} from "@/lib/survey-attempt-token";
import { createSurveyAttemptBeacon } from "@/lib/survey-attempt-beacon";
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

/**
 * Long enough that answering quickly does not write on every keystroke-like
 * tap, short enough to be invisible. It is not the last line of defence: the
 * flush on `pagehide` is, because an answer given moments before a refresh
 * would otherwise be the one thing autosave failed to save.
 */
const SAVE_DEBOUNCE_MS = 400;

/**
 * Where the attempt is.
 *
 * `review` and `submitting` are deliberately absent: they are already derivable
 * from `currentIndex === total` and from the in-flight request, and duplicating
 * them here would create a second source of truth that can disagree with the
 * first.
 */
type SurveyPhase = "consent" | "questions" | "complete" | "declined";

type SurveyFlowProps = {
  shareCode: string;
  surveyTitle: string;
  introText: string;
  anonymityText: string;
  questions: SurveyDefinitionQuestion[];
};

export function SurveyFlow({
  shareCode,
  surveyTitle,
  introText,
  anonymityText,
  questions,
}: SurveyFlowProps) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [phase, setPhase] = useState<SurveyPhase>("consent");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [seeded, setSeeded] = useState(false);
  const [restoredDraft, setRestoredDraft] = useState(false);
  const [writeRefused, setWriteRefused] = useState(false);
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Set only when the respondent themselves accepted, so a restored attempt
  // does not pull focus out from under someone mid-page-load.
  const focusOnEnter = useRef(false);
  const questionHeading = useRef<HTMLHeadingElement | null>(null);
  // Held as state, not a ref: it is read inside effects and callbacks, and a
  // lazy initializer gives one stable source for the whole attempt without
  // touching a ref during render.
  const [attemptToken] = useState<SurveyAttemptTokenSource>(
    createAttemptTokenSource,
  );
  const surveyQuestions = questions;
  /*
   * The screen walks steps and the questionnaire stores questions. They used to
   * be the same thing; an allocation grid is thirteen questions answered on one
   * screen, so they are not any more. `survey-steps.ts` owns the difference,
   * and everything here that used to count questions counts steps instead —
   * except what the funnel is told, which is still a question index.
   */
  const steps = useMemo(() => buildSurveySteps(surveyQuestions), [surveyQuestions]);
  const total = steps.length;
  /*
   * Computed here rather than read from the stored definition, because the
   * consent screen prints both numbers in one sentence — "N שאלות, כ־M דקות" —
   * and a definition whose questions were trimmed after the estimate was
   * written makes that sentence disagree with itself. The questions in hand are
   * the ones this respondent will be asked.
   */
  const estimatedMinutes = estimateMinutesForSteps(steps);
  /*
   * Progress counts steps the respondent is done with rather than answers
   * given, because a background question they chose to skip is a step behind
   * them. Counting answers would leave the bar short of full on a questionnaire
   * that is ready to send, which reads as work still to do.
   */
  const completedSteps = steps.filter((step) =>
    isStepComplete(step, answers),
  ).length;
  const blocker = submissionBlocker(steps, answers);
  const canSubmit = blocker === undefined;
  const isReviewStep = currentIndex === total;
  const step = steps[currentIndex];

  // The moment consent was given. Empty until it is, which is safe because a
  // draft is only ever written from the `questions` phase.
  const [consentAcceptedAt, setConsentAcceptedAt] = useState("");

  const storageKey = useMemo(
    () => surveyDraftStorageKey(shareCode),
    [shareCode],
  );

  const draftExpectation = useMemo(() => {
    const byId = new Map(surveyQuestions.map((item) => [item.id, item]));

    return {
      shareCode,
      questionnaireFingerprint: questionnaireFingerprint(surveyQuestions),
      questionIds: new Set(byId.keys()),
      // The cursor is a step index now, so the clamp has to be told about
      // steps. Naming it `questionCount` would have kept the draft compiling
      // while restoring a respondent past the end of a questionnaire whose
      // grid collapsed thirteen questions into one screen.
      questionCount: buildSurveySteps(surveyQuestions).length,
      isAnswerValid: (questionId: string, value: string) => {
        const question = byId.get(questionId);
        return question ? isAnswerValueValid(question, value) : false;
      },
    };
  }, [shareCode, surveyQuestions]);

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
   *
   * A draft only exists because someone accepted the terms to create it, so
   * restoring one restores the consent with it. Asking the same person to agree
   * again after a refresh would be a worse kind of consent, not a stricter one.
   */
  if (!seeded && stored.checked) {
    setSeeded(true);

    if (stored.draft) {
      setAnswers(stored.draft.answers);
      setCurrentIndex(stored.draft.currentIndex);
      setConsentAcceptedAt(stored.draft.consentAcceptedAt);
      setRestoredDraft(true);
      setPhase("questions");
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

  /*
   * The funnel side of the same token.
   *
   * Until this existed a teacher who opened the link and left was, in the
   * database, identical to one who never received it — the response row is
   * written on submit and nowhere else. So the round now hears three things it
   * could not hear before: the questionnaire was opened, the consent was
   * accepted, and how far the questions got. It is the same per-attempt token
   * the submission carries, hashed the same way, so the funnel knows exactly
   * what the response already knew and nothing more.
   *
   * The hash is held rather than computed per beacon because the beacon that
   * matters most fires from `pagehide`, where there is no time left to await a
   * digest.
   */
  const [attemptTokenHash, setAttemptTokenHash] = useState<string | null>(null);
  // A plain holder rather than a ref: the beacon reads the hash from a callback
  // that fires long after render, and it must not force the beacon to be
  // rebuilt — and therefore forget what it already reported — when the hash
  // finally arrives.
  const attemptTokenHashHolder = useMemo<{ current: string | null }>(
    () => ({ current: null }),
    [],
  );

  const beacon = useMemo(
    () =>
      createSurveyAttemptBeacon({
        shareCode,
        tokenHash: () => attemptTokenHashHolder.current,
      }),
    [attemptTokenHashHolder, shareCode],
  );

  useEffect(() => {
    if (!seeded) return;

    let current = true;
    hashAnonymousToken(attemptToken.current())
      .then((hash) => {
        if (!current) return;
        attemptTokenHashHolder.current = hash;
        setAttemptTokenHash(hash);
      })
      .catch(() => {
        // A browser without SubtleCrypto submits without a dedupe hash today
        // and simply goes uncounted in the funnel. Neither is worth a screen.
      });

    return () => {
      current = false;
    };
  }, [attemptToken, attemptTokenHashHolder, seeded, phase]);

  useEffect(() => {
    if (!seeded || !attemptTokenHash) return;

    beacon.opened();
    // A restored draft means this session already consented, in an earlier page
    // load whose beacon may never have been sent.
    if (consentAcceptedAt) beacon.consented();
  }, [attemptTokenHash, beacon, consentAcceptedAt, seeded]);

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
        consentAcceptedAt,
      }),
    );

    setWriteRefused(!result.ok);
  }, [
    answers,
    consentAcceptedAt,
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
    if (!seeded || phase !== "questions") return;

    const timer = setTimeout(persistDraft, SAVE_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [persistDraft, phase, seeded]);

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
    if (!seeded || phase !== "questions") return;

    /*
     * The progress beacon rides the draft flush rather than firing per answer.
     * Twenty-four questions would otherwise be twenty-four requests on a
     * teacher's mobile data to learn something only the last one says, and the
     * moment worth recording is exactly this one: the page is going away, and
     * where it went away is the drop-off. The cost is a session killed without
     * `pagehide` — it stays counted as consented with no question index, which
     * reads as "we know they started and not where they stopped" rather than as
     * a wrong number.
     */
    // The funnel stores a question index and has since before steps existed,
    // so a step index here would silently rescale every number already in the
    // database. `questionIndexForStep` is the translation.
    const reportProgress = () =>
      beacon.progress(questionIndexForStep(steps, currentIndex, surveyQuestions));

    const flush = () => {
      if (document.visibilityState !== "hidden") return;
      persistDraft();
      reportProgress();
    };
    const flushNow = () => {
      persistDraft();
      reportProgress();
    };

    window.addEventListener("pagehide", flushNow);
    document.addEventListener("visibilitychange", flush);

    return () => {
      window.removeEventListener("pagehide", flushNow);
      document.removeEventListener("visibilitychange", flush);
    };
  }, [beacon, currentIndex, persistDraft, phase, seeded, steps, surveyQuestions]);

  /**
   * Moves the reading position into the questionnaire after an accept.
   *
   * The consent screen and the first question are one document, so without this
   * a keyboard or screen-reader user would be returned to the top of the page
   * and would have to find the question that just replaced the button they
   * pressed.
   */
  useEffect(() => {
    if (phase !== "questions" || !focusOnEnter.current) return;

    focusOnEnter.current = false;
    questionHeading.current?.focus();
  }, [phase]);

  const acceptConsent = () => {
    focusOnEnter.current = true;
    setConsentAcceptedAt(new Date().toISOString());
    setPhase("questions");
    beacon.consented();
  };

  const setAnswer = (questionId: string, value: string | undefined) => {
    setAnswers((current) => {
      if (value === undefined) {
        // Removed rather than stored empty. An absent key is what "not
        // answered" means everywhere else — the submit payload, the draft, the
        // completeness check — and an empty string would be a second way to
        // say it that only some of them understand.
        const { [questionId]: _removed, ...rest } = current;
        return rest;
      }

      return { ...current, [questionId]: value };
    });
  };

  /**
   * Moves on shortly after a one-tap answer.
   *
   * Only the widgets that finish in one tap ask for this. A number field and an
   * allocation grid call nothing: advancing mid-digit would take the screen
   * away from someone typing `10` after they pressed `1`.
   */
  const advanceSoon = () => {
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

    // Walked in questionnaire order rather than in the order the answers map
    // happens to hold, so a submission reads the way the questionnaire does.
    // Unanswered questions are absent, which is what an optional question a
    // respondent declined has to look like.
    const formattedAnswers = surveyQuestions
      .filter((item) => answers[item.id] !== undefined)
      .map((item) => {
        const value = answers[item.id];

        // No fallback dimension. This used to send `self-expression` for a
        // question it could not find, which the server refuses anyway — so the
        // fallback only ever turned "we lost the question" into a message about
        // the wrong stone. Omitting it says the same thing accurately, and is
        // what a background answer carries too.
        return item.kind === "analytic"
          ? { questionId: item.id, dimensionId: item.dimensionId, value }
          : { questionId: item.id, value };
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
        setPhase("complete");
        return;
      }

      setSubmitError(outcome.message);
      setSubmitting(false);
    } catch {
      setSubmitError("לא ניתן להתחבר לשרת. בדקו את החיבור ונסו שוב.");
      setSubmitting(false);
    }
  };

  if (phase === "consent") {
    return (
      <SurveyConsentStep
        surveyTitle={surveyTitle}
        introText={introText}
        anonymityText={anonymityText}
        estimatedMinutes={estimatedMinutes}
        questionCount={surveyQuestions.length}
        onAccept={acceptConsent}
        onDecline={() => setPhase("declined")}
      />
    );
  }

  if (phase === "declined") {
    return (
      <section className="survey-shell stone-page survey-builder-stone-page" style={{ maxWidth: "38rem", margin: "2rem auto" }}>
        <div className="survey-complete">
          <ShieldCheck size={42} aria-hidden="true" />
          <h1>לא נשלח דבר</h1>
          <p>
            הבחירה לא להשתתף לגיטימית לגמרי, ולא נשמר שום מידע — גם לא העובדה
            שנפתח הקישור. אפשר לסגור את החלון.
          </p>
          <button
            className="secondary-button"
            type="button"
            onClick={() => setPhase("consent")}
          >
            <RefreshCw size={18} aria-hidden="true" />
            חזרה למסך הפתיחה
          </button>
        </div>
      </section>
    );
  }

  if (phase === "complete") {
    return (
      <section className="survey-shell stone-page survey-builder-stone-page" style={{ maxWidth: "38rem", margin: "2rem auto" }}>
        <div className="survey-complete">
          <ShieldCheck size={42} aria-hidden="true" />
          <h1>תודה, התשובות נקלטו</h1>
          <p>{anonymityText}</p>
          {/*
            A second attempt is not offered here. The button existed for a
            shared staffroom computer, but the screen cannot tell the next
            person from the one who just answered, so the same teacher could
            take the round again from their own device and the aggregate would
            count them twice. Someone else at the same computer opens the link
            again, which starts a clean attempt with its own token.
          */}
          <p className="quiet-note">אפשר לסגור את החלון. תודה על המענה.</p>
        </div>
      </section>
    );
  }

  const progressPercent = calculatePercentage(completedSteps, total);
  const stepQuestions = step ? questionsInStep(step) : [];
  // Keyed so React remounts the card between steps: the widgets hold no state
  // of their own, but the heading takes focus on entry and a reused card keeps
  // the previous step's scroll position under it.
  const stepKey = step?.kind === "allocation" ? step.groupId : stepQuestions[0]?.id;
  /*
   * An allocation group has no prompt of its own in the data model — it is
   * thirteen questions sharing a constraint, and the constraint is what the
   * respondent needs told. So the heading states the rule and the rows carry
   * the activity names. If the instrument ever gives a grid a title, this is
   * where it goes.
   */
  /*
   * A block is headed by its section rather than by its first statement. The
   * statements are inside it, one per row, and repeating the first one above
   * them would name the block after one of its members.
   */
  const stepHeading =
    step?.kind === "allocation"
      ? "חלוקה באחוזים — הסכום של כל השורות צריך להיות 100"
      : step?.kind === "block"
        ? step.sectionId
        : (stepQuestions[0]?.text ?? "");
  const isOptionalStep =
    stepQuestions.length > 0 && stepQuestions.every((item) => !item.required);
  const optionalNote =
    step?.kind === "block" ? "אפשר לדלג על שאלות בחלק הזה" : "שאלת רשות";

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
            isReviewStep
              ? `כל ${total} השלבים הושלמו`
              : `שלב ${currentIndex + 1} מתוך ${total}`
          }
        >
          <span style={{ transform: `scaleX(${progressPercent / 100})` }} />
        </div>
        <small>
          {isReviewStep
            ? `הושלמו ${completedSteps} מתוך ${total}`
            : `שלב ${currentIndex + 1} מתוך ${total}`}
        </small>
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
          <h2>
            {canSubmit
              ? "הכל מוכן לשליחה"
              : blocker === "allocation-total"
                ? "טבלת החלוקה עדיין לא מסתכמת ב־100"
                : "נותרו שאלות ללא מענה"}
          </h2>
          <p>
            {canSubmit
              ? "אפשר לחזור אחורה ולעדכן תשובה, או לשלוח עכשיו."
              : blocker === "allocation-total"
                ? "חזרו לטבלה והשלימו את החלוקה ל־100, או נקו את השורות כדי לדלג עליה."
                : `הושלמו ${completedSteps} מתוך ${total} שלבים. חזרו אחורה כדי להשלים את החסרים — שאלות רשות אפשר להשאיר ריקות.`}
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
        <div className="survey-focus-card" key={stepKey}>
          <span className="question-index" aria-hidden="true">
            {currentIndex + 1}
          </span>
          <h2 ref={questionHeading} tabIndex={-1}>
            {stepHeading}
          </h2>
          {isOptionalStep ? (
            <p className="quiet-note survey-optional-note">{optionalNote}</p>
          ) : null}
          <SurveyAnswerInput
            step={step}
            answers={answers}
            onAnswer={setAnswer}
            onAdvance={advanceSoon}
          />
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
          לשלב הקודם
        </button>
        {/*
          Offered as soon as the step is complete rather than as soon as it is
          answered, which is what lets an optional question be walked past: it
          is complete from the moment it is reached. A typed step — a number, a
          grid — has no auto-advance, so this button is the only way forward
          from it and must not be hidden while the respondent is deciding.
        */}
        {!isReviewStep && step && isStepComplete(step, answers) ? (
          <button
            className="secondary-button"
            type="button"
            onClick={() => setCurrentIndex((index) => Math.min(index + 1, total))}
          >
            לשלב הבא
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
