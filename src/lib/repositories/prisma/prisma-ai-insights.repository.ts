import { IAiInsightsRepository } from '../interfaces';
import { MinimalPrismaClient } from './prisma-client';

export class PrismaAiInsightsRepository implements IAiInsightsRepository {
  constructor(private prisma: MinimalPrismaClient) {}

  public async save(
    roundId: string,
    insights: Record<string, any>,
  ): Promise<boolean> {
    try {
      await this.prisma.surveyRound.update({
        where: { id: roundId },
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

  public async findByRoundId(
    roundId: string,
  ): Promise<Record<string, any> | null> {
    const found = await this.prisma.surveyRound.findUnique({
      where: { id: roundId },
    });
    const insights = found?.aiInsights;
    return insights && typeof insights === 'object' ? { ...insights } : null;
  }

  public async deleteByRoundId(roundId: string): Promise<void> {
    await this.prisma.surveyRound.update({
      where: { id: roundId },
      data: { aiInsights: null, aiInsightsUpdatedAt: null },
    });
  }
}
