import type { CSSProperties } from "react";
import { ClipboardList, Clock3, Copy, Eye, GripVertical, ShieldCheck } from "lucide-react";
import { wellbeingDimensions } from "@/lib/demo-data";
import type { BuilderQuestion } from "./types";

function getDimensionLabel(dimensionId: string) {
  return wellbeingDimensions.find((dimension) => dimension.id === dimensionId)?.conceptLabel ?? dimensionId;
}

function getDimensionColor(dimensionId: string) {
  return wellbeingDimensions.find((dimension) => dimension.id === dimensionId)?.conceptColor ?? "#e49902";
}

type QuestionCardProps = {
  question: BuilderQuestion;
  questionIndex: number;
  onUpdate: (draftKey: string, updater: (question: BuilderQuestion) => BuilderQuestion) => void;
  onDuplicate: (draftKey: string) => void;
};

export function SurveyQuestionCard({
  question,
  questionIndex,
  onUpdate,
  onDuplicate,
}: QuestionCardProps) {
  return (
    <article
      className={`survey-builder-question-card${question.enabled ? "" : " is-disabled"}`}
      style={{ "--question-color": getDimensionColor(question.dimensionId) } as CSSProperties}
    >
      <div className="survey-builder-question-row">
        <span className="survey-builder-order">
          <GripVertical size={16} aria-hidden="true" />
          {questionIndex}
        </span>

        <div className="survey-builder-question-copy">
          <strong className="survey-builder-dimension-stone">{getDimensionLabel(question.dimensionId)}</strong>
          <p>{question.text}</p>
        </div>

        <div className="survey-builder-question-actions" aria-label={`פעולות עבור שאלה ${questionIndex}`}>
          <button
            className="question-icon-button"
            type="button"
            title={question.required ? "להפוך לרשות" : "להפוך לחובה"}
            aria-label={question.required ? "להפוך לרשות" : "להפוך לחובה"}
            onClick={() =>
              onUpdate(question.draftKey, (current) => ({
                ...current,
                required: !current.required,
              }))
            }
          >
            <ShieldCheck size={17} aria-hidden="true" />
          </button>
          <button
            className="question-icon-button"
            type="button"
            title={question.enabled ? "להסתיר מסבב האבחון" : "להחזיר לסבב האבחון"}
            aria-label={question.enabled ? "להסתיר מסבב האבחון" : "להחזיר לסבב האבחון"}
            onClick={() =>
              onUpdate(question.draftKey, (current) => ({
                ...current,
                enabled: !current.enabled,
              }))
            }
          >
            <Eye size={17} aria-hidden="true" />
          </button>
          <button
            className="question-icon-button"
            type="button"
            title="שכפול שאלה"
            aria-label="שכפול שאלה"
            onClick={() => onDuplicate(question.draftKey)}
          >
            <Copy size={17} aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="builder-form-grid">
        <label>
          מזהה קבוע לשאלה
          <input
            dir="ltr"
            value={question.id}
            onChange={(event) =>
              onUpdate(question.draftKey, (current) => ({
                ...current,
                id: event.target.value,
              }))
            }
            aria-label={`מזהה קבוע לשאלה ${questionIndex}`}
          />
        </label>
        <label>
          ממד שלומות
          <select
            value={question.dimensionId}
            onChange={(event) =>
              onUpdate(question.draftKey, (current) => ({
                ...current,
                dimensionId: event.target.value as BuilderQuestion["dimensionId"],
              }))
            }
            aria-label={`ממד שלומות לשאלה ${questionIndex}`}
          >
            {wellbeingDimensions.map((dimension) => (
              <option key={dimension.id} value={dimension.id}>
                {dimension.conceptLabel}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label>
        נוסח השאלה המדויק שיוצג וינותח
        <textarea
          rows={3}
          value={question.text}
          onChange={(event) =>
            onUpdate(question.draftKey, (current) => ({
              ...current,
              text: event.target.value,
            }))
          }
          aria-label={`נוסח שאלה ${questionIndex}`}
        />
      </label>

      <div className="survey-builder-tags">
        <span className={`status-badge ${question.enabled ? "status-green" : "status-yellow"}`}>
          <ClipboardList size={15} aria-hidden="true" />
          {question.enabled ? "פעילה" : "מוסתרת"}
        </span>
        <span className={`status-badge ${question.required ? "status-green" : "status-yellow"}`}>
          <ShieldCheck size={15} aria-hidden="true" />
          {question.required ? "חובה" : "רשות"}
        </span>
        <span className="status-badge status-yellow">
          <Clock3 size={15} aria-hidden="true" />
          {question.answerMode}
        </span>
      </div>
    </article>
  );
}
