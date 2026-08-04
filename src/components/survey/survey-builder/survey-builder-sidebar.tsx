import Link from "next/link";
import { Clipboard, Copy, Eye, Plus, ShieldCheck } from "lucide-react";
import type { CSSProperties, RefObject } from "react";
import { CopyLinkStatus } from "@/components/ui/copy-link-status";
import type { ClipboardStatus } from "@/lib/hooks/use-clipboard";
import { dimensionPresentations } from "@/lib/dashboard/dimension-presentation";
import { responseScale } from "@/lib/shalomut-source";
import { getNavigationAction } from "@/lib/navigation";
import type { QuestionSuggestion } from "./question-suggestions";

function getDimensionLabel(dimensionId: string) {
  return dimensionPresentations.find((dimension) => dimension.id === dimensionId)?.conceptLabel ?? dimensionId;
}

function getDimensionColor(dimensionId: string) {
  return dimensionPresentations.find((dimension) => dimension.id === dimensionId)?.conceptColor ?? "#e49902";
}

type SidebarProps = {
  shareUrl: string;
  copyStatus: ClipboardStatus;
  /** Selected for a manual copy when the browser blocks the clipboard. */
  shareInputRef: RefObject<HTMLInputElement | null>;
  onCopyRespondentLink: () => void;
  templateSuggestion: QuestionSuggestion | null;
  onSuggestFromTemplate: () => void;
  isFrozen?: boolean;
  saved: boolean;
  /** Rounds this save took off the air, if saving activated this one. */
  closedRoundTitles?: string[];
  questionnaireReady: boolean;
};

export function SurveyBuilderSidebar({
  shareUrl,
  copyStatus,
  shareInputRef,
  onCopyRespondentLink,
  templateSuggestion,
  onSuggestFromTemplate,
  isFrozen = false,
  saved,
  closedRoundTitles = [],
  questionnaireReady,
}: SidebarProps) {
  const openRespondentSurveyAction = getNavigationAction("openRespondentSurvey");

  return (
    <aside className="survey-builder-side">
      <section className="survey-builder-panel survey-builder-share-panel">
        <div className="survey-builder-heading">
          <div>
            <p className="eyebrow">הפצה חיצונית</p>
            <h2>קישור משיבים</h2>
          </div>
          <span className="status-badge status-green">
            <ShieldCheck size={16} aria-hidden="true" />
            נפרד ממסכי הניהול
          </span>
        </div>

        <div className="copy-row">
          <input
            ref={shareInputRef}
            readOnly
            dir="ltr"
            value={shareUrl}
            aria-label="קישור משיבים חיצוני"
          />
          <button className="icon-button" type="button" onClick={onCopyRespondentLink} aria-label="העתקת קישור">
            <Clipboard size={18} aria-hidden="true" />
          </button>
        </div>

        <CopyLinkStatus
          status={copyStatus}
          successText="קישור המשיבים הועתק ומוכן לשליחה לצוות."
        />

        <div className="round-actions">
          <Link className="secondary-button" href={shareUrl} target="_blank" rel="noreferrer">
            {openRespondentSurveyAction.label}
            <Eye size={18} aria-hidden="true" />
          </Link>
          <button className="ghost-button" type="button" onClick={onCopyRespondentLink}>
            העתקת קישור
            <Copy size={18} aria-hidden="true" />
          </button>
        </div>
      </section>

      <section className="survey-builder-panel survey-builder-legend-panel">
        <div className="survey-builder-heading">
          <div>
            <p className="eyebrow">מקרא מענה</p>
            <h2>אפשרויות תשובה</h2>
          </div>
        </div>

        <div className="builder-response-list">
          {responseScale.map((option) => (
            <article key={option.value} className={`legend-card option-${option.value}`}>
              <strong>{option.title}</strong>
              <span>{option.text}</span>
            </article>
          ))}
        </div>
      </section>

      <section className="survey-builder-panel survey-builder-library-panel">
        <div className="survey-builder-heading">
          <div>
            <p className="eyebrow">היגד מהתבנית המקורית</p>
            <h2>ספריית שאלות</h2>
          </div>
        </div>

        {templateSuggestion ? (
          <article
            className="survey-builder-suggestion"
            style={{ "--suggestion-color": getDimensionColor(templateSuggestion.dimensionId) } as CSSProperties}
          >
            <strong className="survey-builder-dimension-stone">
              {getDimensionLabel(templateSuggestion.dimensionId)}
            </strong>
            <p>{templateSuggestion.text}</p>
            <button
              className="secondary-button"
              type="button"
              onClick={onSuggestFromTemplate}
              disabled={isFrozen}
            >
              עריכה והוספה
              <Plus size={18} aria-hidden="true" />
            </button>
          </article>
        ) : (
          <p className="quiet-note">
            כל היגדי התבנית בממד הנבחר נמצאים כבר בשאלון. אפשר לבקש הצעה
            מהבינה המלאכותית או לנסח שאלה חדשה.
          </p>
        )}

        {saved ? <p className="success-note">טיוטת השאלון נשמרה וניתן להמשיך להפצה.</p> : null}
        {saved && closedRoundTitles.length > 0 ? (
          <p className="success-note" role="status">
            {`השאלון הושלם, הסבב הזה עלה לאוויר ו${
              closedRoundTitles.length > 1 ? "הסבבים" : "הסבב"
            } ${closedRoundTitles.join(", ")} נסגר${
              closedRoundTitles.length > 1 ? "ו" : ""
            }. בית ספר מריץ סבב אחד בכל רגע נתון.`}
          </p>
        ) : null}
        {!questionnaireReady ? (
          <p className="quiet-note">
            ההפעלה תתאפשר לאחר תיקון מזהים כפולים וכיסוי כל שמונת ממדי השלומות.
          </p>
        ) : null}
      </section>
    </aside>
  );
}
