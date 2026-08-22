import { RoundStatus, SurveyRound, UpdateRoundInput } from '../../types/backend';
import { IRoundRepository, RoundStatusWrite } from '../interfaces';

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

  // `updated_at` is a database-side `@updatedAt` column, so every write here
  // stamps it too. Leaving it to the caller would let the in-memory repository
  // report a save time the deployed one would have moved on.
  public async create(round: SurveyRound): Promise<SurveyRound> {
    const copy = cloneRound({ ...round, updatedAt: new Date() });
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

    const updated = cloneRound({ ...round, ...input, updatedAt: new Date() });
    this.rounds.set(id, updated);
    return cloneRound(updated);
  }

  public async updateStatus(
    id: string,
    status: RoundStatus,
    expectedCurrent: RoundStatus,
  ): Promise<RoundStatusWrite> {
    const round = this.rounds.get(id);
    if (!round) return { outcome: 'not_found' };

    if (round.status !== expectedCurrent) {
      return { outcome: 'status_changed', current: round.status };
    }

    // The deployed database refuses a school's second active round through the
    // partial unique index `survey_rounds_one_active_per_organization`. This
    // class enforces the same rule rather than being the one place the
    // invariant does not hold — nearly every test of a refused activation runs
    // against the in-memory repository, and one that cannot refuse would prove
    // the handling works by never reaching it.
    if (status === 'active') {
      for (const sibling of this.rounds.values()) {
        if (sibling.id === id) continue;
        if (sibling.organizationId !== round.organizationId) continue;
        if (sibling.status !== 'active') continue;

        return {
          outcome: 'another_round_is_active',
          activeRound: cloneRound(sibling),
        };
      }
    }

    const updated: SurveyRound = { ...round, status, updatedAt: new Date() };
    this.rounds.set(id, updated);
    return { outcome: 'written', round: cloneRound(updated) };
  }

  public clear(): void {
    this.rounds.clear();
  }
}
