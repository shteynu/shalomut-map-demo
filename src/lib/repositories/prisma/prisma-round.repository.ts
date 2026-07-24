import { RoundStatus, SurveyRound } from '../../types/backend';
import { IRoundRepository } from '../interfaces';
import { MinimalPrismaClient } from './prisma-client';

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
    });
    return list.map((r) => this.mapToDomain(r));
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
}
