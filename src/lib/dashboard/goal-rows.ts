import type { RoundGoalView } from '../round-goals-client';
import type { DashboardRecommendation } from './dashboard-insights';

export interface GoalRow {
  /** Stable across a re-render: the goal's id once tracked, the title before. */
  key: string;
  title: string;
  body: string;
  /** Present once this recommendation is tracked. */
  goal?: RoundGoalView;
  /**
   * True for a goal the current analysis no longer recommends. It stays on the
   * screen because that is the whole point of copying the text into the goal —
   * a decision the school made does not disappear when the provider rephrases
   * its advice.
   */
  fromEarlierAnalysis: boolean;
}

/**
 * What the goals panel lists: this dimension's current recommendations, each
 * carrying its goal when one exists, followed by goals the current analysis no
 * longer mentions.
 *
 * A goal is matched to a recommendation by title, which is the only identity
 * the AI payload gives a recommendation. A rephrased title therefore reads as a
 * new recommendation beside a goal from an earlier analysis, which is honest:
 * nothing in the payload says the two are the same advice.
 */
export function buildGoalRows(
  recommendations: DashboardRecommendation[],
  goals: RoundGoalView[],
  dimensionId: string,
): GoalRow[] {
  const dimensionGoals = goals.filter(
    (goal) => goal.dimensionId === dimensionId,
  );
  const byTitle = new Map(dimensionGoals.map((goal) => [goal.title, goal]));

  const rows: GoalRow[] = recommendations.map((recommendation) => {
    const goal = byTitle.get(recommendation.title);
    return {
      key: goal?.id ?? recommendation.title,
      title: recommendation.title,
      body: recommendation.body,
      goal,
      fromEarlierAnalysis: false,
    };
  });

  const currentTitles = new Set(
    recommendations.map((recommendation) => recommendation.title),
  );
  for (const goal of dimensionGoals) {
    if (currentTitles.has(goal.title)) continue;

    rows.push({
      key: goal.id,
      title: goal.title,
      body: goal.body,
      goal,
      fromEarlierAnalysis: true,
    });
  }

  return rows;
}
