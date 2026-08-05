"use client";

import Link from "next/link";
import { CheckCircle2, Eye, Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { PageIntro } from "@/components/ui/page-intro";
import { PrivacyTooltip } from "@/components/ui/privacy-tooltip";
import { SaveStatus, parseSavedAt } from "@/components/ui/save-status";
import { useClipboard } from "@/lib/hooks/use-clipboard";
import { dimensionPresentations } from "@/lib/dashboard/dimension-presentation";
import { getNavigationAction } from "@/lib/navigation";
import { useShareUrl } from "@/lib/use-share-url";
import type { SurveyDefinition } from "@/lib/types/backend";
import { surveyInstrument } from "@/lib/shalomut-source";
import {
  moveQuestionWithinView,
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
import {
  requestAiQuestionSuggestion,
  suggestionDimensionId,
  templateSuggestionForDimension,
  type QuestionSuggestion,
  type QuestionSuggestionSource,
} from "./survey-builder/question-suggestions";
import {
  getBuilderQuestionnaireValidation,
  localizeSurveyDefinitionSaveError,
  toSurveyDefinitionQuestion,
  type BuilderQuestion,
} from "./survey-builder/types";

/**
 * The library used to be three hardcoded questions cycling on a cursor, and they
 * covered three dimensions of eight — so a manager building a round about the
 * other five had nothing to start from. The template half of the suggestion flow
 * now draws on the canonical questionnaire, which covers all eight by
 * construction, and the AI half asks for an item for the dimension in hand.
 */
function buildSuggestedQuestion(
  suggestion: QuestionSuggestion,
): BuilderQuestion {
  return {
    text: suggestion.text,
    dimensionId: suggestion.dimensionId,
    required: true,
    enabled: true,
    answerMode: "סקאלת צבעים",
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
};

export function SurveyBuilder({
  organizationName,
  roundId,
  roundTitle,
  shareCode,
  initialDefinition,
  lastSavedAt,
  isFrozen = false,
}: SurveyBuilderProps) {
  const [title, setTitle] = useState(initialDefinition.title);
  const audience = initialDefinition.audience;
  const [estimatedMinutes, setEstimatedMinutes] = useState(
    initialDefinition.estimatedMinutes,
  );
  const [minimumResponses, setMinimumResponses] = useState(
    initialDefinition.minimumResponses,
  );
  const [introText, setIntroText] = useState(initialDefinition.introText);
  const [anonymityText, setAnonymityText] = useState(
    initialDefinition.anonymityText,
  );
  const [questions, setQuestions] = useState<BuilderQuestion[]>(
    initialDefinition.questions.map((question, index) => ({
      ...question,
      draftKey: `initial-${index}-${question.id}`,
    })),
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
  const [pendingSuggestion, setPendingSuggestion] = useState<{
    draft: BuilderQuestion;
    source: QuestionSuggestionSource;
    suggestedText: string;
  } | null>(null);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [suggestionNote, setSuggestionNote] = useState<string | null>(null);

  const enabledQuestions = questions.filter((question) => question.enabled);
  const requiredQuestions = enabledQuestions.filter((question) => question.required);
  const activeDimensions = new Set(enabledQuestions.map((question) => question.dimensionId)).size;
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
    if (typeof window !== "undefined" && !window.confirm("האם למחוק שאלה זו מהשאלון?")) {
      return;
    }
    markEdited();
    setQuestions((current) => current.filter((q) => q.draftKey !== draftKey));
  }

  function clearQuestionnaire() {
    if (typeof window !== "undefined" && !window.confirm("האם למחוק את כל השאלות ולהתחיל מטיוטה ריקה?")) {
      return;
    }
    markEdited();
    setQuestions([]);
  }

  function loadDefaultTemplate() {
    if (
      questions.length > 0 &&
      typeof window !== "undefined" &&
      !window.confirm("טעינת התבנית תחליף את השאלות הקיימות. האם להמשיך?")
    ) {
      return;
    }
    const defaultQuestions: BuilderQuestion[] = surveyInstrument.questions.map((q, idx) => ({
      id: q.id,
      dimensionId: q.dimensionId,
      text: q.text,
      required: q.required,
      enabled: true,
      answerMode: "סקאלת צבעים",
      draftKey: createDraftId(`default-${idx}`),
    }));
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
    markEdited();
    setEditingQuestion(null);
    setPendingSuggestion({
      draft: buildSuggestedQuestion(suggestion),
      source: suggestion.source,
      suggestedText: suggestion.text,
    });
    setSelectedDimensionId(suggestion.dimensionId);
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
    if (pendingSuggestion && pendingSuggestion.draft.draftKey === draftKey) {
      const edited = updater(pendingSuggestion.draft);
      markEdited();
      setQuestions((current) => [...current, edited]);
      setPendingSuggestion(null);
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
    setEstimatedMinutes(definition.estimatedMinutes);
    setMinimumResponses(definition.minimumResponses);
    setIntroText(definition.introText);
    setAnonymityText(definition.anonymityText);
    setQuestions(
      definition.questions.map((question, index) => ({
        ...question,
        draftKey: createDraftId(`version-${index}`),
      })),
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
            setEstimatedMinutes={edited(setEstimatedMinutes)}
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
            onDeleteQuestion={deleteQuestion}
            onSuggestFromTemplate={suggestFromTemplate}
            onSuggestWithAi={suggestWithAi}
            isSuggesting={isSuggesting}
            suggestionNote={suggestionNote}
            suggestionDimensionLabel={
              dimensionPresentations.find(
                (dimension) => dimension.id === targetDimensionId,
              )?.conceptLabel ?? targetDimensionId
            }
            onClearQuestionnaire={clearQuestionnaire}
            onLoadTemplate={loadDefaultTemplate}
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
        isOpen={Boolean(editingQuestion ?? pendingSuggestion)}
        question={editingQuestion ?? pendingSuggestion?.draft ?? null}
        questionIndex={
          editingQuestion
            ? questions.findIndex((q) => q.draftKey === editingQuestion.draftKey) + 1
            : 0
        }
        suggestion={
          pendingSuggestion && !editingQuestion
            ? {
                source: pendingSuggestion.source,
                suggestedText: pendingSuggestion.suggestedText,
              }
            : undefined
        }
        onClose={() => {
          setEditingQuestion(null);
          setPendingSuggestion(null);
        }}
        onSave={commitFromDialog}
      />
    </div>
  );
}
