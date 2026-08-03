import { notFound } from "next/navigation";
import { DashboardRecommendationsPage } from "@/components/dashboard";
import { ManagerOnboarding } from "@/components/manager";
import {
  getDimensionPresentation,
  getDimensionStaticParams,
} from "@/lib/dashboard/dimension-presentation";
import { loadManagerContext } from "@/lib/server/manager-context";

export const dynamicParams = false;

export function generateStaticParams() {
  return getDimensionStaticParams();
}

export default async function DimensionRecommendationsPage({
  params,
}: {
  params: Promise<{ dimension: string }>;
}) {
  const { dimension } = await params;
  const entry = getDimensionPresentation(dimension);
  const context = await loadManagerContext();

  if (!entry) {
    notFound();
  }

  if (!context.organization || !context.currentRound) {
    return (
      <ManagerOnboarding
        organizationName={context.organization?.name}
        surface="dashboard"
        state={context.state}
      />
    );
  }

  return (
    <DashboardRecommendationsPage
      dimension={entry}
      roundId={context.currentRound.id}
      organizationName={context.organization.name}
      roundTitle={context.currentRound.title}
    />
  );
}
