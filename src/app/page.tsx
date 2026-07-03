import Link from "next/link";
import { ArrowLeft, ClipboardList, LockKeyhole, Map, Send, Settings2, TrendingUp, TriangleAlert, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { ActionCard } from "@/components/action-card";
import { StatStone } from "@/components/stat-stone";
import { PrivacyTooltip } from "@/components/privacy-tooltip";
import { activeRound, getStatusCount, organization } from "@/lib/demo-data";
import { getNavigationAction, homeActionRouteIds, routeMetadata } from "@/lib/navigation";

const actionIcons: Record<(typeof homeActionRouteIds)[number], LucideIcon> = {
  setup: Settings2,
  round: Send,
  surveyBuilder: ClipboardList,
  dashboard: Map,
};

export default function HomePage() {
  const responsePercent = Math.round((activeRound.responseCount / activeRound.expectedResponses) * 100);
  const startSetupAction = getNavigationAction("startSetup");
  const openDashboardAction = getNavigationAction("openDashboard");

  return (
    <div className="page stone-page home-page">
      <section className="page-intro">
        <div>
          <p className="eyebrow">{`${organization.name}, ${activeRound.period}`}</p>
          <h1>שלום {organization.managerName},</h1>
          <p className="home-hero-subtitle">תמונת סבב האבחון מוכנה.</p>
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
          value={`${activeRound.responseCount}/${activeRound.expectedResponses}`}
          label="השיבו עד כה"
          helper={`${responsePercent}% מצוות בית הספר`}
          shape={1}
          tint="var(--pastel-lavender)"
          rotate={-2}
          corner={<Users size={22} aria-hidden="true" />}
        />
        <StatStone
          value={`${activeRound.minimumResponses}`}
          label="סף פרטיות"
          helper="מינימום תשובות לפני הצגת תוצאות"
          shape={2}
          tint="var(--pastel-sky)"
          rotate={3}
          corner={<PrivacyTooltip />}
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

      <section className="home-action-grid" aria-label="זרימת הדמו">
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
