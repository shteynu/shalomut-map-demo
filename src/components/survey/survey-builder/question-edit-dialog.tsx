"use client";

import { useRef, useState } from "react";
import { Check, Eye, Sparkles } from "lucide-react";
import { ModalDialog } from "@/components/ui/modal-dialog";
import { dimensionPresentations } from "@/lib/dashboard/dimension-presentation";
import type { QuestionSuggestionSource } from "./question-suggestions";
import type { BuilderQuestion } from "./types";

type QuestionEditDialogProps = {
  isOpen: boolean;
  question: BuilderQuestion | null;
  questionIndex: number;
  onClose: () => void;
  onSave: (draftKey: string, updater: (q: BuilderQuestion) => BuilderQuestion) => void;
  /**
   * Set when the dialog holds a question that is not in the questionnaire yet,
   * so the heading and the submit button say "adding" rather than "editing".
   * A suggestion is one such draft; a question the manager writes from scratch
   * is the other, and it carries no source label and no edit requirement,
   * because its wording is already theirs.
   */
  isNew?: boolean;
  /**
   * Set when the dialog holds a suggested item that has not joined the
   * questionnaire yet. The text it arrived with is kept so the dialog can
   * require the manager to change it: a suggestion is a draft for a person to
   * rewrite, and adding one unread would put a model's sentence in front of a
   * school as if a person had chosen it.
   */
  suggestion?: {
    source: QuestionSuggestionSource;
    suggestedText: string;
  };
};

const SUGGESTION_LABELS: Record<QuestionSuggestionSource, string> = {
  ai: "נוסח שהוצע על ידי הבינה המלאכותית",
  template: "נוסח מתוך תבנית השאלון המקורית",
};

export function QuestionEditDialog({
  isOpen,
  question,
  questionIndex,
  onClose,
  onSave,
  isNew = false,
  suggestion,
}: QuestionEditDialogProps) {
  const [prevQuestionKey, setPrevQuestionKey] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [dimensionId, setDimensionId] = useState("");
  const [id, setId] = useState("");
  const [required, setRequired] = useState(true);
  const [enabled, setEnabled] = useState(true);
  const [showPreview, setShowPreview] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const currentKey = question ? question.draftKey : null;
  if (currentKey !== prevQuestionKey) {
    setPrevQuestionKey(currentKey);
    if (question) {
      setText(question.text);
      setDimensionId(question.dimensionId);
      setId(question.id);
      setRequired(question.required);
      setEnabled(question.enabled);
      setValidationError(null);
    }
  }

  // The wording is what this dialog is for, so it takes focus rather than the
  // first field in document order. The overlay, the focus trap, Escape and the
  // focus restore all live in `ModalDialog`.
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  if (!isOpen || !question) return null;

  // A suggestion joins the questionnaire only after the manager has changed its
  // wording. Compared on the trimmed text rather than on a "touched" flag, so
  // typing a character and deleting it again does not count as having read it.
  const isUneditedSuggestion = Boolean(
    suggestion && text.trim() === suggestion.suggestedText.trim(),
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) {
      setValidationError("יש להזין נוסח שאלה");
      return;
    }
    if (!id.trim()) {
      setValidationError("יש להזין מזהה קבוע לשאלה");
      return;
    }
    if (isUneditedSuggestion) {
      setValidationError(
        "יש לערוך את נוסח ההצעה לפני הוספתה לשאלון. ההצעה היא טיוטה, והנוסח הסופי באחריות המנהל.",
      );
      return;
    }
    setValidationError(null);
    onSave(question.draftKey, (current) => ({
      ...current,
      text: text.trim(),
      dimensionId: dimensionId as BuilderQuestion["dimensionId"],
      id: id.trim(),
      required,
      enabled,
    }));
    onClose();
  };

  const selectedDimension = dimensionPresentations.find((d) => d.id === dimensionId);

  return (
    <ModalDialog
      isOpen={isOpen}
      title={
        suggestion
          ? "עריכת הצעה לשאלה"
          : isNew
            ? "הוספת שאלה חדשה"
            : `עריכת שאלה ${questionIndex > 0 ? questionIndex : "(ללא מספר)"}`
      }
      onClose={onClose}
      initialFocusRef={textareaRef}
    >
      <>
        {suggestion ? (
          <p className="question-dialog-suggestion-note" role="status">
            <Sparkles size={16} aria-hidden="true" />
            <span>
              <strong>{SUGGESTION_LABELS[suggestion.source]}.</strong>{" "}
              ההצעה היא טיוטה בלבד: יש להתאים את הנוסח לבית הספר לפני ההוספה
              לשאלון.
            </span>
          </p>
        ) : null}

        {validationError ? (
          <p className="survey-submit-error" role="alert">
            {validationError}
          </p>
        ) : null}

        <form onSubmit={handleSubmit} className="modal-dialog-form">
          <label>
            נוסח השאלה המדויק
            <textarea
              ref={textareaRef}
              rows={3}
              required
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                if (validationError) setValidationError(null);
              }}
              dir="rtl"
            />
          </label>

          <div className="builder-form-grid">
            <label>
              ממד שלומות
              <select
                value={dimensionId}
                onChange={(e) => setDimensionId(e.target.value)}
              >
                {dimensionPresentations.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.conceptLabel}
                  </option>
                ))}
              </select>
            </label>

            <label>
              מזהה קבוע
              <input
                type="text"
                dir="ltr"
                required
                value={id}
                onChange={(e) => {
                  setId(e.target.value);
                  if (validationError) setValidationError(null);
                }}
              />
            </label>
          </div>

          <div className="question-dialog-toggles">
            <label className="question-dialog-toggle">
              <input
                type="checkbox"
                checked={required}
                onChange={(e) => setRequired(e.target.checked)}
              />
              שאלת חובה
            </label>

            <label className="question-dialog-toggle">
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
              />
              שאלה פעילה
            </label>
          </div>

          <div>
            <button
              type="button"
              onClick={() => setShowPreview(!showPreview)}
              className="link-button"
              aria-expanded={showPreview}
            >
              <Eye size={14} aria-hidden="true" />
              {showPreview ? "הסתר תצוגה מקדימה" : "תצוגה מקדימה למשיב"}
            </button>
            {showPreview ? (
              <div className="question-dialog-preview">
                <div className="question-dialog-preview-meta">
                  <span>ממד: {selectedDimension?.conceptLabel || dimensionId}</span>
                  <span>{required ? "חובה" : "רשות"}</span>
                </div>
                <p>{text || "(טרם הוזן נוסח שאלה)"}</p>
                <div className="question-dialog-preview-meta">
                  <span>לא מסכים כלל (1)</span>
                  <span>מסכים במידה רבה מאוד (6)</span>
                </div>
              </div>
            ) : null}
          </div>

          <div className="modal-dialog-footer">
            {isUneditedSuggestion ? (
              <p
                className="quiet-note question-dialog-edit-required"
                id="question-dialog-edit-required"
              >
                ההוספה תתאפשר לאחר עריכת הנוסח.
              </p>
            ) : null}
            <button type="button" className="secondary-button" onClick={onClose}>
              ביטול
            </button>
            <button
              type="submit"
              className="primary-button"
              disabled={isUneditedSuggestion}
              aria-describedby={
                isUneditedSuggestion
                  ? "question-dialog-edit-required"
                  : undefined
              }
            >
              <Check size={16} aria-hidden="true" />
              {suggestion || isNew ? "הוספה לשאלון" : "שמירה"}
            </button>
          </div>
        </form>
      </>
    </ModalDialog>
  );
}
