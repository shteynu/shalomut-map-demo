import type {
  SurveyAttemptClientStage,
  SurveyAttemptRecord,
} from '../../types/backend';
import { ISurveyAttemptRepository } from '../interfaces';
import { MinimalPrismaClient } from './prisma-client';

function toDomain(row: any): SurveyAttemptRecord {
  return {
    id: row.id,
    roundId: row.roundId,
    anonymousTokenHash: row.anonymousTokenHash,
    openedAt: new Date(row.openedAt),
    consentAcceptedAt: row.consentAcceptedAt
      ? new Date(row.consentAcceptedAt)
      : undefined,
    lastQuestionReached:
      row.lastQuestionReached === null || row.lastQuestionReached === undefined
        ? undefined
        : row.lastQuestionReached,
    completedAt: row.completedAt ? new Date(row.completedAt) : undefined,
  };
}

export class PrismaSurveyAttemptRepository implements ISurveyAttemptRepository {
  constructor(private prisma: MinimalPrismaClient) {}

  /**
   * A client generated before this migration has no delegate here, which would
   * otherwise surface as a `TypeError` deep inside a public route. It says what
   * to run instead.
   */
  private get delegate(): NonNullable<MinimalPrismaClient['surveyAttempt']> {
    if (!this.prisma.surveyAttempt) {
      throw new Error(
        'The generated Prisma client does not expose surveyAttempt. Run prisma generate after applying the survey attempts schema.',
      );
    }
    return this.prisma.surveyAttempt;
  }

  public async record(input: {
    roundId: string;
    anonymousTokenHash: string;
    stage: SurveyAttemptClientStage;
    lastQuestionReached?: number;
    at?: Date;
  }): Promise<SurveyAttemptRecord> {
    const at = input.at ?? new Date();
    const key = {
      roundId_anonymousTokenHash: {
        roundId: input.roundId,
        anonymousTokenHash: input.anonymousTokenHash,
      },
    };

    const existing = await this.delegate.findUnique({ where: key });

    if (!existing) {
      const created = await this.delegate.create({
        data: {
          roundId: input.roundId,
          anonymousTokenHash: input.anonymousTokenHash,
          openedAt: at,
          consentAcceptedAt: input.stage === 'opened' ? null : at,
          lastQuestionReached:
            input.stage === 'progress' ? input.lastQuestionReached ?? null : null,
        },
      });
      return toDomain(created);
    }

    /*
     * Never backwards. These arrive from an unauthenticated client that does not
     * wait for a reply, so a reload reporting `opened` after the session already
     * consented, and a `pagehide` beacon carrying an earlier question index than
     * one already stored, are both ordinary. The update is computed from the row
     * that was just read rather than expressed as a conditional write: two
     * beacons from one session racing is not a case this table needs to win, and
     * losing that race costs one question index rather than a row.
     */
    const data: Record<string, unknown> = {};

    if (input.stage !== 'opened' && !existing.consentAcceptedAt) {
      data.consentAcceptedAt = at;
    }
    if (input.stage === 'progress' && input.lastQuestionReached !== undefined) {
      const furthest = Math.max(
        existing.lastQuestionReached ?? -1,
        input.lastQuestionReached,
      );
      if (furthest !== existing.lastQuestionReached) {
        data.lastQuestionReached = furthest;
      }
    }

    if (Object.keys(data).length === 0) return toDomain(existing);

    const updated = await this.delegate.update({ where: key, data });
    return toDomain(updated);
  }

  public async markCompleted(
    roundId: string,
    anonymousTokenHash: string,
    at: Date = new Date(),
  ): Promise<SurveyAttemptRecord | null> {
    const key = {
      roundId_anonymousTokenHash: { roundId, anonymousTokenHash },
    };

    const existing = await this.delegate.findUnique({ where: key });
    if (!existing) return null;
    if (existing.completedAt) return toDomain(existing);

    const updated = await this.delegate.update({
      where: key,
      data: {
        completedAt: at,
        // A session that submitted plainly consented, even if that beacon was
        // the one the network dropped.
        consentAcceptedAt: existing.consentAcceptedAt ?? existing.openedAt,
      },
    });
    return toDomain(updated);
  }

  public async findByRoundId(roundId: string): Promise<SurveyAttemptRecord[]> {
    const rows = await this.delegate.findMany({
      where: { roundId },
      orderBy: [{ openedAt: 'asc' }],
    });
    return rows.map(toDomain);
  }

  public async deleteByRoundId(roundId: string): Promise<void> {
    await this.delegate.deleteMany({ where: { roundId } });
  }
}
