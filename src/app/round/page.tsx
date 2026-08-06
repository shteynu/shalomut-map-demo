import { ManagerOnboarding } from "@/components/manager";
import { MetricCard, PageIntro } from "@/components/ui";
import {
  RoundControls,
  RoundSwitcher,
  RoundThresholdNextStep,
} from "@/components/round";
import { readRoundParam, roundSwitcherAction } from "@/lib/navigation";
import { toRoundSwitcherOptions } from "@/lib/rounds/round-options";
import { loadManagerContext } from "@/lib/server/manager-context";
import { isSelectedRoundCurrent } from "@/lib/services";
import { MINIMUM_PRIVACY_THRESHOLD } from "@/lib/survey-definition";

const dateFormatter = new Intl.DateTimeFormat("he-IL", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

export default async function RoundPage({
  searchParams,
}: {
  searchParams: Promise<{ round?: string | string[] }>;
}) {
  const context = await loadManagerContext(readRoundParam(await searchParams));

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

      <RoundSwitcher
        options={toRoundSwitcherOptions(
          context.rounds,
          selectedRound.id,
        )}
        action={roundSwitcherAction("round")}
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

      {/*
        Keyed by the round. Both of these copy the round into state — whether
        it is closed, what the analysis is doing — and switching rounds is a
        client navigation, which reuses a component rather than remounting it.
        Without the key an earlier round would be read through the state of the
        one the manager came from.

        The two keys are prefixed because they are siblings: the round id alone
        appeared twice in one parent, and React answered by rendering both
        rounds' controls at once.
      */}
      <RoundControls
        key={`controls-${selectedRound.id}`}
        roundId={selectedRound.id}
        shareCode={selectedRound.shareCode}
        responseCount={responseCount}
        expectedResponses={organization.totalStaffCount}
        minimumResponses={selectedRound.privacyThreshold}
        status={selectedRound.status}
        isSuperseded={!isSelectedRoundCurrent(context)}
      />

      <RoundThresholdNextStep
        key={`next-step-${selectedRound.id}`}
        roundId={selectedRound.id}
        responseCount={responseCount}
        minimumResponses={selectedRound.privacyThreshold}
      />
    </div>
  );
}
