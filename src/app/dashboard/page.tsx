import { ManagerOnboarding } from "@/components/manager";
import { DashboardMapPage } from "@/components/dashboard";
import { loadManagerContext } from "@/lib/server/manager-context";
import { surveyInstrument } from "@/lib/shalomut-source";

export default async function DashboardPage() {
  const context = await loadManagerContext();

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

  return (
    <DashboardMapPage
      roundId={selectedRound.id}
      organizationName={organization.name}
      roundTitle={selectedRound.title}
      responseCount={context.responseCount}
      minimumResponses={selectedRound.privacyThreshold}
      overallScore={overallScore}
      dimensionScores={dimensionScores}
    />
  );
}
