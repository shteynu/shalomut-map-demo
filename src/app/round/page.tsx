import Link from "next/link";
import { ArrowLeft, ClipboardList } from "lucide-react";
import { MetricCard, PageIntro } from "@/components/app-shell";
import { RoundControls } from "@/components/round-controls";
import { activeRound, organization } from "@/lib/demo-data";

export default function RoundPage() {
  return (
    <div className="page">
      <PageIntro
        eyebrow="מעקב סבב"
        title={`${organization.name}: ${activeRound.period}`}
        description="מסך המעקב מציג כמות תשובות בלבד. אין בו רשימת משיבים, שמות, מיילים או פרטים מזהים."
        actions={
          <Link className="secondary-button" href="/survey">
            ניהול שאלון
            <ClipboardList size={18} aria-hidden="true" />
          </Link>
        }
      />

      <section className="metric-grid" aria-label="נתוני סבב">
        <MetricCard value={activeRound.openedAt} label="פתיחה" helper="מועד הפצת הלינק" />
        <MetricCard value={activeRound.closesAt} label="סגירה" helper="סיום איסוף מתוכנן" />
        <MetricCard value={`${activeRound.responseCount}`} label="תשובות" helper="מספר מצרפי בלבד" />
        <MetricCard value={`${activeRound.minimumResponses}`} label="סף הצגה" helper="הגנה על אנונימיות" />
      </section>

      <RoundControls />

      <div className="next-step-band">
        <span>אחרי סגירת הסבב, המפה מציגה חוזקות, סיכונים ופירוט לפי ממדים.</span>
        <Link href="/dashboard">
          צפייה בדשבורד
          <ArrowLeft size={16} aria-hidden="true" />
        </Link>
      </div>
    </div>
  );
}
