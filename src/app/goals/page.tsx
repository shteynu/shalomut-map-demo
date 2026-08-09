import { ManagerOnboarding } from "@/components/manager";
import { PageIntro } from "@/components/ui";
import { SchoolGoalsBoard } from "@/components/goals/school-goals-board";
import { buildSchoolGoalsView } from "@/lib/goals/school-goals";
import {
  loadManagerContext,
  loadSchoolChoices,
  loadSchoolGoals,
} from "@/lib/server/manager-context";

/**
 * The school's goals, across every round it has run.
 *
 * This screen is deliberately not round-scoped, which is why it takes no
 * `round` parameter: a goal outlives the measurement it came from, and the one
 * question it answers is what the school is working on now.
 */
export default async function GoalsPage() {
  const context = await loadManagerContext();

  if (!context.organization) {
    return (
      <ManagerOnboarding
        state={context.state}
        schoolChoices={await loadSchoolChoices(context)}
      />
    );
  }

  const goals = await loadSchoolGoals(context);
  const view = buildSchoolGoalsView(context.rounds, goals);

  return (
    <div className="page stone-page">
      <PageIntro
        eyebrow={context.organization.name}
        title="מעקב יעדים"
        description="כל היעדים שנבחרו, מכל סבבי האבחון. יעד נשמר עם הנוסח שהיה על המסך ברגע הבחירה, ואינו מכיל שום פרט על מי שהשיב."
      />

      <SchoolGoalsBoard view={view} />
    </div>
  );
}
