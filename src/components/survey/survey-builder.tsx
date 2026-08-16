"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, Eye, Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { RoundSwitcher } from "@/components/round/round-switcher";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { PageIntro } from "@/components/ui/page-intro";
import { PrivacyTooltip } from "@/components/ui/privacy-tooltip";
import { SaveStatus, parseSavedAt } from "@/components/ui/save-status";
import { useClipboard } from "@/lib/hooks/use-clipboard";
import { dimensionPresentations } from "@/lib/dashboard/dimension-presentation";
import { getNavigationAction } from "@/lib/navigation";
import type { RoundSwitcherOptions } from "@/lib/rounds/round-options";
import { useShareUrl } from "@/lib/use-share-url";
import type { SurveyDefinition } from "@/lib/types/backend";
import { canonicalSurveyQuestions } from "@/lib/survey-definition";
import type { AnswerScaleId } from "@/lib/survey/answer-scales";
import { estimateMinutesForQuestionnaire } from "@/lib/survey/survey-duration";
import {
  moveQuestionWithinView,
  sectionNamesIn,
  setEnabledForKeys,
  visibleQuestionsFor,
} from "./survey-builder/question-list-operations";
import { SurveyBuilderQuestions } from "./survey-builder/survey-builder-questions";
import { SurveyBuilderSettings } from "./survey-builder/survey-builder-settings";
import { SurveyBuilderSidebar } from "./survey-builder/survey-builder-sidebar";
import { SurveyBuilderHistory } from "./survey-builder/survey-builder-history";
import {
  builderAcceleratorFor,
  isTextEntryElement,
} from "./survey-builder/keyboard-accelerators";
import { QuestionEditDialog } from "./survey-builder/question-edit-dialog";
import { scaleForNewQuestion } from "./survey-builder/new-question-scale";
import {
  requestAiQuestionSuggestion,
  styleTextsForDimension,
  suggestionDimensionId,
  templateSuggestionForDimension,
  type QuestionSuggestion,
  type QuestionSuggestionSource,
} from "./survey-builder/question-suggestions";
import {
  getBuilderQuestionnaireValidation,
  isBuilderAnalyticQuestion,
  localizeSurveyDefinitionSaveError,
  toBuilderQuestions,
  toSurveyDefinitionQuestion,
  type BuilderQuestion,
} from "./survey-builder/types";

/**
 * The library used to be three hardcoded questions cycling on a cursor, and they
 * covered three dimensions of eight — so a manager building a round about the
 * other five had nothing to start from. The template half of the suggestion flow
 * now draws on the canonical questionnaire, which covers all eight by
 * construction, and the AI half asks for an item for the dimension in hand.
 *
 * The scale arrives rather than being written here: a suggestion joins the
 * questionnaire being built, so it is answered the way that questionnaire is.
 */
function buildSuggestedQuestion(
  suggestion: QuestionSuggestion,
  scaleId: AnswerScaleId,
): BuilderQuestion {
  return {
    text: suggestion.text,
    kind: "analytic",
    dimensionId: suggestion.dimensionId,
    scaleId,
    polarity: "positive",
    required: true,
    enabled: true,
    draftKey: createDraftId("suggestion"),
    id: createDraftId(suggestion.source === "ai" ? "ai" : "template"),
  };
}

const builderFlowSteps = [
  {
    title: "הגדרות",
    helper: "שם, קהל יעד וסף פרטיות",
  },
  {
    title: "שאלות",
    helper: "שאלות משתנות ב-8 ממדים קבועים",
  },
  {
    title: "הפצה",
    helper: "קישור אנונימי למשיבים",
  },
];

function createDraftId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 7)}`;
}

type SurveyBuilderProps = {
  organizationName: string;
  roundId: string;
  roundTitle: string;
  shareCode: string;
  initialDefinition: SurveyDefinition;
  /**
   * When this round last reached the database, as the round records it. It
   * covers the setup screen's saves too, which rewrite the round — including
   * the questionnaire's privacy threshold and audience.
   */
  lastSavedAt?: string;
  isFrozen?: boolean;
  /**
   * The school's other rounds. The builder is a client component and the rounds
   * are a server read, so the page hands over the list it already loaded rather
   * than this component fetching one. It arrives as data, not as markup: an
   * element built on the server and passed through a prop crosses the boundary
   * unkeyed, which React reports as a missing `key` in this component's
   * children.
   */
  roundOptions?: RoundSwitcherOptions;
  /** Where the switcher's form posts — this screen's own path. */
  roundSwitcherAction?: string;
};

/**
 * How many questions the confirmation says the template will bring.
 *
 * Read from the template rather than from the instrument, so the number in the
 * dialog and the questions the button loads cannot come apart — the manager is
 * being asked to discard their draft on the strength of this figure.
 */
const CANONICAL_QUESTION_COUNT = canonicalSurveyQuestions().length;

export function SurveyBuilder({
  organizationName,
  roundId,
  roundTitle,
  shareCode,
  initialDefinition,
  lastSavedAt,
  isFrozen = false,
  roundOptions,
  roundSwitcherAction,
}: SurveyBuilderProps) {
  const [title, setTitle] = useState(initialDefinition.title);
  const audience = initialDefinition.audience;
  const [minimumResponses, setMinimumResponses] = useState(
    initialDefinition.minimumResponses,
  );
  const [introText, setIntroText] = useState(initialDefinition.introText);
  const [anonymityText, setAnonymityText] = useState(
    initialDefinition.anonymityText,
  );
  const [questions, setQuestions] = useState<BuilderQuestion[]>(
    toBuilderQuestions(
      initialDefinition.questions,
      (question, index) => `initial-${index}-${question.id}`,
    ),
  );
  const [saved, setSaved] = useState(false);
  const [closedRoundTitles, setClosedRoundTitles] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  // When the round last reached the database, and whether the questionnaire has
  // moved since. It starts at the stored save time, which is what carries the
  // answer across a reload. Every edit goes through `markEdited`, so the time on
  // screen never outlives the state it describes.
  const [savedAt, setSavedAt] = useState<Date | null>(() =>
    parseSavedAt(lastSavedAt),
  );
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  // Bumped after every save so the history panel refetches. A counter rather
  // than the save time: two saves inside one minute produce the same time and
  // would not refetch.
  const [historyToken, setHistoryToken] = useState(0);
  const [loadedVersionAt, setLoadedVersionAt] = useState<string | null>(null);

  /** One entry point for every change that leaves the draft unsaved. */
  function markEdited() {
    setSaved(false);
    setSaveError(null);
    setHasUnsavedChanges(true);
  }

  /** Wrap a settings setter so editing a field counts as an edit. */
  function edited<Value>(setter: (value: Value) => void) {
    return (value: Value) => {
      markEdited();
      setter(value);
    };
  }
  const { status: copyStatus, copy } = useClipboard();
  const router = useRouter();
  const shareUrl = useShareUrl(shareCode);
  const shareInputRef = useRef<HTMLInputElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  /**
   * Copy the link, and when the browser refuses, select it so the manual copy
   * the failure note asks for is a single keystroke away.
   */
  async function copyRespondentLink() {
    const written = await copy(shareUrl);
    if (!written) shareInputRef.current?.select();
  }
  const openRespondentSurveyAction = getNavigationAction("openRespondentSurvey");
  // "all" is a filter value, not a dimension, so the state is wider than the
  // presentation ids the list is built from.
  const [selectedDimensionId, setSelectedDimensionId] = useState<string>(
    dimensionPresentations[0]?.id ?? "all",
  );
  const [searchTerm, setSearchTerm] = useState("");
  const [editingQuestion, setEditingQuestion] = useState<BuilderQuestion | null>(null);
  /**
   * A question that is being written but has not joined the questionnaire yet.
   * It arrives either from a suggestion — which carries its source and the
   * wording it was offered with, so the dialog can require a rewrite — or from
   * the manager pressing "add a question", which carries neither: wording they
   * typed themselves needs no attribution and no edit requirement.
   */
  const [pendingQuestion, setPendingQuestion] = useState<{
    draft: BuilderQuestion;
    suggestion?: {
      source: QuestionSuggestionSource;
      suggestedText: string;
    };
  } | null>(null);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [suggestionNote, setSuggestionNote] = useState<string | null>(null);
  /**
   * The change that is waiting to be confirmed, if any. All three of these
   * discard wording somebody wrote, and all three used to ask through
   * `window.confirm`; `deleteQuestion` names the question it is about, so the
   * dialog can quote it rather than asking about "this question" while the
   * browser's own box hides the list behind it.
   */
  const [pendingRemoval, setPendingRemoval] = useState<
    | { kind: "clear" }
    | { kind: "loadTemplate" }
    | { kind: "deleteQuestion"; draftKey: string; text: string }
    | null
  >(null);

  const enabledQuestions = questions.filter((question) => question.enabled);
  /*
   * The last thing a teacher reads before deciding whether to start, and the
   * only screen where this product asks for their time. It used to be a number
   * a manager typed once: enable eight questions out of twenty-four and the
   * link still promised the twenty-four-question minutes. Derived here instead,
   * from the questions that will actually be asked, so the promise cannot
   * outlive the questionnaire it was made about.
   */
  const estimatedMinutes = estimateMinutesForQuestionnaire(enabledQuestions);
  const requiredQuestions = enabledQuestions.filter((question) => question.required);
  const activeDimensions = new Set(
    enabledQuestions
      .filter(isBuilderAnalyticQuestion)
      .map((question) => question.dimensionId),
  ).size;
  const visibleQuestions = visibleQuestionsFor(
    questions,
    selectedDimensionId,
    searchTerm,
  );
  const visibleKeys = visibleQuestions.map((question) => question.draftKey);
  const questionnaireValidation = getBuilderQuestionnaireValidation(questions);
  const targetDimensionId = suggestionDimensionId(
    selectedDimensionId,
    questionnaireValidation.missingDimensionIds,
  );
  const templateSuggestion = templateSuggestionForDimension(
    targetDimensionId,
    questions.map((question) => question.text),
  );
  /**
   * The scale a question written now would be answered on. Read from the draft
   * rather than named here, so a questionnaire of Likert blocks does not hand
   * the manager a colour question to put inside one.
   */
  const newQuestionScaleId = scaleForNewQuestion(questions, targetDimensionId);

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
      className: "stone-variant-green",
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
      className: "stone-variant-teal",
    },
  ];

  /** Enable or hide everything the current tab and search leave on screen. */
  function setVisibleQuestionsEnabled(enabled: boolean) {
    markEdited();
    setQuestions((current) => setEnabledForKeys(current, visibleKeys, enabled));
  }

  /** Move a question one place up or down the order respondents will see. */
  function moveQuestion(draftKey: string, direction: -1 | 1) {
    markEdited();
    setQuestions((current) =>
      moveQuestionWithinView(current, visibleKeys, draftKey, direction),
    );
  }

  function updateQuestion(draftKey: string, updater: (question: BuilderQuestion) => BuilderQuestion) {
    markEdited();
    setQuestions((current) => current.map((question) => (question.draftKey === draftKey ? updater(question) : question)));
  }

  function duplicateQuestion(draftKey: string) {
    markEdited();
    setQuestions((current) => {
      const index = current.findIndex((question) => question.draftKey === draftKey);
      const source = current[index];

      if (!source) {
        return current;
      }

      const duplicate = {
        ...source,
        draftKey: createDraftId("question"),
        id: createDraftId(`${source.id.trim() || "question"}-copy`),
      };

      return [...current.slice(0, index + 1), duplicate, ...current.slice(index + 1)];
    });
  }

  function deleteQuestion(draftKey: string) {
    markEdited();
    setQuestions((current) => current.filter((q) => q.draftKey !== draftKey));
    setPendingRemoval(null);
  }

  function clearQuestionnaire() {
    markEdited();
    setQuestions([]);
    setPendingRemoval(null);
  }

  /**
   * The default template, taken from the one place that builds it.
   *
   * This used to map `surveyInstrument` here and retype the scale and polarity,
   * which made the builder a second opinion about what the default asks — and
   * the copy a manager actually loads, so a drift between it and the round they
   * were given would have shown up as a questionnaire that changed under them.
   * The builder adds a draft key and nothing else.
   */
  function loadDefaultTemplate() {
    setPendingRemoval(null);
    const defaultQuestions: BuilderQuestion[] = canonicalSurveyQuestions().map(
      (question, idx) => ({
        ...question,
        draftKey: createDraftId(`default-${idx}`),
      }),
    );
    markEdited();
    setQuestions(defaultQuestions);
  }

  /**
   * A suggestion is opened for editing, never appended. The plan for this flow
   * asked for the source to be marked and the wording to be edited by hand
   * before it joins the questionnaire, and the dialog enforces the second half:
   * the questionnaire is the manager's, and a school reads it as theirs.
   */
  function openSuggestion(suggestion: QuestionSuggestion) {
    setEditingQuestion(null);
    setPendingQuestion({
      draft: buildSuggestedQuestion(
        suggestion,
        scaleForNewQuestion(questions, suggestion.dimensionId),
      ),
      suggestion: {
        source: suggestion.source,
        suggestedText: suggestion.text,
      },
    });
    setSelectedDimensionId(suggestion.dimensionId);
  }

  /**
   * A question the manager writes themselves. Everything the questionnaire can
   * hold used to arrive from somewhere else — the template, the model, or a
   * duplicate of a question already in the list — so writing one from scratch
   * meant duplicating an unrelated question and overwriting every field of it.
   * The draft opens in the same dialog every other question is edited in, and
   * joins the list only when it is saved, so cancelling leaves nothing behind.
   */
  function addQuestionManually() {
    setSuggestionNote(null);
    setEditingQuestion(null);
    setPendingQuestion({
      draft: {
        text: "",
        kind: "analytic",
        // The tab the manager is standing in, or — on "all questions" — the
        // dimension that is still keeping the questionnaire from going live.
        dimensionId: targetDimensionId,
        // The questionnaire's own scale, not the one that used to be the only
        // one. Polarity stays `positive` on purpose: it is a statement about
        // this sentence, not about the questionnaire around it.
        scaleId: newQuestionScaleId,
        polarity: "positive",
        required: true,
        enabled: true,
        draftKey: createDraftId("manual"),
        id: createDraftId("custom"),
      },
    });
  }

  function suggestFromTemplate() {
    setSuggestionNote(null);
    if (!templateSuggestion) {
      setSuggestionNote(
        "כל היגדי התבנית בממד הזה נמצאים כבר בשאלון. אפשר לבקש הצעה מהבינה המלאכותית או לנסח שאלה חדשה.",
      );
      return;
    }
    openSuggestion(templateSuggestion);
  }

  async function suggestWithAi() {
    setSuggestionNote(null);
    setIsSuggesting(true);
    try {
      const outcome = await requestAiQuestionSuggestion(
        targetDimensionId,
        questions.map((question) => question.text),
        // The style the model matches, out of the questionnaire actually being
        // written. The service used to supply this list itself, from a frozen
        // contract that cannot follow the instrument.
        styleTextsForDimension(questions, targetDimensionId),
      );

      if (outcome.ok) {
        openSuggestion(outcome.suggestion);
        return;
      }

      // The AI service is down or refused. The manager still gets a starting
      // point, and it is labelled as the template it is — never as a
      // suggestion the model did not make.
      if (templateSuggestion) {
        openSuggestion(templateSuggestion);
        setSuggestionNote(`${outcome.error} הוצע נוסח מהתבנית המקורית במקום.`);
        return;
      }

      setSuggestionNote(outcome.error);
    } finally {
      setIsSuggesting(false);
    }
  }

  function commitFromDialog(
    draftKey: string,
    updater: (question: BuilderQuestion) => BuilderQuestion,
  ) {
    if (pendingQuestion && pendingQuestion.draft.draftKey === draftKey) {
      const edited = updater(pendingQuestion.draft);
      markEdited();
      setQuestions((current) => [...current, edited]);
      setPendingQuestion(null);
      return;
    }

    updateQuestion(draftKey, updater);
  }

  async function saveDefinition() {
    if (!questionnaireValidation.isSaveable) {
      setSaved(false);
      setSaveError(questionnaireValidation.messages.join(" "));
      return;
    }

    setSaving(true);
    markEdited();

    const response = await fetch(
      `/api/rounds/${encodeURIComponent(roundId)}/survey-definition`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          audience,
          estimatedMinutes,
          minimumResponses,
          introText,
          anonymityText,
          questions: questions.map(toSurveyDefinitionQuestion),
        }),
      },
    ).catch(() => null);

    if (!response?.ok) {
      const payload = response
        ? ((await response.json().catch(() => null)) as { error?: string } | null)
        : null;
      setSaveError(
        localizeSurveyDefinitionSaveError(payload?.error, response?.status),
      );
      setSaving(false);
      return;
    }

    const payload = (await response.json().catch(() => null)) as {
      closedRoundTitles?: string[];
      savedAt?: string;
    } | null;

    setClosedRoundTitles(
      Array.isArray(payload?.closedRoundTitles) ? payload.closedRoundTitles : [],
    );
    setSavedAt(parseSavedAt(payload?.savedAt));
    setHasUnsavedChanges(false);
    setSaved(true);
    setSaving(false);
    setLoadedVersionAt(null);
    setHistoryToken((token) => token + 1);

    /*
     * This save is what starts the round, and starting a round closes the one
     * that was running. The round switcher beside this form was rendered on the
     * server before any of that happened, so without this it goes on offering
     * the round it just closed as `פעיל` and this one as `טיוטה` — the exact
     * opposite of what the school now has. A reload corrected it, which is not
     * a thing a manager should have to know.
     *
     * A refresh and not a remount: the key on this component has not changed,
     * so the questionnaire in state, the save confirmation and the note about
     * which round was closed all survive, and only the server-rendered parts
     * are rebuilt.
     */
    router.refresh();
  }

  /**
   * An earlier questionnaire is loaded into the editor, not written. The
   * manager reads what they are about to get and presses save, which is the
   * same path every other change takes — and the version being left is already
   * in the history, so the step back is itself reversible.
   */
  function loadVersion(definition: SurveyDefinition, savedAt: string) {
    markEdited();
    setTitle(definition.title);
    // Audience is not editable in the builder, so a version cannot carry a
    // different one; restoring it would only be able to reintroduce a value
    // this screen never offered.
    // The estimate is not restored: it follows the questions this version
    // brings with it, which are set below.
    setMinimumResponses(definition.minimumResponses);
    setIntroText(definition.introText);
    setAnonymityText(definition.anonymityText);
    setQuestions(
      toBuilderQuestions(definition.questions, (_question, index) =>
        createDraftId(`version-${index}`),
      ),
    );
    setLoadedVersionAt(savedAt);
  }

  /**
   * The two chords that belong to the screen rather than to one question.
   *
   * Ctrl/Cmd+S is the one every editor has, and the browser's own Save-page
   * dialog is worthless here, so it is taken over — but only when saving is
   * actually possible, otherwise the manager gets the browser dialog they know
   * instead of nothing at all. `/` reaches the search field, and stands down
   * whenever the caret is somewhere a `/` is a character.
   *
   * Registered fresh on every render on purpose: the handler closes over the
   * questionnaire state, and one listener is cheaper than the bookkeeping to
   * keep a stale one correct.
   */
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const accelerator = builderAcceleratorFor(
        event,
        isTextEntryElement(event.target),
      );
      if (!accelerator) return;

      if (accelerator === "focus-search") {
        event.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
        return;
      }

      if (saving || isFrozen || !questionnaireValidation.isSaveable) return;

      event.preventDefault();
      void saveDefinition();
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  return (
    <div className="page survey-builder-stone-page">
      <PageIntro
        eyebrow={`${organizationName}, ${roundTitle} | בניית שאלון`}
        title={title}
        description="מסך זה מאפשר עריכת שאלון לפני הפצה: קהל יעד, ניסוח פתיח, שאלות פעילות וקישור המשיבים החיצוני."
        actions={
          <>
            <button
              className="primary-button"
              type="button"
              onClick={saveDefinition}
              disabled={saving || isFrozen || !questionnaireValidation.isSaveable}
              data-round-id={roundId}
              aria-describedby={
                questionnaireValidation.isSaveable
                  ? undefined
                  : "survey-builder-validation"
              }
            >
              {saving ? (
                <Loader2 size={18} className="animate-spin" aria-hidden="true" />
              ) : (
                <CheckCircle2 size={18} aria-hidden="true" />
              )}
              {saving
                ? "שומר..."
                : questionnaireValidation.isValid
                  ? "שמירה והכנה להפצה"
                  : "שמירת טיוטה"}
            </button>
            <Link className="secondary-button" href={shareUrl} target="_blank" rel="noreferrer">
              {openRespondentSurveyAction.label}
              <Eye size={18} aria-hidden="true" />
            </Link>
          </>
        }
      />

      {roundOptions && roundSwitcherAction ? (
        <RoundSwitcher options={roundOptions} action={roundSwitcherAction} />
      ) : null}

      {/* Directly under the save button, where the manager is already looking
          when they wonder whether the last click landed. */}
      <SaveStatus savedAt={savedAt} hasUnsavedChanges={hasUnsavedChanges} />

      {/* A loaded version is on screen but not in the database, and the save
          line above says only "unsaved changes". This says which change. */}
      {loadedVersionAt ? (
        <p className="muted-note" role="status">
          נטענה גרסה קודמת של השאלון. היא תיכנס לתוקף רק לאחר שמירה.
        </p>
      ) : null}

      {saveError ? (
        <p className="survey-submit-error" role="alert">
          {saveError}
        </p>
      ) : null}

      {!questionnaireValidation.isValid ? (
        <section
          id="survey-builder-validation"
          className="survey-submit-error"
          aria-live="polite"
          aria-label="בדיקות לפני שמירת השאלון"
        >
          <strong>כדי לשמור ולהפעיל את השאלון:</strong>
          <ul>
            {questionnaireValidation.messages.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="metric-grid survey-builder-metric-grid" aria-label="תקציר שאלון">
        {summaryStones.map((stone) => {
          const showTooltip = stone.label === "סף פרטיות" || stone.label === "סף הצגה";
          return (
            <article key={stone.label} className={`metric-card survey-builder-metric-stone ${stone.className}`}>
              <strong>{stone.value}</strong>
              <span>
                {stone.label}
                {showTooltip && (
                  <PrivacyTooltip minimumResponses={minimumResponses} />
                )}
              </span>
              <small>{stone.helper}</small>
            </article>
          );
        })}
      </section>

      <section className="survey-builder-flow" aria-label="רצף עבודה בשאלון">
        {builderFlowSteps.map((step, index) => (
          <article key={step.title} className="survey-builder-flow-step">
            <span>{String(index + 1).padStart(2, "0")}</span>
            <strong>{step.title}</strong>
            <small>{step.helper}</small>
          </article>
        ))}
      </section>

      <div className="survey-builder-layout">
        <div className="survey-builder-main">
          <SurveyBuilderSettings
            title={title}
            setTitle={edited(setTitle)}
            audience={audience}
            estimatedMinutes={estimatedMinutes}
            minimumResponses={minimumResponses}
            setMinimumResponses={edited(setMinimumResponses)}
            introText={introText}
            setIntroText={edited(setIntroText)}
            anonymityText={anonymityText}
            setAnonymityText={edited(setAnonymityText)}
          />

          <SurveyBuilderQuestions
            questions={questions}
            visibleQuestions={visibleQuestions}
            selectedDimensionId={selectedDimensionId}
            setSelectedDimensionId={setSelectedDimensionId}
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            searchInputRef={searchInputRef}
            onSetVisibleEnabled={setVisibleQuestionsEnabled}
            onMoveQuestion={moveQuestion}
            onUpdateQuestion={updateQuestion}
            onDuplicateQuestion={duplicateQuestion}
            onEditQuestion={(q) => setEditingQuestion(q)}
            onDeleteQuestion={(draftKey) => {
              const question = questions.find((q) => q.draftKey === draftKey);
              setPendingRemoval({
                kind: "deleteQuestion",
                draftKey,
                text: question?.text ?? "",
              });
            }}
            onAddQuestion={addQuestionManually}
            onSuggestFromTemplate={suggestFromTemplate}
            onSuggestWithAi={suggestWithAi}
            isSuggesting={isSuggesting}
            suggestionNote={suggestionNote}
            suggestionDimensionLabel={
              dimensionPresentations.find(
                (dimension) => dimension.id === targetDimensionId,
              )?.conceptLabel ?? targetDimensionId
            }
            onClearQuestionnaire={() => setPendingRemoval({ kind: "clear" })}
            /* An empty draft has nothing to overwrite, so it is loaded straight
               away; anything else replaces work and is asked about first. */
            onLoadTemplate={() =>
              questions.length === 0
                ? loadDefaultTemplate()
                : setPendingRemoval({ kind: "loadTemplate" })
            }
            isFrozen={isFrozen}
          />
        </div>

        <SurveyBuilderSidebar
          shareUrl={shareUrl}
          copyStatus={copyStatus}
          shareInputRef={shareInputRef}
          onCopyRespondentLink={copyRespondentLink}
          templateSuggestion={templateSuggestion}
          onSuggestFromTemplate={suggestFromTemplate}
          isFrozen={isFrozen}
          saved={saved}
          closedRoundTitles={closedRoundTitles}
          questionnaireReady={questionnaireValidation.isValid}
        />
      </div>

      <div className="survey-builder-history-slot">
        <SurveyBuilderHistory
          roundId={roundId}
          refreshToken={historyToken}
          onLoadVersion={loadVersion}
          isFrozen={isFrozen}
        />
      </div>

      <QuestionEditDialog
        isOpen={Boolean(editingQuestion ?? pendingQuestion)}
        question={editingQuestion ?? pendingQuestion?.draft ?? null}
        questionIndex={
          editingQuestion
            ? questions.findIndex((q) => q.draftKey === editingQuestion.draftKey) + 1
            : 0
        }
        sectionNames={sectionNamesIn(questions)}
        defaultScaleId={newQuestionScaleId}
        isNew={Boolean(pendingQuestion) && !editingQuestion}
        suggestion={
          pendingQuestion && !editingQuestion
            ? pendingQuestion.suggestion
            : undefined
        }
        onClose={() => {
          setEditingQuestion(null);
          setPendingQuestion(null);
        }}
        onSave={commitFromDialog}
      />

      <ConfirmDialog
        isOpen={pendingRemoval?.kind === "deleteQuestion"}
        title="מחיקת שאלה מהשאלון"
        body={
          <>
            <p>השאלה תוסר מהטיוטה. אפשר גם להסתיר אותה במקום למחוק — שאלה מוסתרת נשמרת בשאלון ואינה נשלחת למשיבים.</p>
            {pendingRemoval?.kind === "deleteQuestion" && pendingRemoval.text ? (
              <p className="confirm-dialog-quote">
                {`"${pendingRemoval.text}"`}
              </p>
            ) : null}
          </>
        }
        confirmLabel="מחיקת השאלה"
        isDestructive
        onConfirm={() => {
          if (pendingRemoval?.kind === "deleteQuestion") {
            deleteQuestion(pendingRemoval.draftKey);
          }
        }}
        onCancel={() => setPendingRemoval(null)}
      />

      <ConfirmDialog
        isOpen={pendingRemoval?.kind === "clear"}
        title="ניקוי השאלון"
        body={`כל ${questions.length} השאלות יוסרו והשאלון יחזור לטיוטה ריקה. השאלון שנשמר אחרון נשאר בהיסטוריית הגרסאות, וניתן לטעון אותו משם.`}
        confirmLabel="מחיקת כל השאלות"
        isDestructive
        onConfirm={clearQuestionnaire}
        onCancel={() => setPendingRemoval(null)}
      />

      <ConfirmDialog
        isOpen={pendingRemoval?.kind === "loadTemplate"}
        title="טעינת תבנית השאלון"
        body={`תבנית ${CANONICAL_QUESTION_COUNT} השאלות תחליף את ${questions.length} השאלות שבטיוטה, כולל ניסוחים שנערכו. השאלון שנשמר אחרון נשאר בהיסטוריית הגרסאות.`}
        confirmLabel="טעינת התבנית"
        isDestructive
        onConfirm={loadDefaultTemplate}
        onCancel={() => setPendingRemoval(null)}
      />
    </div>
  );
}
