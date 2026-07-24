import { MetricCard, PageIntro } from "@/components/ui";
import { RoundControls } from "@/components/round";
import { activeRound, organization } from "@/lib/demo-data";

export default function RoundPage() {
  return (
    <div className="page stone-page">
      <PageIntro
        eyebrow={`${organization.name}, ${activeRound.period}`}
        title="מעקב סבב אבחון"
        description="מסך המעקב מציג כמות תשובות בלבד. אין בו רשימת משיבים, שמות, מיילים או פרטים מזהים."
      />

      <section className="metric-grid" aria-label="נתוני סבב אבחון">
        <MetricCard className="stone-variant-navy" value={activeRound.openedAt} label="פתיחה" helper="מועד הפצת הלינק" />
        <MetricCard className="stone-variant-green" value={activeRound.closesAt} label="סגירה" helper="סיום איסוף מתוכנן" />
        <MetricCard className="stone-variant-orange" value={`${activeRound.responseCount}`} label="תשובות" helper="מספר מצרפי בלבד" />
        <MetricCard className="stone-variant-teal" value={`${activeRound.minimumResponses}`} label="סף פרטיות" helper="הגנה על אנונימיות" />
      </section>

      <RoundControls />

      <div className="next-step-band">
        <span>אחרי סגירת סבב האבחון, המפה מציגה חוזקות, סיכונים ופירוט לפי ממדים.</span>
      </div>
    </div>
  );
}
