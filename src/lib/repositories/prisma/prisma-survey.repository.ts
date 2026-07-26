import { QuestionAnswerRecord, SurveyResponseRecord } from '../../types/backend';
import { ISurveyRepository } from '../interfaces';
import { MinimalPrismaClient } from './prisma-client';

export class PrismaSurveyRepository implements ISurveyRepository {
  constructor(private prisma: MinimalPrismaClient) {}

  private mapToDomain(record: any): SurveyResponseRecord {
    const answers: QuestionAnswerRecord[] = (record.answers || []).map((ans: any) => ({
      questionId: ans.questionId,
      dimensionId: ans.dimensionId,
      value: ans.value,
      score: ans.score,
    }));

    return {
      id: record.id,
      roundId: record.roundId,
      anonymousTokenHash: record.anonymousTokenHash || undefined,
      answers,
      submittedAt: new Date(record.submittedAt),
    };
  }

  public async saveResponse(
    response: SurveyResponseRecord
  ): Promise<SurveyResponseRecord> {
    const created = await this.prisma.surveyResponse.create({
      data: {
        id: response.id,
        roundId: response.roundId,
        anonymousTokenHash: response.anonymousTokenHash,
        submittedAt: response.submittedAt,
        answers: {
          create: response.answers.map((ans) => ({
            questionId: ans.questionId,
            dimensionId: ans.dimensionId,
            value: ans.value,
            score: ans.score,
          })),
        },
      },
      include: {
        answers: true,
      },
    });

    return this.mapToDomain(created);
  }

  public async findResponsesByRoundId(
    roundId: string
  ): Promise<SurveyResponseRecord[]> {
    const list = await this.prisma.surveyResponse.findMany({
      where: { roundId },
      include: {
        answers: true,
      },
    });
    return list.map((item) => this.mapToDomain(item));
  }

  public async hasTokenSubmitted(
    roundId: string,
    tokenHash: string
  ): Promise<boolean> {
    if (!tokenHash) return false;
    const found = await this.prisma.surveyResponse.findFirst({
      where: {
        roundId,
        anonymousTokenHash: tokenHash,
      },
    });
    return Boolean(found);
  }

  public async getResponseCount(roundId: string): Promise<number> {
    return this.prisma.surveyResponse.count({
      where: { roundId },
    });
  }

  public async deleteByRoundId(roundId: string): Promise<void> {
    await this.prisma.surveyResponse.deleteMany({
      where: { roundId },
    });
  }
}
