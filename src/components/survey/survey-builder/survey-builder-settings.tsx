import { Settings2 } from "lucide-react";

type SettingsPanelProps = {
  title: string;
  setTitle: (value: string) => void;
  audience: string;
  setAudience: (value: string) => void;
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
  setAudience,
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
          <input value={audience} onChange={(event) => setAudience(event.target.value)} />
        </label>
        <label>
          זמן מילוי משוער
          <input
            type="number"
            value={estimatedMinutes}
            onChange={(event) => setEstimatedMinutes(Number(event.target.value) || 0)}
          />
        </label>
        <label>
          סף מינימום להצגת תוצאות
          <input
            type="number"
            value={minimumResponses}
            onChange={(event) => setMinimumResponses(Number(event.target.value) || 0)}
          />
        </label>
      </div>

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
