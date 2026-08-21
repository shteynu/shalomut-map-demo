import Link from "next/link";
import { ArrowLeft, ClipboardList, Layers, LockKeyhole, Map, Send, Settings2, Target, TrendingUp, TriangleAlert, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { ManagerOnboarding } from "@/components/manager";
import { RoundSwitcher } from "@/components/round";
import { ActionCard, PrivacyTooltip, StatStone } from "@/components/ui";
import { describeStatusStone } from "@/lib/dashboard/status-stone-value";
import { calculatePercentage } from "@/lib/utils/math";
import {
  getNavigationAction,
  homeActionRouteIds,
  readRoundParam,
  roundSwitcherAction,
  routeHrefForRound,
  routeMetadata,
} from "@/lib/navigation";
import { toRoundSwitcherOptions } from "@/lib/rounds/round-options";
import { isRoundCollecting } from "@/lib/rounds/round-status";
import {
  loadManagerContext,
  loadSchoolChoices,
} from "@/lib/server/manager-context";
import type { WellbeingStatus } from "@/lib/shalomut-source";

const actionIcons: Record<(typeof homeActionRouteIds)[number], LucideIcon> = {
  setup: Settings2,
  round: Send,
  surveyBuilder: ClipboardList,
  dashboard: Map,
  breakdown: Layers,
  goals: Target,
};

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ round?: string | string[] }>;
}) {
  const requestedRound = readRoundParam(await searchParams);
  const context = await loadManagerContext(requestedRound);

  if (!context.organization || !context.selectedRound) {
    return (
      <ManagerOnboarding
        organizationName={context.organization?.name}
        state={context.state}
        schoolChoices={await loadSchoolChoices(context, requestedRound)}
      />
    );
  }

  const { organization, selectedRound, responseCount, analytics } = context;
  const responsePercent = calculatePercentage(responseCount, organization.totalStaffCount);
  const startSetupAction = getNavigationAction("startSetup");
  const openDashboardAction = getNavigationAction("openDashboard", selectedRound.id);
  // `null` rather than `0` while the map is locked: zero problem areas is a
  // claim about the school, and a round nobody has answered yet has not made
  // it. `describeStatusStone` turns the absence into what the stone shows.
  const getStatusCount = (status: WellbeingStatus) =>
    analytics && !analytics.isLocked
      ? Object.values(analytics.dimensionScores).filter(
          (dimension) => dimension.computedStatus === status,
        ).length
      : null;
  const treatmentStone = describeStatusStone(
    getStatusCount("red"),
    selectedRound.privacyThreshold,
    "אבנים הדורשות התייחסות במפה",
    isRoundCollecting(selectedRound.status),
  );
  const strengthStone = describeStatusStone(
    getStatusCount("green"),
    selectedRound.privacyThreshold,
    "אבנים במצב טוב במפה",
    isRoundCollecting(selectedRound.status),
  );

  return (
    <div className="page stone-page home-page">
      <section className="page-intro">
        <div>
          <p className="eyebrow">{`${organization.name}, ${selectedRound.title}`}</p>
          <h1>שלום,</h1>
          <p className="home-hero-subtitle">תמונת סבב האבחון מחוברת לנתוני בית הספר.</p>
        </div>
        <div className="intro-actions">
          <Link className="primary-button" href={startSetupAction.href}>
            {startSetupAction.label}
            <ArrowLeft size={18} aria-hidden="true" />
          </Link>
          <Link className="secondary-button" href={openDashboardAction.href}>
            {openDashboardAction.label}
            <Map size={18} aria-hidden="true" />
          </Link>
        </div>
      </section>

      {/* The school's rounds, so the screen a manager lands on is also the way
          back to the round before this one. */}
      <RoundSwitcher
        options={toRoundSwitcherOptions(
          context.rounds,
          selectedRound.id,
        )}
        action={roundSwitcherAction("home")}
      />

      <section className="home-stat-grid" aria-label="מדדי סבב אבחון">
        <StatStone
          value={`${responseCount}/${organization.totalStaffCount}`}
          label="השיבו עד כה"
          helper={`${responsePercent}% מצוות בית הספר`}
          shape={1}
          tint="var(--pastel-lavender)"
          rotate={-2}
          corner={<Users size={22} aria-hidden="true" />}
        />
        <StatStone
          value={`${selectedRound.privacyThreshold}`}
          label="סף פרטיות"
          helper="מינימום תשובות לפני הצגת תוצאות"
          shape={2}
          tint="var(--pastel-sky)"
          rotate={3}
          corner={<PrivacyTooltip minimumResponses={selectedRound.privacyThreshold} />}
        />
        <StatStone
          value={treatmentStone.value}
          screenReaderValue={treatmentStone.screenReaderValue}
          label="מוקדי טיפול"
          helper={treatmentStone.helper}
          shape={3}
          tint="var(--pastel-pink)"
          rotate={-4}
          corner={<TriangleAlert size={22} aria-hidden="true" />}
        />
        <StatStone
          value={strengthStone.value}
          screenReaderValue={strengthStone.screenReaderValue}
          label="חוזקות לשימור"
          helper={strengthStone.helper}
          shape={4}
          tint="var(--pastel-green)"
          rotate={1}
          corner={<TrendingUp size={22} aria-hidden="true" />}
        />
      </section>

      <section className="home-action-grid" aria-label="זרימת העבודה">
        {homeActionRouteIds.map((routeId) => {
          const action = routeMetadata[routeId];
          const Icon = actionIcons[routeId];
          return (
            <ActionCard
              key={action.id}
              href={routeHrefForRound(routeId, selectedRound.id)}
              title={action.actionTitle}
              body={action.actionBody ?? action.navLabel}
              icon={<Icon size={26} />}
              glow={action.actionGlow ?? "var(--pastel-peach)"}
            />
          );
        })}
      </section>

      <section className="privacy-band">
        <LockKeyhole size={24} aria-hidden="true" />
        <div>
          <h2>פרטיות כברירת מחדל</h2>
          <p>המערכת מציגה רק נתונים מצרפיים. מנהלת בית הספר רואה כמה ענו, לא מי ענה.</p>
        </div>
      </section>
    </div>
  );
}
