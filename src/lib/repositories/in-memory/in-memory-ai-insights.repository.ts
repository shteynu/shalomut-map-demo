import { IAiInsightsRepository } from '../interfaces';

/**
 * Only the part of the round repository this one needs: whether the round the
 * result belongs to exists. Postgres answers the same question through the
 * failing update on a missing row.
 */
interface RoundExistenceSource {
  findById(id: string): Promise<unknown | null>;
}

export class InMemoryAiInsightsRepository implements IAiInsightsRepository {
  private insights: Map<string, Record<string, any>> = new Map();

  /**
   * Without a round source every save succeeds, which suits a test that only
   * exercises the insights themselves.
   */
  constructor(private rounds?: RoundExistenceSource) {}

  public async save(
    roundId: string,
    insights: Record<string, any>,
  ): Promise<boolean> {
    if (this.rounds && !(await this.rounds.findById(roundId))) {
      return false;
    }

    this.insights.set(roundId, { ...insights });
    return true;
  }

  public async findByRoundId(
    roundId: string,
  ): Promise<Record<string, any> | null> {
    const found = this.insights.get(roundId);
    return found ? { ...found } : null;
  }

  public async deleteByRoundId(roundId: string): Promise<void> {
    this.insights.delete(roundId);
  }

  public clear(): void {
    this.insights.clear();
  }
}
