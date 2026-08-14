import type { CSSProperties, KeyboardEvent } from "react";
import { ChevronDown, ChevronUp, ClipboardList, Clock3, Copy, Edit3, Eye, ShieldCheck, Trash2 } from "lucide-react";
import { dimensionPresentations } from "@/lib/dashboard/dimension-presentation";
import { getAnswerScale } from "@/lib/survey/answer-scales";
import { questionAcceleratorFor } from "./keyboard-accelerators";
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
  function toggle(field: "enabled" | "required") {
    onUpdate(question.draftKey, (current) => ({
      ...current,
      [field]: !current[field],
    }));
  }

  /**
   * The accelerators act on the question the caret is in, which is what makes
   * them worth having: no chord needs a "selected question" concept, and the
   * card the manager is reading is the card that answers.
   *
   * A chord that cannot act — moving the first question up, editing a frozen
   * questionnaire — is left alone rather than swallowed, so the browser's own
   * behaviour survives where this screen has nothing to offer.
   */
  function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (isFrozen) return;

    const accelerator = questionAcceleratorFor(event);
    if (!accelerator) return;

    if (accelerator === "move-up" || accelerator === "move-down") {
      const direction = accelerator === "move-up" ? -1 : 1;
      if (direction === -1 ? !canMoveUp : !canMoveDown) return;

      event.preventDefault();
      onMove(question.draftKey, direction);
      return;
    }

    if (accelerator === "edit") {
      if (!onEdit) return;
      event.preventDefault();
      onEdit(question);
      return;
    }

    event.preventDefault();
    if (accelerator === "duplicate") onDuplicate(question.draftKey);
    if (accelerator === "toggle-enabled") toggle("enabled");
    if (accelerator === "toggle-required") toggle("required");
  }

  return (
    <article
      className={`survey-builder-question-card${question.enabled ? "" : " is-disabled"}`}
      style={{ "--question-color": getDimensionColor(question.dimensionId) } as CSSProperties}
      aria-describedby={isFrozen ? "survey-builder-frozen-note" : undefined}
      onKeyDown={handleKeyDown}
    >
      <div className="survey-builder-question-row">
        {/* This used to be a drag handle icon that did nothing. Two buttons
            instead: they reorder for real, and they work from the keyboard,
            which a drag handle never did. */}
        <span className="survey-builder-order">
          <button
            className="question-move-button"
            type="button"
            title={isFrozen ? FROZEN_HINT : "העברת השאלה למעלה (Alt+↑)"}
            aria-label="העברת השאלה למעלה"
            aria-keyshortcuts="Alt+ArrowUp"
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
            title={isFrozen ? FROZEN_HINT : "העברת השאלה למטה (Alt+↓)"}
            aria-label="העברת השאלה למטה"
            aria-keyshortcuts="Alt+ArrowDown"
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
              title={isFrozen ? FROZEN_HINT : "עריכת שאלה בחלון צף (Alt+E)"}
              aria-label="עריכת שאלה בחלון צף"
              aria-keyshortcuts="Alt+E"
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
                  ? "להפוך לרשות (Alt+R)"
                  : "להפוך לחובה (Alt+R)"
            }
            aria-label={question.required ? "להפוך לרשות" : "להפוך לחובה"}
            aria-keyshortcuts="Alt+R"
            disabled={isFrozen}
            onClick={() => toggle("required")}
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
                  ? "להסתיר מסבב האבחון (Alt+H)"
                  : "להחזיר לסבב האבחון (Alt+H)"
            }
            aria-label={question.enabled ? "להסתיר מסבב האבחון" : "להחזיר לסבב האבחון"}
            aria-keyshortcuts="Alt+H"
            disabled={isFrozen}
            onClick={() => toggle("enabled")}
          >
            <Eye size={17} aria-hidden="true" />
          </button>
          <button
            className="question-icon-button"
            type="button"
            title={isFrozen ? FROZEN_HINT : "שכפול שאלה (Alt+D)"}
            aria-label="שכפול שאלה"
            aria-keyshortcuts="Alt+D"
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
          {getAnswerScale(question.scaleId).label}
        </span>
      </div>
    </article>
  );
}
