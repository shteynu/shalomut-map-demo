import { ManagerOnboarding } from "@/components/manager";
import { DashboardMapPage } from "@/components/dashboard";
import { loadManagerContext } from "@/lib/server/manager-context";
import { surveyInstrument } from "@/lib/shalomut-source";

export default async function DashboardPage() {
  const context = await loadManagerContext();

  if (
    !context.organization ||
    !context.currentRound ||
    !context.analytics
  ) {
    return (
      <ManagerOnboarding
        organizationName={context.organization?.name}
        surface="dashboard"
        state={context.state}
      />
    );
  }

  const { organization, currentRound, analytics } = context;
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

  return (
    <DashboardMapPage
      roundId={currentRound.id}
      organizationName={organization.name}
      roundTitle={currentRound.title}
      responseCount={context.responseCount}
      minimumResponses={currentRound.privacyThreshold}
      overallScore={overallScore}
      dimensionScores={dimensionScores}
    />
  );
}
