import { ManagerOnboarding } from "@/components/manager";
import { PageIntro } from "@/components/ui";
import { BreakdownBoard } from "@/components/breakdown";
import {
  breakdownQuestionChoices,
  buildBackgroundBreakdown,
} from "@/lib/analytics/background-breakdown";
import {
  readBreakdownQuestionParam,
  readRoundParam,
  roundSwitcherAction,
} from "@/lib/navigation";
import { RoundSwitcher } from "@/components/round";
import { toRoundSwitcherOptions } from "@/lib/rounds/round-options";
import {
  loadManagerContext,
  loadRoundResponses,
  loadSchoolChoices,
} from "@/lib/server/manager-context";

/**
 * The round's dimension scores, split by one background question.
 *
 * Round-scoped, like the map and unlike the goals screen: a breakdown is a
 * reading of one measurement, and the questionnaire it groups by is that
 * round's own snapshot. A background question exists in the round that asked
 * it, so the chooser is rebuilt per round rather than carried between them.
 */
export default async function BreakdownPage({
  searchParams,
}: {
  searchParams: Promise<{ round?: string | string[]; question?: string | string[] }>;
}) {
  const params = await searchParams;
  const requestedRound = readRoundParam(params);
  const requestedQuestion = readBreakdownQuestionParam(params);
  const context = await loadManagerContext(requestedRound);

  if (!context.organization || !context.selectedRound || !context.analytics) {
    return (
      <ManagerOnboarding
        organizationName={context.organization?.name}
        state={context.state}
        schoolChoices={await loadSchoolChoices(context, requestedRound)}
      />
    );
  }

  const { organization, selectedRound, analytics } = context;
  const choices = breakdownQuestionChoices(selectedRound.surveyDefinition);
  // The first choice rather than none, so a manager arriving from the
  // navigation reads a table instead of an instruction to pick something.
  const selectedQuestionId =
    choices.find((choice) => choice.questionId === requestedQuestion)?.questionId ??
    choices[0]?.questionId;

  const breakdown = selectedQuestionId
    ? buildBackgroundBreakdown({
        definition: selectedRound.surveyDefinition,
        // Read only when there is something to break down by. A round with no
        // background question pays for no query.
        responses: await loadRoundResponses(selectedRound.id),
        questionId: selectedQuestionId,
        privacyThreshold: analytics.privacyThreshold,
        isRoundLocked: analytics.isLocked,
      })
    : null;

  return (
    <div className="page stone-page">
      <PageIntro
        eyebrow={`${organization.name}, ${selectedRound.title}`}
        title="פילוח קבוצות"
        description="השוואת המדדים בין קבוצות בצוות, לפי שאלת רקע אחת. קבוצה קטנה מדי כדי להישאר אנונימית אינה מוצגת — לא הגודל שלה ולא הציונים שלה."
      />

      <RoundSwitcher
        options={toRoundSwitcherOptions(context.rounds, selectedRound.id)}
        action={roundSwitcherAction("breakdown")}
      />

      <BreakdownBoard
        breakdown={breakdown}
        choices={choices}
        selectedQuestionId={selectedQuestionId}
        roundId={selectedRound.id}
        isRoundLocked={analytics.isLocked}
        privacyThreshold={analytics.privacyThreshold}
        totalResponses={context.responseCount}
      />
    </div>
  );
}
