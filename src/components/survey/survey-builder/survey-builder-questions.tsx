import { Plus } from "lucide-react";
import { wellbeingDimensions } from "@/lib/demo-data";
import { surveyInstrument } from "@/lib/shalomut-source";
import { SurveyQuestionCard } from "./survey-question-card";
import type { BuilderQuestion } from "./types";

function getDimensionLabel(dimensionId: string) {
  return wellbeingDimensions.find((dimension) => dimension.id === dimensionId)?.conceptLabel ?? dimensionId;
}

const canonicalQuestionIds = new Set(
  surveyInstrument.questions.map((question) => question.id),
);

type QuestionsPanelProps = {
  questions: BuilderQuestion[];
  visibleQuestions: BuilderQuestion[];
  selectedDimensionId: string;
  setSelectedDimensionId: (id: string) => void;
  onUpdateQuestion: (id: string, updater: (question: BuilderQuestion) => BuilderQuestion) => void;
  onDuplicateQuestion: (id: string) => void;
  onAddQuestionFromBank: () => void;
};

export function SurveyBuilderQuestions({
  questions,
  visibleQuestions,
  selectedDimensionId,
  setSelectedDimensionId,
  onUpdateQuestion,
  onDuplicateQuestion,
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
        {wellbeingDimensions.map((dimension) => {
          const dimensionQuestions = questions.filter((question) => question.dimensionId === dimension.id);
          return (
            <button
              key={dimension.id}
              type="button"
              className={`survey-builder-dimension-tab${selectedDimensionId === dimension.id ? " is-active" : ""}`}
              onClick={() => setSelectedDimensionId(dimension.id)}
              aria-pressed={selectedDimensionId === dimension.id}
            >
              <span>{dimension.conceptLabel}</span>
              <small>{dimensionQuestions.length}</small>
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
        מוצגות {visibleQuestions.length} שאלות ב{selectedDimensionLabel}. 24 שאלות המקור נשארות פעילות וחובה; ניתן להוסיף שאלות משלימות.
      </p>

      <div className="survey-builder-question-list">
        {visibleQuestions.map((question) => {
          const questionIndex = questions.findIndex((current) => current.id === question.id) + 1;
          return (
            <SurveyQuestionCard
              key={question.id}
              question={question}
              questionIndex={questionIndex}
              locked={canonicalQuestionIds.has(question.id)}
              onUpdate={onUpdateQuestion}
              onDuplicate={onDuplicateQuestion}
            />
          );
        })}
      </div>
    </section>
  );
}
