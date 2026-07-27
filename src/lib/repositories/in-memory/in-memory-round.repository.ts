import { RoundStatus, SurveyRound, UpdateRoundInput } from '../../types/backend';
import { IRoundRepository } from '../interfaces';

function cloneRound(round: SurveyRound): SurveyRound {
  return {
    ...round,
    backgroundContext: round.backgroundContext
      ? {
          ...round.backgroundContext,
          classesPerGrade: { ...round.backgroundContext.classesPerGrade },
        }
      : undefined,
    surveyDefinition: round.surveyDefinition
      ? {
          ...round.surveyDefinition,
          questions: round.surveyDefinition.questions.map((question) => ({
            ...question,
          })),
        }
      : undefined,
  };
}

export class InMemoryRoundRepository implements IRoundRepository {
  private rounds: Map<string, SurveyRound> = new Map();

  constructor(initialRounds: SurveyRound[] = []) {
    for (const round of initialRounds) {
      this.rounds.set(round.id, cloneRound(round));
    }
  }

  public async create(round: SurveyRound): Promise<SurveyRound> {
    const copy = cloneRound(round);
    this.rounds.set(copy.id, copy);
    return cloneRound(copy);
  }

  public async findById(id: string): Promise<SurveyRound | null> {
    const found = this.rounds.get(id);
    return found ? cloneRound(found) : null;
  }

  public async findByShareCode(shareCode: string): Promise<SurveyRound | null> {
    const normalizedCode = shareCode.trim().toUpperCase();
    for (const round of this.rounds.values()) {
      if (round.shareCode.toUpperCase() === normalizedCode) {
        return cloneRound(round);
      }
    }
    return null;
  }

  public async findByOrganizationId(organizationId: string): Promise<SurveyRound[]> {
    const results: SurveyRound[] = [];
    for (const round of this.rounds.values()) {
      if (round.organizationId === organizationId) {
        results.push(cloneRound(round));
      }
    }
    return results;
  }

  public async update(
    id: string,
    input: UpdateRoundInput
  ): Promise<SurveyRound | null> {
    const round = this.rounds.get(id);
    if (!round) return null;

    const updated = cloneRound({ ...round, ...input });
    this.rounds.set(id, updated);
    return cloneRound(updated);
  }

  public async updateStatus(
    id: string,
    status: RoundStatus
  ): Promise<SurveyRound | null> {
    const round = this.rounds.get(id);
    if (!round) return null;
    const updated: SurveyRound = { ...round, status };
    this.rounds.set(id, updated);
    return cloneRound(updated);
  }

  private aiInsightsStore: Map<string, Record<string, any>> = new Map();
  private aiRunClaims: Map<string, number> = new Map();

  public async saveAiInsights(id: string, insights: Record<string, any>): Promise<boolean> {
    if (!this.rounds.has(id)) {
      return false;
    }

    this.aiInsightsStore.set(id, { ...insights });
    this.aiRunClaims.set(id, Date.now());
    return true;
  }

  public async getAiInsights(id: string): Promise<Record<string, any> | null> {
    const found = this.aiInsightsStore.get(id);
    return found ? { ...found } : null;
  }

  public async claimAiAnalysisRun(
    id: string,
    options?: { leaseMs?: number; requireNoInsights?: boolean },
  ): Promise<boolean> {
    if (!this.rounds.has(id)) return false;

    const leaseMs = options?.leaseMs ?? 0;
    const requireNoInsights = options?.requireNoInsights ?? true;

    if (requireNoInsights && this.aiInsightsStore.has(id)) {
      return false;
    }

    const claimedAt = this.aiRunClaims.get(id);
    if (claimedAt !== undefined && Date.now() - claimedAt < leaseMs) {
      return false;
    }

    this.aiRunClaims.set(id, Date.now());
    return true;
  }

  public async releaseAiAnalysisClaim(id: string): Promise<void> {
    if (this.aiInsightsStore.has(id)) return;
    this.aiRunClaims.delete(id);
  }

  public async clearAiInsights(id: string): Promise<void> {
    this.aiInsightsStore.delete(id);
    this.aiRunClaims.delete(id);
  }

  public clear(): void {
    this.rounds.clear();
    this.aiInsightsStore.clear();
    this.aiRunClaims.clear();
  }
}
