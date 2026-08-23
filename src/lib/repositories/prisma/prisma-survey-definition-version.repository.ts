import type { SurveyDefinition } from '../../types/backend';
import type {
  SurveyDefinitionVersion,
  SurveyDefinitionVersionSummaryRow,
} from '../../types/survey-definition-version';
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

  /**
   * The history as three values per row, computed where the JSON already is.
   *
   * `findByRoundId` above reads every version's whole definition. The list
   * renders a date, a title and two counts — the 2026-08-21 audit's finding.
   * The title and the counts live inside the `jsonb` column, so no `select` can
   * reach them, and this is the one read in the product that has to be written
   * as SQL.
   *
   * It is worth being exact about where the saving is, because it is not where
   * the audit assumed. This query makes PostgreSQL do *more* work, not less:
   * `jsonb_array_elements` expands every question of every version, and the
   * plan touches far more buffers than the plain read does. It still wins,
   * because what dominates is serialising the definitions and shipping them.
   * Measured locally over twenty versions, warm, averaged over forty runs:
   * 2.6 ms against 1.6 ms at 24 questions per version, 7.0 ms against 3.4 ms at
   * 126, with the result shrinking from 132 KB and 640 KB to 2.4 KB. The
   * database this talks to in the deployed environment is not in the same
   * continent as the process reading it, so the local number is a floor.
   *
   * Tagged template, so `roundId` is a bound parameter and never text in a
   * statement.
   *
   * `count(*)` is cast to `int` because a `bigint` arrives as a JavaScript
   * `BigInt`, which `JSON.stringify` refuses; twenty questions will not
   * overflow it. `jsonb_array_length` is strict, so a row whose definition
   * somehow carried no `questions` array yields `NULL` and is read below as
   * zero — a floor for a shape this product does not write, not a feature.
   *
   * The answer must equal `summariseVersion` applied to the same row, and
   * `__dbtests__/postgres-survey-definition-versions.test.ts` compares them
   * directly rather than restating the expected numbers.
   */
  public async findSummariesByRoundId(
    roundId: string,
  ): Promise<SurveyDefinitionVersionSummaryRow[]> {
    if (!this.prisma.$queryRaw) {
      throw new Error(
        'The Prisma client in use does not expose $queryRaw, which the questionnaire history needs to summarise a jsonb column without reading it.',
      );
    }

    // Tagged off `this.prisma` rather than through a local, because Prisma's
    // `$queryRaw` reaches for the client through its own `this`: a detached
    // reference fails inside the runtime with a message about
    // `_createPrismaPromise` and nothing about the call that caused it.
    const rows = await this.prisma.$queryRaw<
      Array<{
        id: string;
        saved_at: Date;
        title: string | null;
        question_count: number | null;
        enabled_question_count: number;
      }>
    >`
      SELECT
        "id",
        "saved_at",
        "definition" ->> 'title' AS "title",
        jsonb_array_length("definition" -> 'questions') AS "question_count",
        (
          SELECT count(*)::int
          FROM jsonb_array_elements("definition" -> 'questions') AS "question"
          WHERE ("question" ->> 'enabled')::boolean
        ) AS "enabled_question_count"
      FROM "survey_definition_versions"
      WHERE "round_id" = ${roundId}
      ORDER BY "saved_at" DESC, "id" DESC
    `;

    return rows.map((row) => ({
      id: row.id,
      savedAt: new Date(row.saved_at),
      title: row.title ?? '',
      questionCount: row.question_count ?? 0,
      enabledQuestionCount: row.enabled_question_count ?? 0,
    }));
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
