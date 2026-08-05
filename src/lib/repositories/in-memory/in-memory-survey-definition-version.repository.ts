import { randomUUID } from 'node:crypto';
import type { SurveyDefinition } from '../../types/backend';
import type { SurveyDefinitionVersion } from '../../types/survey-definition-version';
import {
  DEFINITION_VERSION_RETENTION,
  ISurveyDefinitionVersionRepository,
} from '../interfaces';

function clone(version: SurveyDefinitionVersion): SurveyDefinitionVersion {
  return {
    ...version,
    definition: structuredClone(version.definition),
    savedAt: new Date(version.savedAt),
  };
}

/**
 * The local wiring's version log. It prunes to the same retention limit the
 * durable one keeps, so a manager working without a database sees a history
 * that behaves the same length.
 */
export class InMemorySurveyDefinitionVersionRepository
  implements ISurveyDefinitionVersionRepository
{
  private versions: SurveyDefinitionVersion[] = [];

  constructor(initialVersions: SurveyDefinitionVersion[] = []) {
    this.versions = initialVersions.map(clone);
  }

  public async record(
    roundId: string,
    definition: SurveyDefinition,
    savedAt: Date = new Date(),
  ): Promise<SurveyDefinitionVersion> {
    const version: SurveyDefinitionVersion = {
      id: randomUUID(),
      roundId,
      definition: structuredClone(definition),
      savedAt: new Date(savedAt),
    };
    this.versions.push(version);

    const kept = this.byRound(roundId).slice(0, DEFINITION_VERSION_RETENTION);
    const keptIds = new Set(kept.map((entry) => entry.id));
    this.versions = this.versions.filter(
      (entry) => entry.roundId !== roundId || keptIds.has(entry.id),
    );

    return clone(version);
  }

  public async findByRoundId(roundId: string): Promise<SurveyDefinitionVersion[]> {
    return this.byRound(roundId).map(clone);
  }

  public async findById(
    roundId: string,
    versionId: string,
  ): Promise<SurveyDefinitionVersion | null> {
    const found = this.versions.find(
      (entry) => entry.id === versionId && entry.roundId === roundId,
    );
    return found ? clone(found) : null;
  }

  /**
   * Newest first, and ties broken by insertion order reversed. Two saves inside
   * the same millisecond are possible in tests and on a fast machine, and a
   * history whose order flips under sorting would restore the wrong one.
   */
  private byRound(roundId: string): SurveyDefinitionVersion[] {
    return this.versions
      .map((entry, index) => ({ entry, index }))
      .filter(({ entry }) => entry.roundId === roundId)
      .sort(
        (left, right) =>
          right.entry.savedAt.getTime() - left.entry.savedAt.getTime() ||
          right.index - left.index,
      )
      .map(({ entry }) => entry);
  }

  public clear(): void {
    this.versions = [];
  }
}
