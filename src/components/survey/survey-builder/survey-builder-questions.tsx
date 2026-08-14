import { BookMarked, Keyboard, Loader2, Lock, Plus, RotateCcw, Search, Sparkles, Trash2 } from "lucide-react";
import { Fragment } from "react";
import type { RefObject } from "react";
import { dimensionPresentations } from "@/lib/dashboard/dimension-presentation";
import { groupBySection, UNSECTIONED_KEY } from "./question-list-operations";
import { SurveyQuestionCard } from "./survey-question-card";
import { BACKGROUND_FILTER_ID, type BuilderQuestion } from "./types";

function getDimensionLabel(dimensionId: string) {
  return dimensionPresentations.find((dimension) => dimension.id === dimensionId)?.conceptLabel ?? dimensionId;
}

/**
 * The legend under the list. It repeats what each button already carries in its
 * tooltip and `aria-keyshortcuts`, because a shortcut nobody can see is
 * folklore — and it is kept next to the list the chords act on rather than in a
 * help screen nobody opens.
 */
const QUESTION_SHORTCUTS = [
  {
    label: "העברה",
    keys: (
      <>
        <kbd>Alt</kbd>+<kbd>↑</kbd>/<kbd>↓</kbd>
      </>
    ),
  },
  {
    label: "עריכה",
    keys: (
      <>
        <kbd>Alt</kbd>+<kbd>E</kbd>
      </>
    ),
  },
  {
    label: "שכפול",
    keys: (
      <>
        <kbd>Alt</kbd>+<kbd>D</kbd>
      </>
    ),
  },
  {
    label: "הסתרה",
    keys: (
      <>
        <kbd>Alt</kbd>+<kbd>H</kbd>
      </>
    ),
  },
  {
    label: "חובה",
    keys: (
      <>
        <kbd>Alt</kbd>+<kbd>R</kbd>
      </>
    ),
  },
];

type QuestionsPanelProps = {
  questions: BuilderQuestion[];
  visibleQuestions: BuilderQuestion[];
  selectedDimensionId: string;
  setSelectedDimensionId: (id: string) => void;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  /** Focused by the `/` accelerator, which lives on the page above. */
  searchInputRef?: RefObject<HTMLInputElement | null>;
  /** Enable or hide every question currently on screen. */
  onSetVisibleEnabled: (enabled: boolean) => void;
  onMoveQuestion: (draftKey: string, direction: -1 | 1) => void;
  onUpdateQuestion: (id: string, updater: (question: BuilderQuestion) => BuilderQuestion) => void;
  onDuplicateQuestion: (id: string) => void;
  onEditQuestion?: (question: BuilderQuestion) => void;
  onDeleteQuestion?: (id: string) => void;
  /** Open an empty question in the edit dialog. */
  onAddQuestion?: () => void;
  onSuggestFromTemplate: () => void;
  onSuggestWithAi: () => void;
  isSuggesting?: boolean;
  suggestionNote?: string | null;
  suggestionDimensionLabel: string;
  onClearQuestionnaire?: () => void;
  onLoadTemplate?: () => void;
  isFrozen?: boolean;
};

export function SurveyBuilderQuestions({
  questions,
  visibleQuestions,
  selectedDimensionId,
  setSelectedDimensionId,
  searchTerm,
  setSearchTerm,
  searchInputRef,
  onSetVisibleEnabled,
  onMoveQuestion,
  onUpdateQuestion,
  onDuplicateQuestion,
  onEditQuestion,
  onDeleteQuestion,
  onAddQuestion,
  onSuggestFromTemplate,
  onSuggestWithAi,
  isSuggesting = false,
  suggestionNote,
  suggestionDimensionLabel,
  onClearQuestionnaire,
  onLoadTemplate,
  isFrozen = false,
}: QuestionsPanelProps) {
  const selectedDimensionLabel =
    selectedDimensionId === "all"
      ? "כל השאלות"
      : selectedDimensionId === BACKGROUND_FILTER_ID
        ? "שאלות רקע"
        : getDimensionLabel(selectedDimensionId);
  const backgroundQuestions = questions.filter(
    (question) => question.kind === "background",
  );

  // Map active (enabled) questions to sequential 1-based index numbers
  let activeCounter = 0;
  const activeIndexMap = new Map<string, number>();
  for (const q of questions) {
    if (q.enabled) {
      activeCounter += 1;
      activeIndexMap.set(q.draftKey, activeCounter);
    }
  }

  /**
   * Where each question sits in the list on screen. The move buttons step
   * within the whole visible list, not within a section, so a question can be
   * moved out of the block it is in — which is the only way to move one between
   * sections without a second control for it.
   */
  const visibleIndexByKey = new Map(
    visibleQuestions.map((question, index) => [question.draftKey, index]),
  );
  const sections = groupBySection(visibleQuestions);
  // A questionnaire that names no section is a flat list, and 24 questions read
  // better as one. The blocks appear when a questionnaire is long enough for
  // somebody to have named its parts.
  const showSections = sections.length > 1 || sections[0]?.sectionId !== undefined;

  return (
    <section className="survey-builder-panel survey-builder-questions-panel">
      <div className="survey-builder-heading">
        <div>
          <p className="eyebrow">מבנה השאלון</p>
          <h2>שאלות לעריכה</h2>
        </div>
        <div className="survey-builder-heading-actions">
          {/* First, and the only filled button in this row: writing a question
              is what this panel is for, and every other button here offers
              somebody else's wording. */}
          {onAddQuestion ? (
            <button
              className="primary-button"
              type="button"
              onClick={onAddQuestion}
              disabled={isFrozen}
              title="כתיבת שאלה חדשה בניסוח שלכם"
            >
              <Plus size={18} aria-hidden="true" />
              הוספת שאלה
            </button>
          ) : null}
          {onLoadTemplate ? (
            <button
              className="secondary-button"
              type="button"
              onClick={onLoadTemplate}
              disabled={isFrozen}
              title="טעינת תבנית 24 השאלות המקוריות"
            >
              <RotateCcw size={16} aria-hidden="true" />
              טעינת תבנית
            </button>
          ) : null}
          {onClearQuestionnaire ? (
            <button
              className="secondary-button secondary-button-danger"
              type="button"
              onClick={onClearQuestionnaire}
              disabled={isFrozen || questions.length === 0}
              title="מחיקת כל השאלות והתחלת טיוטה ריקה"
            >
              <Trash2 size={16} aria-hidden="true" />
              ניקוי שאלון
            </button>
          ) : null}
          <button
            className="secondary-button"
            type="button"
            onClick={onSuggestFromTemplate}
            disabled={isFrozen}
            title={`היגד מתבנית השאלון המקורית ב${suggestionDimensionLabel}`}
          >
            <BookMarked size={18} aria-hidden="true" />
            הצעה מהתבנית
          </button>
          {/* Secondary on purpose: the page's primary action is saving the
              questionnaire, and asking for a draft commits nothing. The icon and
              the line below carry the distinction instead of emphasis. */}
          <button
            className="secondary-button survey-builder-ai-button"
            type="button"
            onClick={onSuggestWithAi}
            disabled={isFrozen || isSuggesting}
            aria-busy={isSuggesting}
            title={`בקשת הצעת שאלה מהבינה המלאכותית ב${suggestionDimensionLabel}`}
          >
            {isSuggesting ? (
              <Loader2 size={18} aria-hidden="true" className="animate-spin" />
            ) : (
              <Sparkles size={18} aria-hidden="true" />
            )}
            {isSuggesting ? "מנסח הצעה…" : "הצעת שאלה בעזרת AI"}
          </button>
        </div>
      </div>

      <p className="quiet-note survey-builder-suggestion-target" role="status">
        ההצעה תתייחס לממד <strong>{suggestionDimensionLabel}</strong>, ותיפתח
        לעריכה לפני ההוספה לשאלון.
      </p>

      {suggestionNote ? (
        <p className="survey-builder-suggestion-note" role="alert">
          {suggestionNote}
        </p>
      ) : null}

      {isFrozen ? (
        <p
          id="survey-builder-frozen-note"
          className="survey-builder-frozen-note"
          role="status"
        >
          <Lock size={18} aria-hidden="true" />
          <span>
            השאלון הוקפא לעריכה משום שכבר התקבלו תשובות בסבב זה. שאלות, מזהים
            וניסוחים אינם ניתנים לשינוי כדי לשמור על תקינות המדידה המצרפית.
          </span>
        </p>
      ) : null}

      <div className="survey-builder-dimension-tabs" role="group" aria-label="סינון שאלות לפי ממד שלומות">
        {dimensionPresentations.map((dimension, index) => {
          const dimensionQuestions = questions.filter(
            (question) =>
              question.kind === "analytic" && question.dimensionId === dimension.id,
          );
          const activeCount = dimensionQuestions.filter((q) => q.enabled).length;
          return (
            <button
              key={dimension.id}
              type="button"
              className={`survey-builder-dimension-tab${selectedDimensionId === dimension.id ? " is-active" : ""}`}
              onClick={() => setSelectedDimensionId(dimension.id)}
              aria-pressed={selectedDimensionId === dimension.id}
            >
              <span>{index + 1}. {dimension.conceptLabel}</span>
              <small>{activeCount > 0 ? `${activeCount}/${dimensionQuestions.length}` : dimensionQuestions.length}</small>
            </button>
          );
        })}
        {/* Its own tab, because a background question belongs to none of the
            eight above and would otherwise be reachable only by clearing the
            filter — which is how a manager stops knowing it is there. */}
        <button
          type="button"
          className={`survey-builder-dimension-tab${selectedDimensionId === BACKGROUND_FILTER_ID ? " is-active" : ""}`}
          onClick={() => setSelectedDimensionId(BACKGROUND_FILTER_ID)}
          aria-pressed={selectedDimensionId === BACKGROUND_FILTER_ID}
        >
          <span>שאלות רקע</span>
          <small>{backgroundQuestions.length}</small>
        </button>
        <button
          type="button"
          className={`survey-builder-dimension-tab${selectedDimensionId === "all" ? " is-active" : ""}`}
          onClick={() => setSelectedDimensionId("all")}
          aria-pressed={selectedDimensionId === "all"}
        >
          <span>כל השאלות</span>
          <small>{questions.length}</small>
        </button>
      </div>

      <div className="survey-builder-list-tools">
        <label className="survey-builder-search">
          <Search size={16} aria-hidden="true" />
          <span className="visually-hidden">חיפוש שאלה לפי נוסח, ממד או מזהה</span>
          <input
            ref={searchInputRef}
            type="search"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder='חיפוש לפי נוסח, ממד או מזהה (מקש /)'
            aria-keyshortcuts="/"
          />
        </label>

        {/* Bulk actions follow the list, not the tab: with a search running,
            what they change is exactly what is on screen. */}
        <div className="survey-builder-bulk-actions">
          <button
            className="ghost-button"
            type="button"
            onClick={() => onSetVisibleEnabled(true)}
            disabled={isFrozen || visibleQuestions.length === 0}
          >
            הפעלת המוצגות ({visibleQuestions.length})
          </button>
          <button
            className="ghost-button"
            type="button"
            onClick={() => onSetVisibleEnabled(false)}
            disabled={isFrozen || visibleQuestions.length === 0}
          >
            הסתרת המוצגות ({visibleQuestions.length})
          </button>
        </div>
      </div>

      <p className="quiet-note survey-builder-filter-note" role="status">
        מוצגות {visibleQuestions.length} שאלות ב{selectedDimensionLabel}
        {searchTerm.trim() ? ` התואמות לחיפוש "${searchTerm.trim()}"` : ""}. רק שאלות פעילות ממוספרות ברצף. שאלות מוסתרות מוצגות ללא מספר ואינן נשלחות למשיבים.
      </p>

      {/* A shortcut nobody can see is folklore. The chords are listed where the
          list they act on begins, and each button repeats its own in the
          tooltip and in `aria-keyshortcuts`. Hidden while the questionnaire is
          frozen: none of them do anything then. */}
      {!isFrozen && visibleQuestions.length > 0 ? (
        <p className="quiet-note survey-builder-shortcut-note">
          <Keyboard size={16} aria-hidden="true" />
          <span>
            קיצורי מקלדת בשאלה שהסמן נמצא בה:{" "}
            {/* The separator's space belongs between the chords, not inside
                one. Held inside a `nowrap` chord it is not a break
                opportunity, so all seven chords were one unbreakable run —
                668px of it — and the panel clips what does not fit. */}
            {QUESTION_SHORTCUTS.map((shortcut, index) => (
              <Fragment key={shortcut.label}>
                <span className="shortcut-chord">
                  {shortcut.keys}
                  {` ${shortcut.label}`}
                  {index < QUESTION_SHORTCUTS.length - 1 ? "," : "."}
                </span>{" "}
              </Fragment>
            ))}
            בכל המסך:{" "}
            <span className="shortcut-chord">
              <kbd>/</kbd> חיפוש,
            </span>{" "}
            <span className="shortcut-chord">
              <kbd>Ctrl</kbd>/<kbd>Cmd</kbd>+<kbd>S</kbd> שמירה.
            </span>{" "}
            מחיקה נשארה בכפתור בלבד.
          </span>
        </p>
      ) : null}

      {visibleQuestions.length === 0 ? (
        <div className="survey-builder-empty-note">
          <strong>אין שאלות בקטגוריה זו (טיוטה ריקה)</strong>
          <p className="quiet-note">
            ניתן להוסיף שאלה חדשה, להשתמש בשאלה ממאגר הדוגמאות, או לטעון את התבנית המלאה.
          </p>
          {/* The sentence above named three ways out and the panel offered one
              of them. Writing a question is the first one it names. */}
          {onAddQuestion ? (
            <button
              type="button"
              onClick={onAddQuestion}
              className="primary-button"
              disabled={isFrozen}
            >
              <Plus size={16} aria-hidden="true" />
              הוספת שאלה חדשה
            </button>
          ) : null}
          {onLoadTemplate ? (
            <button
              type="button"
              onClick={onLoadTemplate}
              className="secondary-button"
              disabled={isFrozen}
            >
              <RotateCcw size={16} aria-hidden="true" />
              טעינת תבנית השאלון המלאה (24 שאלות)
            </button>
          ) : null}
        </div>
      ) : (
        (() => {
          const renderCard = (question: BuilderQuestion) => {
            const index = visibleIndexByKey.get(question.draftKey) ?? 0;
            return (
              <SurveyQuestionCard
                key={question.draftKey}
                question={question}
                questionIndex={activeIndexMap.get(question.draftKey) ?? 0}
                onMove={onMoveQuestion}
                canMoveUp={index > 0}
                canMoveDown={index < visibleQuestions.length - 1}
                onUpdate={onUpdateQuestion}
                onDuplicate={onDuplicateQuestion}
                onEdit={onEditQuestion}
                onDelete={onDeleteQuestion}
                isFrozen={isFrozen}
              />
            );
          };

          if (!showSections) {
            return (
              <div className="survey-builder-question-list">
                {visibleQuestions.map(renderCard)}
              </div>
            );
          }

          /* `details` rather than a button and a piece of state: it collapses
             without JavaScript, it is what a screen reader already announces as
             expandable, and the browser's own find-in-page opens it. Open by
             default, because a manager who filtered to a section did so to read
             it. */
          return (
            <div className="survey-builder-question-sections">
              {sections.map((section) => (
                <details
                  className="survey-builder-question-section"
                  key={section.sectionId ?? UNSECTIONED_KEY}
                  open
                >
                  <summary>
                    <span>{section.sectionId ?? "ללא שיוך לחלק"}</span>
                    <small>{section.questions.length}</small>
                  </summary>
                  <div className="survey-builder-question-list">
                    {section.questions.map(renderCard)}
                  </div>
                </details>
              ))}
            </div>
          );
        })()
      )}
    </section>
  );
}
