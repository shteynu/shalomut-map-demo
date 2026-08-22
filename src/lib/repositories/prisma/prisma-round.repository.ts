import {
  RoundBackgroundContext,
  RoundStatus,
  SurveyDefinition,
  SurveyRound,
  UpdateRoundInput,
} from '../../types/backend';
import { parseSurveyDefinition } from '../../survey-definition';
import { IRoundRepository, RoundStatusWrite } from '../interfaces';
import { MinimalPrismaClient } from './prisma-client';

/**
 * The partial unique index that keeps one school to one running round.
 *
 * `survey_rounds_one_active_per_organization` is owned by the 2026-08-04
 * migration and has no counterpart in `schema.prisma`, so how Prisma reports it
 * depends on how the client reached the database. The deployed runtime is
 * adapter-backed (`@prisma/adapter-pg`) and, as `npm run verify:db` shows,
 * leaves `meta.target` undefined and reports the *columns* rather than the
 * index — `meta.driverAdapterError.cause.constraint.fields` is
 * `['organization_id']`, with the index named only inside `originalMessage`. A
 * non-adapter client fills `meta.target` instead. All of those are read.
 *
 * The column list identifies this index because it is the only unique
 * constraint on `survey_rounds(organization_id)`; a longer list is some other
 * constraint. Anything unrecognised stays a write failure — answering an
 * unknown constraint with "another round is active" would explain a real defect
 * away in the manager's own words.
 */
const ONE_ACTIVE_ROUND_INDEX = 'survey_rounds_one_active_per_organization';
const ONE_ACTIVE_ROUND_COLUMNS = ['organization_id'];

function namesTheOneActiveRoundIndex(candidate: unknown): boolean {
  if (typeof candidate === 'string') {
    return candidate.includes(ONE_ACTIVE_ROUND_INDEX);
  }

  if (Array.isArray(candidate)) {
    const columns = candidate.map(String);
    if (columns.includes(ONE_ACTIVE_ROUND_INDEX)) return true;

    return (
      columns.length === ONE_ACTIVE_ROUND_COLUMNS.length &&
      ONE_ACTIVE_ROUND_COLUMNS.every((column) => columns.includes(column))
    );
  }

  return false;
}

function violatesTheOneActiveRoundIndex(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  if ((error as { code?: unknown }).code !== 'P2002') return false;

  const meta = (error as { meta?: Record<string, any> }).meta;
  if (!meta) return false;

  if (namesTheOneActiveRoundIndex(meta.target)) return true;

  const cause = meta.driverAdapterError?.cause;
  if (!cause) return false;

  return (
    namesTheOneActiveRoundIndex(cause.originalMessage) ||
    namesTheOneActiveRoundIndex(cause.constraint?.index) ||
    namesTheOneActiveRoundIndex(cause.constraint?.fields)
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function finiteNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function normalizeClassesPerGrade(value: unknown): Record<string, number> {
  if (!isRecord(value)) return {};

  return Object.fromEntries(
    Object.entries(value).filter(
      (entry): entry is [string, number] =>
        typeof entry[1] === 'number' && Number.isFinite(entry[1]),
    ),
  );
}

function normalizeBackgroundContext(
  value: unknown,
): RoundBackgroundContext | undefined {
  if (!isRecord(value)) return undefined;

  return {
    notes: typeof value.notes === 'string' ? value.notes : '',
    audience: typeof value.audience === 'string' ? value.audience : 'all-staff',
    sicknessDaysThisQuarter: finiteNumber(value.sicknessDaysThisQuarter, 0),
    newStaffMembers: finiteNumber(value.newStaffMembers, 0),
    studentCount: finiteNumber(value.studentCount, 0),
    socioEconomicIndex: finiteNumber(value.socioEconomicIndex, 1),
    classesPerGrade: normalizeClassesPerGrade(value.classesPerGrade),
  };
}

/**
 * The stored questionnaire, as the domain type promises it.
 *
 * This used to be a `structuredClone` of whatever JSON the column held, typed
 * as a `SurveyDefinition` on trust. Every consumer that parses was fine; the
 * builder is the one that reads the type at its word, and a questionnaire
 * written before `kind` existed reached it with no `kind` on any question — so
 * every question was neither analytic nor background, and the builder showed
 * eight empty dimension tabs above twenty-four questions.
 *
 * `parseSurveyDefinition` is where the defaults for older shapes already live,
 * so reading through it is what makes the promise true rather than a second
 * copy of those rules here. `allowIncomplete` because a draft round is allowed
 * to hold an unfinished questionnaire — the manager is still writing it.
 *
 * A definition that will not parse is returned as it was. Refusing it would
 * take a round off every manager screen instead of letting them repair it,
 * which is a worse answer than the one this function exists to fix.
 */
function readSurveyDefinition(value: unknown): SurveyDefinition | undefined {
  if (!isRecord(value)) return undefined;

  const parsed = parseSurveyDefinition(value, { allowIncomplete: true });
  return parsed.ok
    ? parsed.value
    : (structuredClone(value) as unknown as SurveyDefinition);
}

export class PrismaRoundRepository implements IRoundRepository {
  constructor(private prisma: MinimalPrismaClient) {}

  private mapToDomain(record: any): SurveyRound {
    return {
      id: record.id,
      organizationId: record.organizationId,
      title: record.title,
      status: record.status as RoundStatus,
      shareCode: record.shareCode,
      privacyThreshold: record.privacyThreshold,
      startDate: new Date(record.startDate),
      endDate: record.endDate ? new Date(record.endDate) : undefined,
      backgroundContext: normalizeBackgroundContext(record.backgroundContext),
      surveyDefinition: readSurveyDefinition(record.surveyDefinition),
      createdAt: new Date(record.createdAt),
      updatedAt: record.updatedAt ? new Date(record.updatedAt) : undefined,
    };
  }

  public async create(round: SurveyRound): Promise<SurveyRound> {
    const created = await this.prisma.surveyRound.create({
      data: {
        id: round.id,
        organizationId: round.organizationId,
        title: round.title,
        status: round.status,
        shareCode: round.shareCode,
        privacyThreshold: round.privacyThreshold,
        startDate: round.startDate,
        endDate: round.endDate,
        backgroundContext: round.backgroundContext,
        surveyDefinition: round.surveyDefinition,
        createdAt: round.createdAt,
      },
    });
    return this.mapToDomain(created);
  }

  public async findById(id: string): Promise<SurveyRound | null> {
    const found = await this.prisma.surveyRound.findUnique({
      where: { id },
    });
    return found ? this.mapToDomain(found) : null;
  }

  public async findByShareCode(shareCode: string): Promise<SurveyRound | null> {
    const found = await this.prisma.surveyRound.findFirst({
      where: {
        shareCode: {
          equals: shareCode.trim(),
          mode: 'insensitive',
        },
      },
    });
    return found ? this.mapToDomain(found) : null;
  }

  public async findByOrganizationId(organizationId: string): Promise<SurveyRound[]> {
    const list = await this.prisma.surveyRound.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
    });
    return list.map((r) => this.mapToDomain(r));
  }

  public async update(
    id: string,
    input: UpdateRoundInput
  ): Promise<SurveyRound | null> {
    try {
      const updated = await this.prisma.surveyRound.update({
        where: { id },
        data: input,
      });
      return this.mapToDomain(updated);
    } catch {
      return null;
    }
  }

  public async updateStatus(
    id: string,
    status: RoundStatus,
    expectedCurrent: RoundStatus,
  ): Promise<RoundStatusWrite> {
    try {
      // `updateMany`, not `update`, because only `updateMany` accepts a
      // non-unique `where`. That is the whole mechanism: the expected status
      // travels into the `WHERE`, so the database decides whether the
      // transition still applies rather than a read taken a moment earlier.
      const { count } = await this.prisma.surveyRound.updateMany({
        where: { id, status: expectedCurrent },
        data: { status },
      });

      if (count === 0) return this.explainMissedWrite(id);

      const updated = await this.prisma.surveyRound.findUnique({
        where: { id },
      });

      // The write happened; the row can only be missing if something deleted it
      // in between, and there is then no round left to report.
      if (!updated) return { outcome: 'not_found' };

      return { outcome: 'written', round: this.mapToDomain(updated) };
    } catch (error) {
      if (violatesTheOneActiveRoundIndex(error)) {
        return {
          outcome: 'another_round_is_active',
          activeRound: await this.findActiveSibling(id),
        };
      }

      return {
        outcome: 'write_failed',
        reason: error instanceof Error ? error.message : 'unknown error',
      };
    }
  }

  /**
   * A write that matched no row: either the round is gone, or its status is no
   * longer what the caller transitioned from. One read tells them apart, and it
   * runs only on the path that already failed.
   */
  private async explainMissedWrite(id: string): Promise<RoundStatusWrite> {
    const current = await this.prisma.surveyRound.findUnique({ where: { id } });
    if (!current) return { outcome: 'not_found' };

    return {
      outcome: 'status_changed',
      current: this.mapToDomain(current).status,
    };
  }

  /**
   * The round that holds the school's one active slot. Read after the index has
   * already refused the write, so the manager is told which round is running
   * rather than that a constraint was violated.
   */
  private async findActiveSibling(id: string): Promise<SurveyRound | null> {
    const round = await this.prisma.surveyRound.findUnique({ where: { id } });
    if (!round) return null;

    const active = await this.prisma.surveyRound.findFirst({
      where: {
        organizationId: this.mapToDomain(round).organizationId,
        status: 'active',
        NOT: { id },
      },
    });

    return active ? this.mapToDomain(active) : null;
  }
}
