import Link from "next/link";
import { ArrowLeft, ClipboardList, LockKeyhole, Map, Send, Settings2, TrendingUp, TriangleAlert, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { ManagerOnboarding } from "@/components/manager";
import { ActionCard, PrivacyTooltip, StatStone } from "@/components/ui";
import { calculatePercentage } from "@/lib/utils/math";
import { getNavigationAction, homeActionRouteIds, routeMetadata } from "@/lib/navigation";
import { loadManagerContext } from "@/lib/server/manager-context";
import type { WellbeingStatus } from "@/lib/shalomut-source";

const actionIcons: Record<(typeof homeActionRouteIds)[number], LucideIcon> = {
  setup: Settings2,
  round: Send,
  surveyBuilder: ClipboardList,
  dashboard: Map,
};

export default async function HomePage() {
  const context = await loadManagerContext();

  if (!context.organization || !context.currentRound) {
    return (
      <ManagerOnboarding
        organizationName={context.organization?.name}
        state={context.state}
      />
    );
  }

  const { organization, currentRound, responseCount, analytics } = context;
  const responsePercent = calculatePercentage(responseCount, organization.totalStaffCount);
  const startSetupAction = getNavigationAction("startSetup");
  const openDashboardAction = getNavigationAction("openDashboard");
  const getStatusCount = (status: WellbeingStatus) =>
    analytics && !analytics.isLocked
      ? Object.values(analytics.dimensionScores).filter(
          (dimension) => dimension.computedStatus === status,
        ).length
      : 0;

  return (
    <div className="page stone-page home-page">
      <section className="page-intro">
        <div>
          <p className="eyebrow">{`${organization.name}, ${currentRound.title}`}</p>
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
          value={`${currentRound.privacyThreshold}`}
          label="סף פרטיות"
          helper="מינימום תשובות לפני הצגת תוצאות"
          shape={2}
          tint="var(--pastel-sky)"
          rotate={3}
          corner={<PrivacyTooltip minimumResponses={currentRound.privacyThreshold} />}
        />
        <StatStone
          value={`${getStatusCount("red")}`}
          label="מוקדי טיפול"
          helper="אבנים הדורשות התייחסות במפה"
          shape={3}
          tint="var(--pastel-pink)"
          rotate={-4}
          corner={<TriangleAlert size={22} aria-hidden="true" />}
        />
        <StatStone
          value={`${getStatusCount("green")}`}
          label="חוזקות לשימור"
          helper="אבנים במצב טוב במפה"
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
              key={action.href}
              href={action.href}
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
