"use client";

import { useRef, useState } from "react";
import { Check, Eye, Plus, Sparkles, Trash2 } from "lucide-react";
import { ModalDialog } from "@/components/ui/modal-dialog";
import { dimensionPresentations } from "@/lib/dashboard/dimension-presentation";
import {
  ANSWER_SCALE_IDS,
  COLOUR_SCALE_ID,
  getAnswerScale,
} from "@/lib/survey/answer-scales";
import type {
  AnswerPolarity,
  AnswerScaleId,
} from "@/lib/survey/answer-scales";
import type {
  BackgroundAnswerMode,
  SurveyQuestionKind,
  SurveyQuestionOption,
} from "@/lib/types/backend";
import type { QuestionSuggestionSource } from "./question-suggestions";
import {
  BACKGROUND_ANSWER_MODES,
  BACKGROUND_ANSWER_MODE_LABELS,
  POLARITY_LABELS,
  QUESTION_KIND_LABELS,
  type BuilderQuestion,
} from "./types";

type QuestionEditDialogProps = {
  isOpen: boolean;
  question: BuilderQuestion | null;
  questionIndex: number;
  /** Section names already in use, offered so a manager reuses rather than retypes. */
  sectionNames?: string[];
  /**
   * The scale an analytic question should start on when this dialog has none to
   * read — a background question whose kind the manager switches to analytic in
   * here. Derived by the builder from the questionnaire in hand
   * (`scaleForNewQuestion`); the fallback is the scale that was the only one
   * before the research instrument.
   */
  defaultScaleId?: AnswerScaleId;
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

const EMPTY_OPTIONS: SurveyQuestionOption[] = [
  { value: "", label: "" },
  { value: "", label: "" },
];

export function QuestionEditDialog({
  isOpen,
  question,
  questionIndex,
  sectionNames = [],
  defaultScaleId = COLOUR_SCALE_ID,
  onClose,
  onSave,
  isNew = false,
  suggestion,
}: QuestionEditDialogProps) {
  const [prevQuestionKey, setPrevQuestionKey] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [kind, setKind] = useState<SurveyQuestionKind>("analytic");
  const [dimensionId, setDimensionId] = useState("");
  const [scaleId, setScaleId] = useState<AnswerScaleId>(defaultScaleId);
  const [polarity, setPolarity] = useState<AnswerPolarity>("positive");
  const [answerMode, setAnswerMode] = useState<BackgroundAnswerMode>("single-choice");
  const [options, setOptions] = useState<SurveyQuestionOption[]>(EMPTY_OPTIONS);
  const [allocationGroupId, setAllocationGroupId] = useState("");
  const [sectionId, setSectionId] = useState("");
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
      setKind(question.kind);
      setId(question.id);
      setRequired(question.required);
      setEnabled(question.enabled);
      setSectionId(question.sectionId ?? "");
      // Each kind's own fields are read from the question when it is that kind
      // and left at their defaults otherwise, so switching kind inside the
      // dialog offers a usable starting point rather than an empty one.
      if (question.kind === "analytic") {
        setDimensionId(question.dimensionId);
        setScaleId(question.scaleId);
        setPolarity(question.polarity);
      } else {
        // A background question carries no scale, and the state must not keep
        // the last analytic question's: switching this one's kind to analytic
        // would then answer it on whatever the manager edited before.
        setScaleId(defaultScaleId);
        setPolarity("positive");
        setAnswerMode(question.answerMode);
        setOptions(
          question.options && question.options.length > 0
            ? question.options
            : EMPTY_OPTIONS,
        );
        setAllocationGroupId(question.allocationGroupId ?? "");
      }
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

  const filledOptions = options.filter(
    (option) => option.value.trim() && option.label.trim(),
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
    // Refused here rather than at save time. The questionnaire endpoint would
    // reject the same thing, but by then the manager has left this dialog and
    // the message names a question they can no longer see.
    if (kind === "background" && answerMode === "single-choice" && filledOptions.length < 2) {
      setValidationError(
        "לשאלת בחירה יחידה נדרשות לפחות שתי אפשרויות תשובה, כל אחת עם ערך ותווית.",
      );
      return;
    }
    if (kind === "background" && answerMode === "allocation-100" && !allocationGroupId.trim()) {
      setValidationError("יש לציין לאיזו טבלת חלוקה השורה שייכת.");
      return;
    }
    if (isUneditedSuggestion) {
      setValidationError(
        "יש לערוך את נוסח ההצעה לפני הוספתה לשאלון. ההצעה היא טיוטה, והנוסח הסופי באחריות המנהל.",
      );
      return;
    }
    setValidationError(null);

    const common = {
      text: text.trim(),
      id: id.trim(),
      required,
      enabled,
      ...(sectionId.trim() ? { sectionId: sectionId.trim() } : {}),
    };

    // Rebuilt rather than spread over the previous question: the two kinds hold
    // different fields, and carrying a dimension onto a background question is
    // exactly what `parseSurveyDefinition` refuses.
    onSave(question.draftKey, (current) =>
      kind === "background"
        ? {
            draftKey: current.draftKey,
            ...common,
            kind: "background",
            answerMode,
            ...(answerMode === "single-choice" ? { options: filledOptions } : {}),
            ...(answerMode === "allocation-100"
              ? { allocationGroupId: allocationGroupId.trim() }
              : {}),
          }
        : {
            draftKey: current.draftKey,
            ...common,
            kind: "analytic",
            dimensionId: dimensionId as Extract<
              BuilderQuestion,
              { kind: "analytic" }
            >["dimensionId"],
            scaleId,
            polarity,
          },
    );
    onClose();
  };

  const selectedDimension = dimensionPresentations.find((d) => d.id === dimensionId);
  const previewScale = getAnswerScale(scaleId);

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

          {/* First of the structural fields, because it decides which of the
              others exist. */}
          <label>
            סוג השאלה
            <select
              value={kind}
              onChange={(e) => {
                setKind(e.target.value as SurveyQuestionKind);
                setValidationError(null);
              }}
            >
              {(["analytic", "background"] as const).map((value) => (
                <option key={value} value={value}>
                  {QUESTION_KIND_LABELS[value]}
                </option>
              ))}
            </select>
            <small className="quiet-note">
              שאלת רקע נשמרת ומוצגת למשיב, אך אינה נכנסת לציון של אף ממד ואינה
              נשלחת לניתוח הבינה המלאכותית.
            </small>
          </label>

          <div className="builder-form-grid">
            {kind === "analytic" ? (
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
            ) : (
              <label>
                אופן המענה
                <select
                  value={answerMode}
                  onChange={(e) => {
                    setAnswerMode(e.target.value as BackgroundAnswerMode);
                    setValidationError(null);
                  }}
                >
                  {BACKGROUND_ANSWER_MODES.map((mode) => (
                    <option key={mode} value={mode}>
                      {BACKGROUND_ANSWER_MODE_LABELS[mode]}
                    </option>
                  ))}
                </select>
              </label>
            )}

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

          {kind === "analytic" ? (
            <div className="builder-form-grid">
              <label>
                סולם התשובות
                <select
                  value={scaleId}
                  onChange={(e) => setScaleId(e.target.value as AnswerScaleId)}
                >
                  {ANSWER_SCALE_IDS.map((value) => (
                    <option key={value} value={value}>
                      {getAnswerScale(value).label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                כיוון הניקוד
                <select
                  value={polarity}
                  onChange={(e) => setPolarity(e.target.value as AnswerPolarity)}
                >
                  {(["positive", "negative"] as const).map((value) => (
                    <option key={value} value={value}>
                      {POLARITY_LABELS[value]}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          ) : null}

          {kind === "background" && answerMode === "allocation-100" ? (
            <label>
              מזהה טבלת החלוקה
              <input
                type="text"
                dir="ltr"
                value={allocationGroupId}
                placeholder="time-allocation"
                onChange={(e) => {
                  setAllocationGroupId(e.target.value);
                  if (validationError) setValidationError(null);
                }}
              />
              <small className="quiet-note">
                שורות עם אותו מזהה הן טבלה אחת, והמשיב מחלק ביניהן 100 בדיוק.
              </small>
            </label>
          ) : null}

          {kind === "background" && answerMode === "single-choice" ? (
            <fieldset className="builder-options-editor">
              <legend>אפשרויות התשובה</legend>
              {options.map((option, index) => (
                <div className="builder-form-grid" key={index}>
                  <label>
                    ערך נשמר
                    <input
                      dir="ltr"
                      value={option.value}
                      onChange={(e) =>
                        setOptions(
                          options.map((current, position) =>
                            position === index
                              ? { ...current, value: e.target.value }
                              : current,
                          ),
                        )
                      }
                    />
                  </label>
                  <label>
                    תווית למשיב
                    <input
                      value={option.label}
                      onChange={(e) =>
                        setOptions(
                          options.map((current, position) =>
                            position === index
                              ? { ...current, label: e.target.value }
                              : current,
                          ),
                        )
                      }
                    />
                  </label>
                  <button
                    type="button"
                    className="ghost-button"
                    disabled={options.length <= 2}
                    onClick={() =>
                      setOptions(options.filter((_, position) => position !== index))
                    }
                  >
                    <Trash2 size={15} aria-hidden="true" />
                    <span className="visually-hidden">{`מחיקת אפשרות ${index + 1}`}</span>
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="ghost-button"
                onClick={() => setOptions([...options, { value: "", label: "" }])}
              >
                <Plus size={15} aria-hidden="true" />
                הוספת אפשרות
              </button>
            </fieldset>
          ) : null}

          {/* Presentation only: nothing is scored or aggregated by section. The
              datalist offers the names already in use, because two sections
              differing by a space would render as two blocks that look the
              same. */}
          <label>
            חלק בשאלון (רשות)
            <input
              type="text"
              list="survey-builder-section-names"
              value={sectionId}
              placeholder="למשל: פרטי רקע"
              onChange={(e) => setSectionId(e.target.value)}
            />
            <datalist id="survey-builder-section-names">
              {sectionNames.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
          </label>

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
                  <span>
                    {kind === "analytic"
                      ? `ממד: ${selectedDimension?.conceptLabel || dimensionId}`
                      : "שאלת רקע"}
                  </span>
                  <span>{required ? "חובה" : "רשות"}</span>
                </div>
                <p>{text || "(טרם הוזן נוסח שאלה)"}</p>
                {/* The anchors the respondent will actually see, read off the
                    chosen scale. This used to be two hardcoded strings naming a
                    1–6 scale that no scale in the product has. */}
                <div className="question-dialog-preview-meta">
                  {kind === "analytic" ? (
                    <>
                      <span>{previewScale.points[0]?.label}</span>
                      <span>
                        {previewScale.points[previewScale.points.length - 1]?.label}
                      </span>
                    </>
                  ) : answerMode === "single-choice" ? (
                    <span>
                      {filledOptions.map((option) => option.label).join(" · ") ||
                        "(טרם הוזנו אפשרויות)"}
                    </span>
                  ) : answerMode === "number" ? (
                    <span>מספר שהמשיב מקליד</span>
                  ) : (
                    <span>שורה בטבלה שסכומה 100</span>
                  )}
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
