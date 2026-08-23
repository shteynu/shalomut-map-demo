import type {
  IOperationalEventRepository,
  OperationalEventInput,
  OperationalEventTally,
} from '../interfaces';
import type { MinimalPrismaClient } from './prisma-client';

export class PrismaOperationalEventRepository
  implements IOperationalEventRepository
{
  constructor(private prisma: MinimalPrismaClient) {}

  /**
   * A client generated before this migration has no delegate here. Said out
   * loud rather than surfacing as a `TypeError` from inside a sink, where it
   * would be swallowed and the counters would go quiet without anyone
   * being told why.
   */
  private get delegate(): NonNullable<MinimalPrismaClient['operationalEvent']> {
    if (!this.prisma.operationalEvent) {
      throw new Error(
        'The generated Prisma client does not expose operationalEvent. Run prisma generate after applying the operational events schema.',
      );
    }
    return this.prisma.operationalEvent;
  }

  public async record(event: OperationalEventInput): Promise<void> {
    await this.delegate.create({
      data: {
        kind: event.kind,
        name: event.name,
        value: event.value ?? null,
        unit: event.unit ?? null,
        labels: event.labels ?? undefined,
        runId: event.runId ?? null,
        roundId: event.roundId ?? null,
        detail: event.detail ?? undefined,
      },
    });
  }

  /**
   * One `GROUP BY` over the `(name, observed_at)` index rather than a query per
   * name. The alert runs on a monitor's schedule, forever, so it is built to
   * cost one round trip whatever the number of thresholds.
   */
  public async tally(
    names: readonly string[],
    since: Date,
  ): Promise<Map<string, OperationalEventTally>> {
    if (names.length === 0) return new Map();

    const groups = await this.delegate.groupBy({
      by: ['name'],
      where: { name: { in: [...names] }, observedAt: { gte: since } },
      _count: { _all: true },
      _sum: { value: true },
    });

    return new Map(
      groups.map((group: any) => [
        group.name as string,
        {
          name: group.name as string,
          count: Number(group._count?._all ?? 0),
          sum: Number(group._sum?.value ?? 0),
        },
      ]),
    );
  }

  public async prune(before: Date): Promise<number> {
    const { count } = await this.delegate.deleteMany({
      where: { observedAt: { lt: before } },
    });
    return count;
  }
}
