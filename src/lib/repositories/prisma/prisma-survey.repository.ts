import { QuestionAnswerRecord, SurveyResponseRecord } from '../../types/backend';
import { DuplicateResponseError } from '../errors';
import { ISurveyRepository } from '../interfaces';
import { MinimalPrismaClient } from './prisma-client';

/**
 * The unique index a second submission of one filling session collides with.
 *
 * Which constraint a `P2002` names depends on how the client reached the
 * database. The runtime here is adapter-backed (`@prisma/adapter-pg`), and that
 * path carries the detail under `meta.driverAdapterError.cause.constraint` and
 * leaves `meta.target` undefined; a non-adapter client reports `meta.target`
 * instead, as either the index name or the column list. All three are read, and
 * anything else stays an unhandled error: mapping an unrecognised constraint to
 * "already submitted" would answer a real defect with a reassuring message.
 */
const RESPONSE_TOKEN_UNIQUE_INDEX =
  'survey_responses_round_id_anonymous_token_hash_key';
const RESPONSE_TOKEN_UNIQUE_COLUMNS = ['round_id', 'anonymous_token_hash'];

function namesTheResponseTokenIndex(candidate: unknown): boolean {
  if (typeof candidate === 'string') {
    return candidate === RESPONSE_TOKEN_UNIQUE_INDEX;
  }

  if (Array.isArray(candidate)) {
    const columns = candidate.map(String);
    return RESPONSE_TOKEN_UNIQUE_COLUMNS.every((column) =>
      columns.includes(column),
    );
  }

  return false;
}

function isDuplicateResponseViolation(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  if ((error as { code?: unknown }).code !== 'P2002') return false;

  const meta = (error as { meta?: Record<string, any> }).meta;
  if (!meta) return false;

  if (namesTheResponseTokenIndex(meta.target)) return true;

  const constraint = meta.driverAdapterError?.cause?.constraint;
  if (!constraint) return false;

  return (
    namesTheResponseTokenIndex(constraint.fields) ||
    namesTheResponseTokenIndex(constraint.index)
  );
}

export class PrismaSurveyRepository implements ISurveyRepository {
  constructor(private prisma: MinimalPrismaClient) {}

  private mapToDomain(record: any): SurveyResponseRecord {
    // `null` becomes `undefined` on the way in. The domain type says these two
    // fields are absent for a background answer, and a `null` wearing that type
    // is a value: it compares unequal to the `undefined` the question carries,
    // and arithmetic reads it as zero. Both columns are nullable, so this is
    // the boundary where the difference has to be settled.
    const answers: QuestionAnswerRecord[] = (record.answers || []).map((ans: any) => ({
      questionId: ans.questionId,
      ...(ans.dimensionId == null ? {} : { dimensionId: ans.dimensionId }),
      value: ans.value,
      ...(ans.score == null ? {} : { score: ans.score }),
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
    // The nested create is one implicit transaction, so a response and its
    // answers arrive together or not at all.
    try {
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
    } catch (error) {
      if (isDuplicateResponseViolation(error)) {
        throw new DuplicateResponseError(response.roundId);
      }
      throw error;
    }
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
