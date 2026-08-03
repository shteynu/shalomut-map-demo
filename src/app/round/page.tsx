import { ManagerOnboarding } from "@/components/manager";
import { MetricCard, PageIntro } from "@/components/ui";
import { RoundControls, RoundThresholdNextStep } from "@/components/round";
import { loadManagerContext } from "@/lib/server/manager-context";
import { MINIMUM_PRIVACY_THRESHOLD } from "@/lib/survey-definition";

const dateFormatter = new Intl.DateTimeFormat("he-IL", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

export default async function RoundPage() {
  const context = await loadManagerContext();

  if (!context.organization || !context.selectedRound) {
    return (
      <ManagerOnboarding
        organizationName={context.organization?.name}
        state={context.state}
      />
    );
  }

  const { organization, selectedRound, responseCount } = context;

  return (
    <div className="page stone-page">
      <PageIntro
        eyebrow={`${organization.name}, ${selectedRound.title}`}
        title="מעקב סבב אבחון"
        description="מסך המעקב מציג כמות תשובות בלבד. אין בו רשימת משיבים, שמות, מיילים או פרטים מזהים."
      />

      <section className="metric-grid" aria-label="נתוני סבב אבחון">
        <MetricCard className="stone-variant-navy" value={dateFormatter.format(selectedRound.startDate)} label="פתיחה" helper="מועד הפצת הלינק" />
        <MetricCard className="stone-variant-green" value={selectedRound.endDate ? dateFormatter.format(selectedRound.endDate) : "לא נקבע"} label="סגירה" helper="סיום איסוף מתוכנן" />
        <MetricCard className="stone-variant-orange" value={`${responseCount}`} label="תשובות" helper="מספר מצרפי בלבד" />
        <MetricCard
          className="stone-variant-teal"
          value={`${selectedRound.privacyThreshold}`}
          label="סף פרטיות"
          helper={
            selectedRound.privacyThreshold < MINIMUM_PRIVACY_THRESHOLD
              ? `הגנה על אנונימיות — הסף הנדרש ${MINIMUM_PRIVACY_THRESHOLD}`
              : "הגנה על אנונימיות"
          }
          minimumResponses={selectedRound.privacyThreshold}
        />
      </section>

      <RoundControls
        roundId={selectedRound.id}
        shareCode={selectedRound.shareCode}
        responseCount={responseCount}
        expectedResponses={organization.totalStaffCount}
        minimumResponses={selectedRound.privacyThreshold}
        status={selectedRound.status}
      />

      <RoundThresholdNextStep
        roundId={selectedRound.id}
        responseCount={responseCount}
        minimumResponses={selectedRound.privacyThreshold}
      />
    </div>
  );
}
