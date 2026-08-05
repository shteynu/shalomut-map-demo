import type { WellbeingDimensionId } from '../../shalomut-source';
import type {
  CreateRoundGoalInput,
  CreateRoundGoalResult,
  RoundGoal,
  RoundGoalStatus,
} from '../../types/round-goal';
import { IRoundGoalRepository } from '../interfaces';
import { MinimalPrismaClient } from './prisma-client';

function toDomain(row: any): RoundGoal {
  return {
    id: row.id,
    roundId: row.roundId,
    dimensionId: row.dimensionId as WellbeingDimensionId,
    title: row.title,
    body: row.body,
    status: row.status as RoundGoalStatus,
    createdAt: new Date(row.createdAt),
    updatedAt: new Date(row.updatedAt),
  };
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'P2002'
  );
}

export class PrismaRoundGoalRepository implements IRoundGoalRepository {
  constructor(private prisma: MinimalPrismaClient) {}

  /**
   * A client generated before the goals migration has no delegate here, which
   * would otherwise surface as a `TypeError` deep inside a route. It says what
   * to run instead.
   */
  private get delegate(): NonNullable<MinimalPrismaClient['roundGoal']> {
    if (!this.prisma.roundGoal) {
      throw new Error(
        'The generated Prisma client does not expose roundGoal. Run prisma generate after applying the round goals schema.',
      );
    }
    return this.prisma.roundGoal;
  }

  public async create(
    roundId: string,
    input: CreateRoundGoalInput,
  ): Promise<CreateRoundGoalResult> {
    try {
      const created = await this.delegate.create({
        data: {
          roundId,
          dimensionId: input.dimensionId,
          title: input.title,
          body: input.body,
          status: 'selected' satisfies RoundGoalStatus,
        },
      });
      return { outcome: 'created', goal: toDomain(created) };
    } catch (error) {
      if (!isUniqueConstraintError(error)) throw error;

      // The row that won the race is read back rather than the constraint name
      // matched: this table has one unique key, and a `P2002` that turns out not
      // to have this goal behind it is a defect that must keep throwing rather
      // than be answered with a reassuring "already tracked".
      const existing = await this.delegate.findFirst({
        where: {
          roundId,
          dimensionId: input.dimensionId,
          title: input.title,
        },
      });
      if (!existing) throw error;

      return { outcome: 'duplicate', goal: toDomain(existing) };
    }
  }

  public async findByRoundId(roundId: string): Promise<RoundGoal[]> {
    const rows = await this.delegate.findMany({
      where: { roundId },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map(toDomain);
  }

  public async findByRoundIds(roundIds: string[]): Promise<RoundGoal[]> {
    // An empty list is a school with no rounds, not "every goal there is".
    // `in: []` matches nothing in PostgreSQL, but the query is pointless, and
    // the intent is worth being explicit about.
    if (roundIds.length === 0) return [];

    const rows = await this.delegate.findMany({
      where: { roundId: { in: roundIds } },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map(toDomain);
  }

  public async updateStatus(
    roundId: string,
    goalId: string,
    status: RoundGoalStatus,
  ): Promise<RoundGoal | null> {
    // Scoped by round in the `where`, so a goal id from another school updates
    // nothing instead of updating a row the caller was never authorized for.
    const changed = await this.delegate.updateMany({
      where: { id: goalId, roundId },
      data: { status },
    });
    if (changed.count === 0) return null;

    const updated = await this.delegate.findFirst({
      where: { id: goalId, roundId },
    });
    return updated ? toDomain(updated) : null;
  }

  public async delete(roundId: string, goalId: string): Promise<boolean> {
    const deleted = await this.delegate.deleteMany({
      where: { id: goalId, roundId },
    });
    return deleted.count > 0;
  }

  public async deleteByRoundId(roundId: string): Promise<number> {
    const deleted = await this.delegate.deleteMany({
      where: { roundId },
    });
    return deleted.count;
  }
}
