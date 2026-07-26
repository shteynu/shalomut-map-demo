import { ManagerOnboarding } from "@/components/manager";
import { SurveyBuilder } from "@/components/survey";
import { loadManagerContext } from "@/lib/server/manager-context";
import { createCanonicalSurveyDefinition } from "@/lib/survey-definition";

export default async function SurveyPage() {
  const context = await loadManagerContext();

  if (!context.organization || !context.currentRound) {
    return (
      <ManagerOnboarding
        organizationName={context.organization?.name}
        state={context.state}
      />
    );
  }

  return (
    <SurveyBuilder
      organizationName={context.organization.name}
      roundId={context.currentRound.id}
      roundTitle={context.currentRound.title}
      shareCode={context.currentRound.shareCode}
      initialDefinition={
        context.currentRound.surveyDefinition ??
        createCanonicalSurveyDefinition(
          context.currentRound.title,
          context.currentRound.privacyThreshold,
        )
      }
      isFrozen={context.responseCount > 0 || context.currentRound.status === "closed"}
    />
  );
}
