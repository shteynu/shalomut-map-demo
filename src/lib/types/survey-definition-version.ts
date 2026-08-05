import type { SurveyDefinition } from './backend';

/**
 * What the questionnaire looked like after one save.
 *
 * A row is written when a save actually changed the definition, so the list is
 * a record of decisions rather than of button presses. The newest row is the
 * questionnaire as it stands now; the ones below it are where a manager can
 * go back to (backlog §1).
 *
 * The definition is copied whole rather than stored as a diff. It is a small
 * JSON document, a diff would have to be replayed to be read, and the point of
 * the feature is to hand back an exact earlier state.
 */
export interface SurveyDefinitionVersion {
  id: string;
  roundId: string;
  definition: SurveyDefinition;
  savedAt: Date;
}

/**
 * One line in the builder's history list. It carries what a manager needs to
 * recognise a version — when it was saved and how big the questionnaire was —
 * without shipping every version's full definition to the browser.
 */
export interface SurveyDefinitionVersionSummary {
  id: string;
  savedAt: Date;
  title: string;
  questionCount: number;
  enabledQuestionCount: number;
  /** True for the version the round is currently on, which is the newest one. */
  isCurrent: boolean;
}
