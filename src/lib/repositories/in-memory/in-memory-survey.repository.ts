import { SurveyResponseRecord } from '../../types/backend';
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
    const copy = { ...response };
    this.responses.set(copy.id, copy);
    return copy;
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
