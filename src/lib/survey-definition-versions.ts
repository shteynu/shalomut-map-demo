import { countQuestionnaireItems } from "@/lib/survey/survey-steps";
import type {
  SurveyDefinitionVersion,
  SurveyDefinitionVersionSummary,
  SurveyDefinitionVersionSummaryRow,
} from "@/lib/types/survey-definition-version";

/**
 * What the builder's history list shows, for a version already in hand.
 *
 * The counts are computed here rather than stored, so a version recorded before
 * a question shape changed still summarises correctly: the numbers describe the
 * definition as it is read back, not as it was counted at write time.
 *
 * They count items, not stored questions — a grid once, whatever its rows —
 * the way the consent screen and the builder's summary stone count. A history
 * line said «150 שאלות פעילות מתוך 150» for the 126-item instrument while the
 * stone above it said 126.
 *
 * A durable store does not have to come through here. `findSummariesByRoundId`
 * computes the same three values in the database precisely so that twenty full
 * questionnaires never leave it — see `ISurveyDefinitionVersionRepository`. The
 * two must agree, and `__dbtests__/postgres-survey-definition-versions.test.ts`
 * checks that they do against this function.
 */
export function summariseVersion(
  version: SurveyDefinitionVersion,
): SurveyDefinitionVersionSummaryRow {
  return {
    id: version.id,
    savedAt: version.savedAt,
    title: version.definition.title,
    questionCount: countQuestionnaireItems(version.definition.questions),
    enabledQuestionCount: countQuestionnaireItems(
      version.definition.questions.filter((question) => question.enabled),
    ),
  };
}

/**
 * Mark the version the round is on.
 *
 * The first entry, because the newest version is by construction the
 * questionnaire in force — a version is written after the round is updated,
 * never before — and every store here returns the history newest first.
 */
export function markCurrentVersion(
  rows: readonly SurveyDefinitionVersionSummaryRow[],
): SurveyDefinitionVersionSummary[] {
  return rows.map((row, index) => ({ ...row, isCurrent: index === 0 }));
}

/** The whole list, for a caller holding whole versions. */
export function toVersionSummaries(
  versions: SurveyDefinitionVersion[],
): SurveyDefinitionVersionSummary[] {
  return markCurrentVersion(versions.map(summariseVersion));
}
