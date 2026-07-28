import { Settings2 } from "lucide-react";
import { PrivacyThresholdNotice } from "@/components/ui/privacy-threshold-notice";
import { MINIMUM_PRIVACY_THRESHOLD } from "@/lib/survey-definition";

type SettingsPanelProps = {
  title: string;
  setTitle: (value: string) => void;
  /** Derived from the setup screen; shown read-only so it cannot drift. */
  audience: string;
  estimatedMinutes: number;
  setEstimatedMinutes: (value: number) => void;
  minimumResponses: number;
  setMinimumResponses: (value: number) => void;
  introText: string;
  setIntroText: (value: string) => void;
  anonymityText: string;
  setAnonymityText: (value: string) => void;
};

export function SurveyBuilderSettings({
  title,
  setTitle,
  audience,
  estimatedMinutes,
  setEstimatedMinutes,
  minimumResponses,
  setMinimumResponses,
  introText,
  setIntroText,
  anonymityText,
  setAnonymityText,
}: SettingsPanelProps) {
  return (
    <section className="survey-builder-panel survey-builder-settings-panel">
      <div className="survey-builder-heading">
        <div>
          <p className="eyebrow">הגדרות בסיס</p>
          <h2>תצורת שאלון לסבב אבחון</h2>
        </div>
        <span className="status-badge status-green">
          <Settings2 size={16} aria-hidden="true" />
          טיוטת מנהל
        </span>
      </div>

      <div className="builder-form-grid">
        <label>
          שם השאלון
          <input value={title} onChange={(event) => setTitle(event.target.value)} />
        </label>
        <label>
          קהל יעד
          <input value={audience} readOnly aria-describedby="builder-audience-note" />
        </label>
        <label>
          זמן מילוי משוער
          <input
            type="number"
            min="1"
            value={estimatedMinutes}
            onChange={(event) => setEstimatedMinutes(Number(event.target.value) || 0)}
          />
        </label>
        <label>
          סף מינימום להצגת תוצאות
          <input
            type="number"
            min={MINIMUM_PRIVACY_THRESHOLD}
            value={minimumResponses}
            onChange={(event) => setMinimumResponses(Number(event.target.value) || 0)}
          />
        </label>
      </div>

      <p id="builder-audience-note" className="quiet-note">
        קהל היעד נקבע במסך הגדרת סבב האבחון ומוצג כאן לצפייה בלבד, כדי ששני
        המסכים לא יציגו קהל יעד שונה.
      </p>

      <PrivacyThresholdNotice minimumResponses={minimumResponses} />

      <label>
        טקסט פתיחה למשיבים
        <textarea rows={3} value={introText} onChange={(event) => setIntroText(event.target.value)} />
      </label>

      <label>
        הודעת אנונימיות
        <textarea rows={3} value={anonymityText} onChange={(event) => setAnonymityText(event.target.value)} />
      </label>
    </section>
  );
}
