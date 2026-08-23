import type {
  IOperationalEventRepository,
  OperationalEventInput,
  OperationalEventTally,
} from '../interfaces';

interface StoredEvent extends OperationalEventInput {
  observedAt: Date;
}

/**
 * The local wiring's operational log.
 *
 * It exists so a test can read what a route recorded without a database, and so
 * that local development is not a second code path: the sink is installed the
 * same way in both, and only the store behind it differs.
 */
export class InMemoryOperationalEventRepository
  implements IOperationalEventRepository
{
  private events: StoredEvent[] = [];

  public async record(event: OperationalEventInput): Promise<void> {
    this.events.push({ ...event, observedAt: new Date() });
  }

  public async tally(
    names: readonly string[],
    since: Date,
  ): Promise<Map<string, OperationalEventTally>> {
    const wanted = new Set(names);
    const tallies = new Map<string, OperationalEventTally>();

    for (const event of this.events) {
      if (!wanted.has(event.name)) continue;
      if (event.observedAt < since) continue;
      const existing = tallies.get(event.name) ?? {
        name: event.name,
        count: 0,
        sum: 0,
      };
      existing.count += 1;
      existing.sum += event.value ?? 0;
      tallies.set(event.name, existing);
    }

    return tallies;
  }

  public async prune(before: Date): Promise<number> {
    const kept = this.events.filter((event) => event.observedAt >= before);
    const removed = this.events.length - kept.length;
    this.events = kept;
    return removed;
  }

  /** Test seam: everything recorded, in the order it arrived. */
  public all(): readonly (OperationalEventInput & { observedAt: Date })[] {
    return this.events;
  }

  /** Test seam: places an event at a chosen moment, to age it past a window. */
  public recordAt(event: OperationalEventInput, observedAt: Date): void {
    this.events.push({ ...event, observedAt });
  }
}
