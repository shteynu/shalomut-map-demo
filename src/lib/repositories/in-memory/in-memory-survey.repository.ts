import { SurveyResponseRecord, SurveyResponseTiming } from '../../types/backend';
import { DuplicateResponseError } from '../errors';
import { ISurveyRepository } from '../interfaces';

export class InMemorySurveyRepository implements ISurveyRepository {
  private responses: Map<string, SurveyResponseRecord> = new Map();

  constructor(initialResponses: SurveyResponseRecord[] = []) {
    for (const res of initialResponses) {
      this.responses.set(res.id, { ...res });
    }
  }

  public async saveResponse(
    response: SurveyResponseRecord
  ): Promise<SurveyResponseRecord> {
    // Mirrors the database's unique index so both implementations answer a
    // duplicate the same way. This store is single-threaded and cannot race,
    // so it proves the contract, never the concurrency semantics — that needs
    // the PostgreSQL suite.
    if (response.anonymousTokenHash) {
      const duplicate = await this.hasTokenSubmitted(
        response.roundId,
        response.anonymousTokenHash,
      );
      if (duplicate) {
        throw new DuplicateResponseError(response.roundId);
      }
    }

    const copy = { ...response };
    this.responses.set(copy.id, copy);
    return copy;
  }

  /**
   * The same rows the durable store returns for this call — answers dropped
   * here rather than never fetched, because this store has no query to narrow.
   * What both stores must agree on is the shape and the contents, and that is
   * what `postgres-response-timings.test.ts` compares.
   */
  public async findResponseTimingsByRoundId(
    roundId: string,
  ): Promise<SurveyResponseTiming[]> {
    const timings: SurveyResponseTiming[] = [];
    for (const res of this.responses.values()) {
      if (res.roundId !== roundId) continue;
      const { answers: _answers, ...timing } = res;
      timings.push({ ...timing });
    }
    return timings;
  }

  public async findResponsesByRoundId(
    roundId: string
  ): Promise<SurveyResponseRecord[]> {
    const results: SurveyResponseRecord[] = [];
    for (const res of this.responses.values()) {
      if (res.roundId === roundId) {
        results.push({ ...res });
      }
    }
    return results;
  }

  public async countResponsesByRoundIds(
    roundIds: readonly string[],
  ): Promise<Map<string, number>> {
    const wanted = new Set(roundIds);
    const counts = new Map<string, number>();
    for (const response of this.responses.values()) {
      if (!wanted.has(response.roundId)) continue;
      counts.set(response.roundId, (counts.get(response.roundId) ?? 0) + 1);
    }
    return counts;
  }

  public async hasTokenSubmitted(
    roundId: string,
    tokenHash: string
  ): Promise<boolean> {
    if (!tokenHash) return false;
    for (const res of this.responses.values()) {
      if (res.roundId === roundId && res.anonymousTokenHash === tokenHash) {
        return true;
      }
    }
    return false;
  }

  public async getResponseCount(roundId: string): Promise<number> {
    let count = 0;
    for (const res of this.responses.values()) {
      if (res.roundId === roundId) {
        count++;
      }
    }
    return count;
  }

  public async deleteByRoundId(roundId: string): Promise<void> {
    for (const [id, res] of Array.from(this.responses.entries())) {
      if (res.roundId === roundId) {
        this.responses.delete(id);
      }
    }
  }

  public clear(): void {
    this.responses.clear();
  }
}
