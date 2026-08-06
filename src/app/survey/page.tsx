import { ManagerOnboarding } from "@/components/manager";
import { RoundSwitcher } from "@/components/round";
import { SurveyBuilder } from "@/components/survey";
import { readRoundParam, roundSwitcherAction } from "@/lib/navigation";
import { toRoundSwitcherOptions } from "@/lib/rounds/round-options";
import { loadManagerContext } from "@/lib/server/manager-context";
import { createEmptyDraftSurveyDefinition } from "@/lib/survey-definition";

export default async function SurveyPage({
  searchParams,
}: {
  searchParams: Promise<{ round?: string | string[] }>;
}) {
  const context = await loadManagerContext(readRoundParam(await searchParams));

  if (!context.organization || !context.selectedRound) {
    return (
      <ManagerOnboarding
        organizationName={context.organization?.name}
        state={context.state}
      />
    );
  }

  return (
    /*
      Keyed by the round, and here it matters most: the builder holds the whole
      questionnaire in state, seeded once from the round it mounted with.
      Switching rounds is a client navigation, so without the key the manager
      would read the previous round's questions under this round's title.
    */
    <SurveyBuilder
      key={context.selectedRound.id}
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
      lastSavedAt={context.selectedRound.updatedAt?.toISOString()}
      roundSwitcher={
        <RoundSwitcher
          options={toRoundSwitcherOptions(
            context.rounds,
            context.selectedRound.id,
          )}
          action={roundSwitcherAction("surveyBuilder")}
        />
      }
      // An archived round is read-only, and its questionnaire route answers
      // 409. A draft can be archived without ever taking an answer, so the
      // response count does not cover this on its own.
      isFrozen={
        context.responseCount > 0 ||
        context.selectedRound.status === "closed" ||
        context.selectedRound.status === "archived"
      }
    />
  );
}
