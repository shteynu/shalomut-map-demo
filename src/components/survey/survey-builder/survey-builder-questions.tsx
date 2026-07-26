import { Plus } from "lucide-react";
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
}: QuestionsPanelProps) {
  const selectedDimensionLabel =
    selectedDimensionId === "all" ? "כל השאלות" : getDimensionLabel(selectedDimensionId);

  return (
    <section className="survey-builder-panel survey-builder-questions-panel">
      <div className="survey-builder-heading">
        <div>
          <p className="eyebrow">מבנה השאלון</p>
          <h2>שאלות לעריכה</h2>
        </div>
        <button className="secondary-button" type="button" onClick={onAddQuestionFromBank}>
          הוספת שאלה לדוגמה
          <Plus size={18} aria-hidden="true" />
        </button>
      </div>

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
        מוצגות {visibleQuestions.length} שאלות ב{selectedDimensionLabel}. שאלות המקור הן תבנית התחלתית בלבד; ניתן לשנות מזהה, נוסח וממד, להסתיר שאלות ולהוסיף שאלות חדשות.
        המזהה, הנוסח והממד נשמרים כחלק מתמונת הסבב, ולאחר קבלת התשובה הראשונה שינוי משמעות דורש סבב או גרסה חדשה.
      </p>

      <div className="survey-builder-question-list">
        {visibleQuestions.map((question, visibleIndex) => {
          const displayIndex = visibleIndex + 1;
          return (
            <SurveyQuestionCard
              key={question.draftKey}
              question={question}
              questionIndex={displayIndex}
              onUpdate={onUpdateQuestion}
              onDuplicate={onDuplicateQuestion}
              onEdit={onEditQuestion}
              onDelete={onDeleteQuestion}
            />
          );
        })}
      </div>
    </section>
  );
}
