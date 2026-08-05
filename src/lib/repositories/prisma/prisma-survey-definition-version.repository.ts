import type { SurveyDefinition } from '../../types/backend';
import type { SurveyDefinitionVersion } from '../../types/survey-definition-version';
import {
  DEFINITION_VERSION_RETENTION,
  ISurveyDefinitionVersionRepository,
} from '../interfaces';
import { MinimalPrismaClient } from './prisma-client';

function toDomain(row: any): SurveyDefinitionVersion {
  return {
    id: row.id,
    roundId: row.roundId,
    definition: row.definition as SurveyDefinition,
    savedAt: new Date(row.savedAt),
  };
}

export class PrismaSurveyDefinitionVersionRepository
  implements ISurveyDefinitionVersionRepository
{
  constructor(private prisma: MinimalPrismaClient) {}

  /**
   * A client generated before this migration has no delegate here, which would
   * otherwise surface as a `TypeError` deep inside a route. It says what to run
   * instead.
   */
  private get delegate(): NonNullable<MinimalPrismaClient['surveyDefinitionVersion']> {
    if (!this.prisma.surveyDefinitionVersion) {
      throw new Error(
        'The generated Prisma client does not expose surveyDefinitionVersion. Run prisma generate after applying the survey definition versions schema.',
      );
    }
    return this.prisma.surveyDefinitionVersion;
  }

  public async record(
    roundId: string,
    definition: SurveyDefinition,
    savedAt?: Date,
  ): Promise<SurveyDefinitionVersion> {
    const created = await this.delegate.create({
      data: {
        roundId,
        definition: definition as unknown as Record<string, unknown>,
        ...(savedAt ? { savedAt } : {}),
      },
    });

    await this.prune(roundId);
    return toDomain(created);
  }

  public async findByRoundId(roundId: string): Promise<SurveyDefinitionVersion[]> {
    const rows = await this.delegate.findMany({
      where: { roundId },
      orderBy: [{ savedAt: 'desc' }, { id: 'desc' }],
    });
    return rows.map(toDomain);
  }

  public async findById(
    roundId: string,
    versionId: string,
  ): Promise<SurveyDefinitionVersion | null> {
    // Scoped by round, so a version id from another school reads as missing
    // rather than as a questionnaire the caller was never authorized for.
    const row = await this.delegate.findFirst({
      where: { id: versionId, roundId },
    });
    return row ? toDomain(row) : null;
  }

  /**
   * Keep the newest `DEFINITION_VERSION_RETENTION` and drop the rest.
   *
   * Pruning by id rather than by a timestamp cutoff: two saves can share a
   * millisecond, and a `savedAt <= cutoff` delete would then take the row it
   * was meant to keep.
   */
  private async prune(roundId: string): Promise<void> {
    const rows = await this.delegate.findMany({
      where: { roundId },
      orderBy: [{ savedAt: 'desc' }, { id: 'desc' }],
      select: { id: true },
    });
    const doomed = rows.slice(DEFINITION_VERSION_RETENTION).map((row: { id: string }) => row.id);
    if (doomed.length === 0) return;

    await this.delegate.deleteMany({ where: { roundId, id: { in: doomed } } });
  }
}
