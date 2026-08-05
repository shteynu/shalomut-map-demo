import type {
  SurveyDefinitionVersion,
  SurveyDefinitionVersionSummary,
} from "@/lib/types/survey-definition-version";

/**
 * What the builder's history list shows.
 *
 * The counts are computed here rather than stored, so a version recorded before
 * a question shape changed still summarises correctly: the numbers describe the
 * definition as it is read back, not as it was counted at write time.
 *
 * The first entry is marked current because the newest version is, by
 * construction, the questionnaire the round is on — a version is written after
 * the round is updated, never before.
 */
export function toVersionSummaries(
  versions: SurveyDefinitionVersion[],
): SurveyDefinitionVersionSummary[] {
  return versions.map((version, index) => ({
    id: version.id,
    savedAt: version.savedAt,
    title: version.definition.title,
    questionCount: version.definition.questions.length,
    enabledQuestionCount: version.definition.questions.filter(
      (question) => question.enabled,
    ).length,
    isCurrent: index === 0,
  }));
}
