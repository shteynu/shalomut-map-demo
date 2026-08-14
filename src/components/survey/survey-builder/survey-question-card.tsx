import type { CSSProperties, KeyboardEvent } from "react";
import { ChevronDown, ChevronUp, ClipboardList, Clock3, Copy, Edit3, Eye, Plus, ShieldCheck, Trash2, Users } from "lucide-react";
import { dimensionPresentations } from "@/lib/dashboard/dimension-presentation";
import { ANSWER_SCALE_IDS, getAnswerScale } from "@/lib/survey/answer-scales";
import { questionAcceleratorFor } from "./keyboard-accelerators";
import {
  BACKGROUND_ANSWER_MODE_LABELS,
  BACKGROUND_ANSWER_MODES,
  POLARITY_LABELS,
  type BuilderAnalyticQuestion,
  type BuilderBackgroundQuestion,
  type BuilderQuestion,
} from "./types";

function getDimensionLabel(dimensionId: string) {
  return dimensionPresentations.find((dimension) => dimension.id === dimensionId)?.conceptLabel ?? dimensionId;
}

function getDimensionColor(dimensionId: string) {
  return dimensionPresentations.find((dimension) => dimension.id === dimensionId)?.conceptColor ?? "#e49902";
}

/**
 * A background question has no dimension and therefore no dimension colour.
 * One neutral stone rather than a borrowed one: the eight colours mean
 * "belongs to this dimension" everywhere else in the product, and lending one
 * to a question about commute time would be the first place that stopped being
 * true.
 */
const BACKGROUND_COLOR = "var(--muted)";

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

/**
 * Change a background question's answer mode and drop whatever the old mode
 * owned that the new one cannot hold.
 *
 * Leaving them behind is what makes an unsaveable questionnaire: `options: []`
 * on a `number` question is refused by `parseSurveyDefinition` with a message
 * about options the manager never sees a field for, and an
 * `allocationGroupId` on anything but a grid is refused outright.
 */
export function withAnswerMode(
  question: BuilderBackgroundQuestion,
  answerMode: BuilderBackgroundQuestion["answerMode"],
): BuilderBackgroundQuestion {
  const { options: _options, allocationGroupId: _group, ...rest } = question;

  return {
    ...rest,
    answerMode,
    ...(answerMode === "single-choice"
      ? { options: question.options ?? [{ value: "", label: "" }, { value: "", label: "" }] }
      : {}),
    ...(answerMode === "allocation-100"
      ? { allocationGroupId: question.allocationGroupId ?? "" }
      : {}),
  };
}

type OptionsEditorProps = {
  question: BuilderBackgroundQuestion;
  questionIndex: number;
  isFrozen: boolean;
  onChange: (
    updater: (current: BuilderBackgroundQuestion) => BuilderBackgroundQuestion,
  ) => void;
};

/**
 * The answers a respondent picks from. Each row is a stored value and the label
 * shown beside it, kept apart on purpose: the label is what a teacher reads and
 * a manager may reword at any time, while the value is what lands in
 * `question_answers` and cannot move once a round has collected one.
 */
function OptionsEditor({
  question,
  questionIndex,
  isFrozen,
  onChange,
}: OptionsEditorProps) {
  const options = question.options ?? [];

  const setOptions = (next: typeof options) =>
    onChange((current) => ({ ...current, options: next }));

  return (
    <fieldset className="builder-options-editor">
      <legend>אפשרויות התשובה</legend>
      {options.map((option, index) => (
        <div className="builder-form-grid" key={index}>
          <label>
            ערך נשמר
            <input
              dir="ltr"
              value={option.value}
              readOnly={isFrozen}
              title={isFrozen ? FROZEN_HINT : undefined}
              onChange={(event) =>
                setOptions(
                  options.map((current, position) =>
                    position === index
                      ? { ...current, value: event.target.value }
                      : current,
                  ),
                )
              }
              aria-label={`ערך אפשרות ${index + 1} בשאלה ${questionIndex}`}
            />
          </label>
          <label>
            תווית למשיב
            <input
              value={option.label}
              readOnly={isFrozen}
              title={isFrozen ? FROZEN_HINT : undefined}
              onChange={(event) =>
                setOptions(
                  options.map((current, position) =>
                    position === index
                      ? { ...current, label: event.target.value }
                      : current,
                  ),
                )
              }
              aria-label={`תווית אפשרות ${index + 1} בשאלה ${questionIndex}`}
            />
          </label>
          <button
            type="button"
            className="ghost-button"
            disabled={isFrozen || options.length <= 2}
            title={
              options.length <= 2
                ? "לשאלת בחירה נדרשות לפחות שתי אפשרויות"
                : "מחיקת אפשרות"
            }
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
        disabled={isFrozen}
        onClick={() => setOptions([...options, { value: "", label: "" }])}
      >
        <Plus size={15} aria-hidden="true" />
        הוספת אפשרות
      </button>
    </fieldset>
  );
}

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
   * The two narrowed updaters the fields below use.
   *
   * `onUpdate` is typed over the union, so a control that only makes sense for
   * one kind would otherwise have to widen its result back to the union and
   * hope. These check the kind at the moment the change is applied — the card
   * could in principle have been re-rendered for another question by then —
   * and return the question untouched when it no longer matches.
   */
  function updateAnalytic(
    updater: (current: BuilderAnalyticQuestion) => BuilderAnalyticQuestion,
  ) {
    onUpdate(question.draftKey, (current) =>
      current.kind === "analytic" ? updater(current) : current,
    );
  }

  function updateBackground(
    updater: (current: BuilderBackgroundQuestion) => BuilderBackgroundQuestion,
  ) {
    onUpdate(question.draftKey, (current) =>
      current.kind === "background" ? updater(current) : current,
    );
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
      style={
        {
          "--question-color":
            question.kind === "analytic"
              ? getDimensionColor(question.dimensionId)
              : BACKGROUND_COLOR,
        } as CSSProperties
      }
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
          <strong className="survey-builder-dimension-stone">
            {question.kind === "analytic"
              ? getDimensionLabel(question.dimensionId)
              : "שאלת רקע"}
          </strong>
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
        {question.kind === "analytic" ? (
          <label>
            ממד שלומות
            <select
              value={question.dimensionId}
              disabled={isFrozen}
              title={isFrozen ? FROZEN_HINT : undefined}
              onChange={(event) =>
                updateAnalytic((current) => ({
                  ...current,
                  dimensionId: event.target
                    .value as BuilderAnalyticQuestion["dimensionId"],
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
        ) : (
          <label>
            אופן המענה
            <select
              value={question.answerMode}
              disabled={isFrozen}
              title={isFrozen ? FROZEN_HINT : undefined}
              onChange={(event) =>
                updateBackground((current) =>
                  withAnswerMode(current, event.target.value as BuilderBackgroundQuestion["answerMode"]),
                )
              }
              aria-label={`אופן המענה לשאלה ${questionIndex}`}
            >
              {BACKGROUND_ANSWER_MODES.map((mode) => (
                <option key={mode} value={mode}>
                  {BACKGROUND_ANSWER_MODE_LABELS[mode]}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      {question.kind === "analytic" ? (
        <div className="builder-form-grid">
          <label>
            סולם התשובות
            <select
              value={question.scaleId}
              disabled={isFrozen}
              title={isFrozen ? FROZEN_HINT : undefined}
              onChange={(event) =>
                updateAnalytic((current) => ({
                  ...current,
                  scaleId: event.target.value as BuilderAnalyticQuestion["scaleId"],
                }))
              }
              aria-label={`סולם התשובות לשאלה ${questionIndex}`}
            >
              {ANSWER_SCALE_IDS.map((scaleId) => (
                <option key={scaleId} value={scaleId}>
                  {getAnswerScale(scaleId).label}
                </option>
              ))}
            </select>
          </label>
          {/* Named by what it does to the score rather than by "positive" and
              "negative", which read as a judgement about the question. */}
          <label>
            כיוון הניקוד
            <select
              value={question.polarity}
              disabled={isFrozen}
              title={isFrozen ? FROZEN_HINT : undefined}
              onChange={(event) =>
                updateAnalytic((current) => ({
                  ...current,
                  polarity: event.target.value as BuilderAnalyticQuestion["polarity"],
                }))
              }
              aria-label={`כיוון הניקוד לשאלה ${questionIndex}`}
            >
              {(["positive", "negative"] as const).map((polarity) => (
                <option key={polarity} value={polarity}>
                  {POLARITY_LABELS[polarity]}
                </option>
              ))}
            </select>
          </label>
        </div>
      ) : null}

      {question.kind === "background" && question.answerMode === "allocation-100" ? (
        <label>
          מזהה הטבלה שהשורה שייכת לה
          <input
            dir="ltr"
            value={question.allocationGroupId ?? ""}
            readOnly={isFrozen}
            title={isFrozen ? FROZEN_HINT : undefined}
            placeholder="time-allocation"
            onChange={(event) =>
              updateBackground((current) => ({
                ...current,
                allocationGroupId: event.target.value,
              }))
            }
            aria-label={`מזהה הטבלה לשאלה ${questionIndex}`}
          />
          <small className="quiet-note">
            שורות עם אותו מזהה הן טבלה אחת, והמשיב מחלק ביניהן 100 בדיוק. נדרשות
            לפחות שתי שורות.
          </small>
        </label>
      ) : null}

      {question.kind === "background" && question.answerMode === "single-choice" ? (
        <OptionsEditor
          question={question}
          questionIndex={questionIndex}
          isFrozen={isFrozen}
          onChange={updateBackground}
        />
      ) : null}

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
        {question.kind === "analytic" ? (
          <>
            <span className="status-badge status-yellow">
              <Clock3 size={15} aria-hidden="true" />
              {getAnswerScale(question.scaleId).label}
            </span>
            {/* Shown only when it is true. A badge that read "high agreement is
                better" on all twenty-four canonical questions would be noise on
                every card and invisible on the one card it matters for. */}
            {question.polarity === "negative" ? (
              <span className="status-badge status-red">
                <ShieldCheck size={15} aria-hidden="true" />
                ניקוד הפוך
              </span>
            ) : null}
          </>
        ) : (
          <span className="status-badge status-yellow">
            <Users size={15} aria-hidden="true" />
            {BACKGROUND_ANSWER_MODE_LABELS[question.answerMode]}
          </span>
        )}
      </div>
    </article>
  );
}
