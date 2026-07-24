import { ManagerOnboarding } from "@/components/manager";
import { SurveyBuilder } from "@/components/survey";
import { loadManagerContext } from "@/lib/server/manager-context";

export default async function SurveyPage() {
  const context = await loadManagerContext();

  if (!context.organization || !context.currentRound) {
    return <ManagerOnboarding organizationName={context.organization?.name} />;
  }

  return (
    <SurveyBuilder
      organizationName={context.organization.name}
      roundId={context.currentRound.id}
      roundTitle={context.currentRound.title}
      shareCode={context.currentRound.shareCode}
      initialMinimumResponses={context.currentRound.privacyThreshold}
    />
  );
}
