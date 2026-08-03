import { ManagerOnboarding } from "@/components/manager";
import { SurveyBuilder } from "@/components/survey";
import { loadManagerContext } from "@/lib/server/manager-context";
import { createEmptyDraftSurveyDefinition } from "@/lib/survey-definition";

export default async function SurveyPage() {
  const context = await loadManagerContext();

  if (!context.organization || !context.selectedRound) {
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
      roundId={context.selectedRound.id}
      roundTitle={context.selectedRound.title}
      shareCode={context.selectedRound.shareCode}
      initialDefinition={
        context.selectedRound.surveyDefinition ??
        createEmptyDraftSurveyDefinition(
          context.selectedRound.title,
          context.selectedRound.privacyThreshold,
        )
      }
      isFrozen={context.responseCount > 0 || context.selectedRound.status === "closed"}
    />
  );
}
