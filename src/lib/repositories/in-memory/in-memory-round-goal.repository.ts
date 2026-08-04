import { randomUUID } from 'node:crypto';
import type {
  CreateRoundGoalInput,
  CreateRoundGoalResult,
  RoundGoal,
  RoundGoalStatus,
} from '../../types/round-goal';
import { IRoundGoalRepository } from '../interfaces';

function clone(goal: RoundGoal): RoundGoal {
  return { ...goal, createdAt: new Date(goal.createdAt), updatedAt: new Date(goal.updatedAt) };
}

/**
 * The local wiring's goal store. It reproduces the unique key from the
 * migration, so a duplicate is refused here for the same reason it is refused
 * in PostgreSQL — but only the database can do it atomically, which is why the
 * concurrency proof lives in the `__dbtests__` suite rather than here.
 */
export class InMemoryRoundGoalRepository implements IRoundGoalRepository {
  private goals: Map<string, RoundGoal> = new Map();

  constructor(initialGoals: RoundGoal[] = []) {
    for (const goal of initialGoals) this.goals.set(goal.id, clone(goal));
  }

  public async create(
    roundId: string,
    input: CreateRoundGoalInput,
  ): Promise<CreateRoundGoalResult> {
    const existing = [...this.goals.values()].find(
      (goal) =>
        goal.roundId === roundId &&
        goal.dimensionId === input.dimensionId &&
        goal.title === input.title,
    );
    if (existing) return { outcome: 'duplicate', goal: clone(existing) };

    const now = new Date();
    const goal: RoundGoal = {
      id: randomUUID(),
      roundId,
      dimensionId: input.dimensionId,
      title: input.title,
      body: input.body,
      status: 'selected',
      createdAt: now,
      updatedAt: now,
    };
    this.goals.set(goal.id, goal);
    return { outcome: 'created', goal: clone(goal) };
  }

  public async findByRoundId(roundId: string): Promise<RoundGoal[]> {
    return [...this.goals.values()]
      .filter((goal) => goal.roundId === roundId)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
      .map(clone);
  }

  public async updateStatus(
    roundId: string,
    goalId: string,
    status: RoundGoalStatus,
  ): Promise<RoundGoal | null> {
    const found = this.goals.get(goalId);
    if (!found || found.roundId !== roundId) return null;

    found.status = status;
    found.updatedAt = new Date();
    return clone(found);
  }

  public async delete(roundId: string, goalId: string): Promise<boolean> {
    const found = this.goals.get(goalId);
    if (!found || found.roundId !== roundId) return false;

    this.goals.delete(goalId);
    return true;
  }

  public async deleteByRoundId(roundId: string): Promise<number> {
    const doomed = [...this.goals.values()].filter(
      (goal) => goal.roundId === roundId,
    );
    for (const goal of doomed) this.goals.delete(goal.id);
    return doomed.length;
  }

  public clear(): void {
    this.goals.clear();
  }
}
