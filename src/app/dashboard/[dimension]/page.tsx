import { notFound } from "next/navigation";
import { DashboardDimensionPage } from "@/components/dashboard";
import { ManagerOnboarding } from "@/components/manager";
import {
  getDimensionPresentation,
  getDimensionStaticParams,
} from "@/lib/dashboard/dimension-presentation";
import { readRoundParam } from "@/lib/navigation";
import {
  loadManagerContext,
  loadSchoolChoices,
} from "@/lib/server/manager-context";

export const dynamicParams = false;

export function generateStaticParams() {
  return getDimensionStaticParams();
}

export default async function DimensionPage({
  params,
  searchParams,
}: {
  params: Promise<{ dimension: string }>;
  searchParams: Promise<{ round?: string | string[] }>;
}) {
  const { dimension } = await params;
  const entry = getDimensionPresentation(dimension);
  const requestedRound = readRoundParam(await searchParams);
  const context = await loadManagerContext(requestedRound);

  if (!entry) {
    notFound();
  }

  if (!context.organization || !context.selectedRound) {
    return (
      <ManagerOnboarding
        organizationName={context.organization?.name}
        surface="dashboard"
        state={context.state}
        schoolChoices={await loadSchoolChoices(context, requestedRound)}
      />
    );
  }

  return (
    <DashboardDimensionPage
      dimension={entry}
      roundId={context.selectedRound.id}
      organizationName={context.organization.name}
      roundTitle={context.selectedRound.title}
    />
  );
}
