import { RoundStatus, SurveyRound } from '../../types/backend';
import { IRoundRepository } from '../interfaces';

export class InMemoryRoundRepository implements IRoundRepository {
  private rounds: Map<string, SurveyRound> = new Map();

  constructor(initialRounds: SurveyRound[] = []) {
    for (const round of initialRounds) {
      this.rounds.set(round.id, { ...round });
    }
  }

  public async create(round: SurveyRound): Promise<SurveyRound> {
    const copy = { ...round };
    this.rounds.set(copy.id, copy);
    return copy;
  }

  public async findById(id: string): Promise<SurveyRound | null> {
    const found = this.rounds.get(id);
    return found ? { ...found } : null;
  }

  public async findByShareCode(shareCode: string): Promise<SurveyRound | null> {
    const normalizedCode = shareCode.trim().toUpperCase();
    for (const round of this.rounds.values()) {
      if (round.shareCode.toUpperCase() === normalizedCode) {
        return { ...round };
      }
    }
    return null;
  }

  public async findByOrganizationId(organizationId: string): Promise<SurveyRound[]> {
    const results: SurveyRound[] = [];
    for (const round of this.rounds.values()) {
      if (round.organizationId === organizationId) {
        results.push({ ...round });
      }
    }
    return results;
  }

  public async updateStatus(
    id: string,
    status: RoundStatus
  ): Promise<SurveyRound | null> {
    const round = this.rounds.get(id);
    if (!round) return null;
    const updated: SurveyRound = { ...round, status };
    this.rounds.set(id, updated);
    return updated;
  }

  public clear(): void {
    this.rounds.clear();
  }
}
