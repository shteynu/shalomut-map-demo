import { randomUUID } from 'node:crypto';
import type {
  SurveyAttemptClientStage,
  SurveyAttemptRecord,
} from '../../types/backend';
import { ISurveyAttemptRepository } from '../interfaces';

function clone(attempt: SurveyAttemptRecord): SurveyAttemptRecord {
  return {
    ...attempt,
    openedAt: new Date(attempt.openedAt),
    consentAcceptedAt: attempt.consentAcceptedAt
      ? new Date(attempt.consentAcceptedAt)
      : undefined,
    completedAt: attempt.completedAt ? new Date(attempt.completedAt) : undefined,
  };
}

/**
 * The local wiring's funnel. It applies the same monotonic rule the durable one
 * does, because the rule is the contract rather than an implementation detail:
 * a test that passed here and lost data against PostgreSQL would be worse than
 * no test.
 */
export class InMemorySurveyAttemptRepository implements ISurveyAttemptRepository {
  private attempts: SurveyAttemptRecord[] = [];

  constructor(initialAttempts: SurveyAttemptRecord[] = []) {
    this.attempts = initialAttempts.map(clone);
  }

  public async record(input: {
    roundId: string;
    anonymousTokenHash: string;
    stage: SurveyAttemptClientStage;
    lastQuestionReached?: number;
    at?: Date;
  }): Promise<SurveyAttemptRecord> {
    const at = input.at ? new Date(input.at) : new Date();
    const existing = this.find(input.roundId, input.anonymousTokenHash);

    if (!existing) {
      const created: SurveyAttemptRecord = {
        id: randomUUID(),
        roundId: input.roundId,
        anonymousTokenHash: input.anonymousTokenHash,
        openedAt: at,
        consentAcceptedAt: input.stage === 'opened' ? undefined : at,
        lastQuestionReached:
          input.stage === 'progress' ? input.lastQuestionReached : undefined,
      };
      this.attempts.push(created);
      return clone(created);
    }

    // Never backwards. `opened` after a consent is a reload, not a reset, and a
    // beacon carrying question 3 after question 7 arrived late rather than
    // describing a respondent who went back.
    if (input.stage !== 'opened' && !existing.consentAcceptedAt) {
      existing.consentAcceptedAt = at;
    }
    if (input.stage === 'progress' && input.lastQuestionReached !== undefined) {
      existing.lastQuestionReached = Math.max(
        existing.lastQuestionReached ?? -1,
        input.lastQuestionReached,
      );
    }

    return clone(existing);
  }

  public async markCompleted(
    roundId: string,
    anonymousTokenHash: string,
    at: Date = new Date(),
  ): Promise<SurveyAttemptRecord | null> {
    const existing = this.find(roundId, anonymousTokenHash);
    if (!existing) return null;

    existing.completedAt = existing.completedAt ?? new Date(at);
    existing.consentAcceptedAt =
      existing.consentAcceptedAt ?? new Date(existing.openedAt);

    return clone(existing);
  }

  public async findByRoundId(roundId: string): Promise<SurveyAttemptRecord[]> {
    return this.attempts
      .filter((attempt) => attempt.roundId === roundId)
      .map(clone);
  }

  public async deleteByRoundId(roundId: string): Promise<void> {
    this.attempts = this.attempts.filter(
      (attempt) => attempt.roundId !== roundId,
    );
  }

  private find(
    roundId: string,
    anonymousTokenHash: string,
  ): SurveyAttemptRecord | undefined {
    return this.attempts.find(
      (attempt) =>
        attempt.roundId === roundId &&
        attempt.anonymousTokenHash === anonymousTokenHash,
    );
  }

  public clear(): void {
    this.attempts = [];
  }
}
