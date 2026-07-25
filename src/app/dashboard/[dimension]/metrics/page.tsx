import { notFound } from "next/navigation";
import { DashboardMetricsPage } from "@/components/dashboard";
import { ManagerOnboarding } from "@/components/manager";
import { getDimensionById, getDimensionStaticParams } from "@/lib/demo-data";
import { loadManagerContext } from "@/lib/server/manager-context";

export const dynamicParams = false;

export function generateStaticParams() {
  return getDimensionStaticParams();
}

export default async function DimensionMetricsPage({
  params,
}: {
  params: Promise<{ dimension: string }>;
}) {
  const { dimension } = await params;
  const entry = getDimensionById(dimension);
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
    <DashboardMetricsPage
      dimension={entry}
      roundId={context.currentRound.id}
      organizationName={context.organization.name}
      roundTitle={context.currentRound.title}
    />
  );
}
