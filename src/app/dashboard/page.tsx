import { ManagerOnboarding } from "@/components/manager";
import { DashboardMapPage } from "@/components/dashboard";
import { dividedDimensions } from "@/lib/dashboard/dimension-division";
import { toRoundSwitcherOptions } from "@/lib/rounds/round-options";
import { isRoundCollecting } from "@/lib/rounds/round-status";
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
      divisions={dividedDimensions(analytics.questionAggregates)}
      organizationName={organization.name}
      roundTitle={selectedRound.title}
      responseCount={context.responseCount}
      minimumResponses={selectedRound.privacyThreshold}
      overallScore={overallScore}
      // The same flag `overallScore` above is already guarded by. The map
      // screen used to reach its own verdict from the response count alone,
      // and a round the analysis had locked for another reason arrived there
      // with no dimension scores to draw.
      isLocked={analytics.isLocked}
      // Read off the round rather than carried back from the analysis: the
      // analysis withholds a collecting round, and the screen has to say so
      // instead of promising the map after N more answers.
      isCollecting={isRoundCollecting(selectedRound.status)}
      dimensionScores={dimensionScores}
      roundOptions={toRoundSwitcherOptions(
        context.rounds,
        selectedRound.id,
      )}
      roundSwitcherAction={roundSwitcherAction("dashboard")}
    />
  );
}
