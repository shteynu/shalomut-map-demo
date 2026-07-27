import { Lock, Plus, RotateCcw, Trash2 } from "lucide-react";
import { wellbeingDimensions } from "@/lib/demo-data";
import { SurveyQuestionCard } from "./survey-question-card";
import type { BuilderQuestion } from "./types";

function getDimensionLabel(dimensionId: string) {
  return wellbeingDimensions.find((dimension) => dimension.id === dimensionId)?.conceptLabel ?? dimensionId;
}

type QuestionsPanelProps = {
  questions: BuilderQuestion[];
  visibleQuestions: BuilderQuestion[];
  selectedDimensionId: string;
  setSelectedDimensionId: (id: string) => void;
  onUpdateQuestion: (id: string, updater: (question: BuilderQuestion) => BuilderQuestion) => void;
  onDuplicateQuestion: (id: string) => void;
  onEditQuestion?: (question: BuilderQuestion) => void;
  onDeleteQuestion?: (id: string) => void;
  onAddQuestionFromBank: () => void;
  onClearQuestionnaire?: () => void;
  onLoadTemplate?: () => void;
  isFrozen?: boolean;
};

export function SurveyBuilderQuestions({
  questions,
  visibleQuestions,
  selectedDimensionId,
  setSelectedDimensionId,
  onUpdateQuestion,
  onDuplicateQuestion,
  onEditQuestion,
  onDeleteQuestion,
  onAddQuestionFromBank,
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
            onClick={onAddQuestionFromBank}
            disabled={isFrozen}
          >
            <Plus size={18} aria-hidden="true" />
            הוספת שאלה לדוגמה
          </button>
        </div>
      </div>

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
        {wellbeingDimensions.map((dimension, index) => {
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

      <p className="quiet-note survey-builder-filter-note">
        מוצגות {visibleQuestions.length} שאלות ב{selectedDimensionLabel}. רק שאלות פעילות ממוספרות ברצף. שאלות מוסתרות מוצגות ללא מספר ואינן נשלחות למשיבים.
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
          {visibleQuestions.map((question) => {
            const activeIndex = activeIndexMap.get(question.draftKey) ?? 0;
            return (
              <SurveyQuestionCard
                key={question.draftKey}
                question={question}
                questionIndex={activeIndex}
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
