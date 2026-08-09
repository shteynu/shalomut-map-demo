import { ManagerOnboarding } from "@/components/manager";
import { DashboardMapPage } from "@/components/dashboard";
import { toRoundSwitcherOptions } from "@/lib/rounds/round-options";
import { readRoundParam, roundSwitcherAction } from "@/lib/navigation";
import {
  loadManagerContext,
  loadRoundComparison,
  loadSchoolChoices,
} from "@/lib/server/manager-context";
import { surveyInstrument } from "@/lib/shalomut-source";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ round?: string | string[] }>;
}) {
  const requestedRound = readRoundParam(await searchParams);
  const context = await loadManagerContext(requestedRound);

  if (
    !context.organization ||
    !context.selectedRound ||
    !context.analytics
  ) {
    return (
      <ManagerOnboarding
        organizationName={context.organization?.name}
        surface="dashboard"
        state={context.state}
        schoolChoices={await loadSchoolChoices(context, requestedRound)}
      />
    );
  }

  const { organization, selectedRound, analytics } = context;
  const dimensionScores = analytics.dimensionScores;
  const overallScore = analytics.isLocked
    ? 0
    : Math.round(
        surveyInstrument.dimensions.reduce(
          (sum, dimension) =>
            sum + dimensionScores[dimension.id].averageScore,
          0,
        ) / surveyInstrument.dimensions.length,
      );

  const comparison = await loadRoundComparison(context);

  return (
    <DashboardMapPage
      roundId={selectedRound.id}
      comparison={comparison}
      organizationName={organization.name}
      roundTitle={selectedRound.title}
      responseCount={context.responseCount}
      minimumResponses={selectedRound.privacyThreshold}
      overallScore={overallScore}
      dimensionScores={dimensionScores}
      roundOptions={toRoundSwitcherOptions(
        context.rounds,
        selectedRound.id,
      )}
      roundSwitcherAction={roundSwitcherAction("dashboard")}
    />
  );
}
