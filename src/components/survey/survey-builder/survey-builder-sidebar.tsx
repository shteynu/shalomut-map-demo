import Link from "next/link";
import { Clipboard, Copy, Eye, Plus, ShieldCheck } from "lucide-react";
import type { CSSProperties } from "react";
import { wellbeingDimensions, responseOptions } from "@/lib/demo-data";
import { getNavigationAction } from "@/lib/navigation";
import type { BuilderQuestion } from "./types";

function getDimensionLabel(dimensionId: string) {
  return wellbeingDimensions.find((dimension) => dimension.id === dimensionId)?.conceptLabel ?? dimensionId;
}

function getDimensionColor(dimensionId: string) {
  return wellbeingDimensions.find((dimension) => dimension.id === dimensionId)?.conceptColor ?? "#e49902";
}

type SidebarProps = {
  shareUrl: string;
  copied: boolean;
  onCopyRespondentLink: () => void;
  nextSuggestedQuestion: Omit<BuilderQuestion, "id">;
  onAddQuestionFromBank: () => void;
  saved: boolean;
};

export function SurveyBuilderSidebar({
  shareUrl,
  copied,
  onCopyRespondentLink,
  nextSuggestedQuestion,
  onAddQuestionFromBank,
  saved,
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
          <input readOnly dir="ltr" value={shareUrl} aria-label="קישור משיבים חיצוני" />
          <button className="icon-button" type="button" onClick={onCopyRespondentLink} aria-label="העתקת קישור">
            <Clipboard size={18} aria-hidden="true" />
          </button>
        </div>

        {copied ? <p className="success-note">קישור המשיבים הועתק ומוכן לשליחה לצוות.</p> : null}

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
          {responseOptions.map((option) => (
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
            <p className="eyebrow">שאלה מומלצת הבאה</p>
            <h2>ספריית שאלות</h2>
          </div>
        </div>

        <article
          className="survey-builder-suggestion"
          style={{ "--suggestion-color": getDimensionColor(nextSuggestedQuestion.dimensionId) } as CSSProperties}
        >
          <strong className="survey-builder-dimension-stone">
            {getDimensionLabel(nextSuggestedQuestion.dimensionId)}
          </strong>
          <p>{nextSuggestedQuestion.text}</p>
          <button className="secondary-button" type="button" onClick={onAddQuestionFromBank}>
            הוספת השאלה
            <Plus size={18} aria-hidden="true" />
          </button>
        </article>

        {saved ? <p className="success-note">טיוטת השאלון נשמרה וניתן להמשיך להפצה.</p> : null}
      </section>
    </aside>
  );
}
