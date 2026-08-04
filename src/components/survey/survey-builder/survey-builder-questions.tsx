import { Loader2, Lock, Plus, RotateCcw, Search, Sparkles, Trash2 } from "lucide-react";
import { dimensionPresentations } from "@/lib/dashboard/dimension-presentation";
import { SurveyQuestionCard } from "./survey-question-card";
import type { BuilderQuestion } from "./types";

function getDimensionLabel(dimensionId: string) {
  return dimensionPresentations.find((dimension) => dimension.id === dimensionId)?.conceptLabel ?? dimensionId;
}

type QuestionsPanelProps = {
  questions: BuilderQuestion[];
  visibleQuestions: BuilderQuestion[];
  selectedDimensionId: string;
  setSelectedDimensionId: (id: string) => void;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  /** Enable or hide every question currently on screen. */
  onSetVisibleEnabled: (enabled: boolean) => void;
  onMoveQuestion: (draftKey: string, direction: -1 | 1) => void;
  onUpdateQuestion: (id: string, updater: (question: BuilderQuestion) => BuilderQuestion) => void;
  onDuplicateQuestion: (id: string) => void;
  onEditQuestion?: (question: BuilderQuestion) => void;
  onDeleteQuestion?: (id: string) => void;
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
  onSetVisibleEnabled,
  onMoveQuestion,
  onUpdateQuestion,
  onDuplicateQuestion,
  onEditQuestion,
  onDeleteQuestion,
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
    selectedDimensionId === "all" ? "כל השאלות" : getDimensionLabel(selectedDimensionId);

  // Map active (enabled) questions to sequential 1-based index numbers
  let activeCounter = 0;
  const activeIndexMap = new Map<string, number>();
  for (const q of questions) {
    if (q.enabled) {
      activeCounter += 1;
      activeIndexMap.set(q.draftKey, activeCounter);
    }
  }

  return (
    <section className="survey-builder-panel survey-builder-questions-panel">
      <div className="survey-builder-heading">
        <div>
          <p className="eyebrow">מבנה השאלון</p>
          <h2>שאלות לעריכה</h2>
        </div>
        <div className="survey-builder-heading-actions">
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
            <Plus size={18} aria-hidden="true" />
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
          const dimensionQuestions = questions.filter((question) => question.dimensionId === dimension.id);
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
            type="search"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="חיפוש לפי נוסח, ממד או מזהה"
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

      {visibleQuestions.length === 0 ? (
        <div className="survey-builder-empty-note">
          <strong>אין שאלות בקטגוריה זו (טיוטה ריקה)</strong>
          <p className="quiet-note">
            ניתן להוסיף שאלה חדשה, להשתמש בשאלה ממאגר הדוגמאות, או לטעון את התבנית המלאה.
          </p>
          {onLoadTemplate ? (
            <button
              type="button"
              onClick={onLoadTemplate}
              className="primary-button"
              disabled={isFrozen}
            >
              <RotateCcw size={16} aria-hidden="true" />
              טעינת תבנית השאלון המלאה (24 שאלות)
            </button>
          ) : null}
        </div>
      ) : (
        <div className="survey-builder-question-list">
          {visibleQuestions.map((question, index) => {
            const activeIndex = activeIndexMap.get(question.draftKey) ?? 0;
            return (
              <SurveyQuestionCard
                key={question.draftKey}
                question={question}
                questionIndex={activeIndex}
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
          })}
        </div>
      )}
    </section>
  );
}
