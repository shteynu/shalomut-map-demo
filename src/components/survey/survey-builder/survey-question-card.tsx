import type { CSSProperties } from "react";
import { ChevronDown, ChevronUp, ClipboardList, Clock3, Copy, Edit3, Eye, ShieldCheck, Trash2 } from "lucide-react";
import { dimensionPresentations } from "@/lib/dashboard/dimension-presentation";
import type { BuilderQuestion } from "./types";

function getDimensionLabel(dimensionId: string) {
  return dimensionPresentations.find((dimension) => dimension.id === dimensionId)?.conceptLabel ?? dimensionId;
}

function getDimensionColor(dimensionId: string) {
  return dimensionPresentations.find((dimension) => dimension.id === dimensionId)?.conceptColor ?? "#e49902";
}

type QuestionCardProps = {
  question: BuilderQuestion;
  questionIndex: number;
  /** Move this question one place up (-1) or down (1) in the shown order. */
  onMove: (draftKey: string, direction: -1 | 1) => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onUpdate: (draftKey: string, updater: (question: BuilderQuestion) => BuilderQuestion) => void;
  onDuplicate: (draftKey: string) => void;
  onEdit?: (question: BuilderQuestion) => void;
  onDelete?: (draftKey: string) => void;
  isFrozen?: boolean;
};

const FROZEN_HINT =
  "השאלון הוקפא לאחר קבלת התשובה הראשונה ולא ניתן לערוך אותו";

export function SurveyQuestionCard({
  question,
  questionIndex,
  onMove,
  canMoveUp,
  canMoveDown,
  onUpdate,
  onDuplicate,
  onEdit,
  onDelete,
  isFrozen = false,
}: QuestionCardProps) {
  return (
    <article
      className={`survey-builder-question-card${question.enabled ? "" : " is-disabled"}`}
      style={{ "--question-color": getDimensionColor(question.dimensionId) } as CSSProperties}
      aria-describedby={isFrozen ? "survey-builder-frozen-note" : undefined}
    >
      <div className="survey-builder-question-row">
        {/* This used to be a drag handle icon that did nothing. Two buttons
            instead: they reorder for real, and they work from the keyboard,
            which a drag handle never did. */}
        <span className="survey-builder-order">
          <button
            className="question-move-button"
            type="button"
            title={isFrozen ? FROZEN_HINT : "העברת השאלה למעלה"}
            aria-label="העברת השאלה למעלה"
            disabled={isFrozen || !canMoveUp}
            onClick={() => onMove(question.draftKey, -1)}
          >
            <ChevronUp size={15} aria-hidden="true" />
          </button>
          <span className="survey-builder-order-number">
            {question.enabled && questionIndex > 0 ? questionIndex : "-"}
          </span>
          <button
            className="question-move-button"
            type="button"
            title={isFrozen ? FROZEN_HINT : "העברת השאלה למטה"}
            aria-label="העברת השאלה למטה"
            disabled={isFrozen || !canMoveDown}
            onClick={() => onMove(question.draftKey, 1)}
          >
            <ChevronDown size={15} aria-hidden="true" />
          </button>
        </span>

        <div className="survey-builder-question-copy">
          <strong className="survey-builder-dimension-stone">{getDimensionLabel(question.dimensionId)}</strong>
          <p>{question.text}</p>
        </div>

        <div className="survey-builder-question-actions" aria-label={`פעולות עבור שאלה ${questionIndex}`}>
          {onEdit ? (
            <button
              className="question-icon-button"
              type="button"
              title={isFrozen ? FROZEN_HINT : "עריכת שאלה בחלון צף"}
              aria-label="עריכת שאלה בחלון צף"
              disabled={isFrozen}
              onClick={() => onEdit(question)}
            >
              <Edit3 size={17} aria-hidden="true" />
            </button>
          ) : null}
          <button
            className="question-icon-button"
            type="button"
            title={
              isFrozen
                ? FROZEN_HINT
                : question.required
                  ? "להפוך לרשות"
                  : "להפוך לחובה"
            }
            aria-label={question.required ? "להפוך לרשות" : "להפוך לחובה"}
            disabled={isFrozen}
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
            title={
              isFrozen
                ? FROZEN_HINT
                : question.enabled
                  ? "להסתיר מסבב האבחון"
                  : "להחזיר לסבב האבחון"
            }
            aria-label={question.enabled ? "להסתיר מסבב האבחון" : "להחזיר לסבב האבחון"}
            disabled={isFrozen}
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
            title={isFrozen ? FROZEN_HINT : "שכפול שאלה"}
            aria-label="שכפול שאלה"
            disabled={isFrozen}
            onClick={() => onDuplicate(question.draftKey)}
          >
            <Copy size={17} aria-hidden="true" />
          </button>
          {onDelete ? (
            <button
              className="question-icon-button question-icon-button-danger"
              type="button"
              title={isFrozen ? FROZEN_HINT : "מחיקת שאלה"}
              aria-label="מחיקת שאלה"
              disabled={isFrozen}
              onClick={() => onDelete(question.draftKey)}
            >
              <Trash2 size={17} aria-hidden="true" />
            </button>
          ) : null}
        </div>
      </div>

      <div className="builder-form-grid">
        <label>
          מזהה קבוע לשאלה
          <input
            dir="ltr"
            value={question.id}
            readOnly={isFrozen}
            title={isFrozen ? FROZEN_HINT : undefined}
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
            disabled={isFrozen}
            title={isFrozen ? FROZEN_HINT : undefined}
            onChange={(event) =>
              onUpdate(question.draftKey, (current) => ({
                ...current,
                dimensionId: event.target.value as BuilderQuestion["dimensionId"],
              }))
            }
            aria-label={`ממד שלומות לשאלה ${questionIndex}`}
          >
            {dimensionPresentations.map((dimension) => (
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
          readOnly={isFrozen}
          title={isFrozen ? FROZEN_HINT : undefined}
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
