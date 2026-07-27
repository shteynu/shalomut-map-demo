import {
  RoundBackgroundContext,
  RoundStatus,
  SurveyRound,
  UpdateRoundInput,
} from '../../types/backend';
import { IRoundRepository } from '../interfaces';
import { MinimalPrismaClient } from './prisma-client';

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
      surveyDefinition:
        record.surveyDefinition &&
        typeof record.surveyDefinition === 'object' &&
        !Array.isArray(record.surveyDefinition)
          ? structuredClone(record.surveyDefinition)
          : undefined,
      createdAt: new Date(record.createdAt),
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
    status: RoundStatus
  ): Promise<SurveyRound | null> {
    try {
      const updated = await this.prisma.surveyRound.update({
        where: { id },
        data: { status },
      });
      return this.mapToDomain(updated);
    } catch {
      return null;
    }
  }

  public async saveAiInsights(id: string, insights: Record<string, any>): Promise<boolean> {
    try {
      await this.prisma.surveyRound.update({
        where: { id },
        data: {
          aiInsights: insights,
          aiInsightsUpdatedAt: new Date(),
        },
      });
      return true;
    } catch {
      return false;
    }
  }

  public async getAiInsights(id: string): Promise<Record<string, any> | null> {
    const found = await this.prisma.surveyRound.findUnique({
      where: { id },
    });
    const insights = found?.aiInsights;
    return insights && typeof insights === 'object'
      ? { ...insights }
      : null;
  }

  public async claimAiAnalysisRun(
    id: string,
    options?: { leaseMs?: number; requireNoInsights?: boolean },
  ): Promise<boolean> {
    const leaseMs = options?.leaseMs ?? 0;
    const requireNoInsights = options?.requireNoInsights ?? true;
    const leaseCutoff = new Date(Date.now() - leaseMs);

    // `aiInsightsUpdatedAt` doubles as the lease marker: a single conditional
    // updateMany is atomic per row, so only one concurrent caller observes
    // `count === 1` and dispatches the webhook.
    const where: Record<string, unknown> = {
      id,
      OR: [
        { aiInsightsUpdatedAt: null },
        { aiInsightsUpdatedAt: { lt: leaseCutoff } },
      ],
    };
    if (requireNoInsights) {
      where.aiInsights = null;
    }

    try {
      const result = await this.prisma.surveyRound.updateMany({
        where,
        data: { aiInsightsUpdatedAt: new Date() },
      });
      return (result?.count ?? 0) > 0;
    } catch {
      return false;
    }
  }

  public async releaseAiAnalysisClaim(id: string): Promise<void> {
    try {
      await this.prisma.surveyRound.updateMany({
        where: { id, aiInsights: null },
        data: { aiInsightsUpdatedAt: null },
      });
    } catch {
      // A stuck lease expires on its own; failing to clear it is not fatal.
    }
  }

  public async clearAiInsights(id: string): Promise<void> {
    await this.prisma.surveyRound.update({
      where: { id },
      data: { aiInsights: null, aiInsightsUpdatedAt: null },
    });
  }
}
