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

  public clear(): void {
    this.rounds.clear();
  }
}
