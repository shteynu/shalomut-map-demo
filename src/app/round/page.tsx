import { ManagerOnboarding } from "@/components/manager";
import { MetricCard, PageIntro } from "@/components/ui";
import { RoundControls } from "@/components/round";
import { loadManagerContext } from "@/lib/server/manager-context";
import { MINIMUM_PRIVACY_THRESHOLD } from "@/lib/survey-definition";

const dateFormatter = new Intl.DateTimeFormat("he-IL", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

export default async function RoundPage() {
  const context = await loadManagerContext();

  if (!context.organization || !context.currentRound) {
    return (
      <ManagerOnboarding
        organizationName={context.organization?.name}
        state={context.state}
      />
    );
  }

  const { organization, currentRound, responseCount } = context;

  return (
    <div className="page stone-page">
      <PageIntro
        eyebrow={`${organization.name}, ${currentRound.title}`}
        title="מעקב סבב אבחון"
        description="מסך המעקב מציג כמות תשובות בלבד. אין בו רשימת משיבים, שמות, מיילים או פרטים מזהים."
      />

      <section className="metric-grid" aria-label="נתוני סבב אבחון">
        <MetricCard className="stone-variant-navy" value={dateFormatter.format(currentRound.startDate)} label="פתיחה" helper="מועד הפצת הלינק" />
        <MetricCard className="stone-variant-green" value={currentRound.endDate ? dateFormatter.format(currentRound.endDate) : "לא נקבע"} label="סגירה" helper="סיום איסוף מתוכנן" />
        <MetricCard className="stone-variant-orange" value={`${responseCount}`} label="תשובות" helper="מספר מצרפי בלבד" />
        <MetricCard
          className="stone-variant-teal"
          value={`${currentRound.privacyThreshold}`}
          label="סף פרטיות"
          helper={
            currentRound.privacyThreshold < MINIMUM_PRIVACY_THRESHOLD
              ? `הגנה על אנונימיות — הסף הנדרש ${MINIMUM_PRIVACY_THRESHOLD}`
              : "הגנה על אנונימיות"
          }
          minimumResponses={currentRound.privacyThreshold}
        />
      </section>

      <RoundControls
        roundId={currentRound.id}
        shareCode={currentRound.shareCode}
        responseCount={responseCount}
        expectedResponses={organization.totalStaffCount}
        minimumResponses={currentRound.privacyThreshold}
        status={currentRound.status}
      />

      <div className="next-step-band">
        <span>אחרי סגירת סבב האבחון, המפה מציגה חוזקות, סיכונים ופירוט לפי ממדים.</span>
      </div>
    </div>
  );
}
