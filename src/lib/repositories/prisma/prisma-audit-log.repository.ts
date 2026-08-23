import {
  auditLogPageSize,
  type AuditLogPage,
  type IAuditLogRepository,
} from '../../auth/domain-contract';
import type { AuditEvent } from '../../auth/types';
import { MinimalPrismaClient } from './prisma-client';

interface AuditEventRow {
  id: string;
  timestamp: Date | string;
  action: string;
  managerId: string;
  organizationId: string;
  roundId: string | null;
  details: unknown;
}

function toAuditEvent(row: AuditEventRow): AuditEvent {
  return {
    id: row.id,
    timestamp: new Date(row.timestamp),
    action: row.action,
    managerId: row.managerId,
    organizationId: row.organizationId,
    ...(row.roundId ? { roundId: row.roundId } : {}),
    ...(row.details && typeof row.details === 'object'
      ? { details: row.details as Record<string, unknown> }
      : {}),
  };
}

/**
 * What a manager did, kept where a restart cannot reach it.
 *
 * The in-memory store this replaces was honest about being process-local, which
 * meant an audit trail lasted until the next deployment. That was tolerable
 * while one operator could reach one school; it stopped being tolerable the day
 * a platform administrator could open every school.
 */
export class PrismaAuditLogRepository implements IAuditLogRepository {
  constructor(private prisma: MinimalPrismaClient) {}

  private get events() {
    const table = this.prisma.auditEvent;
    if (!table) {
      throw new Error(
        'The Prisma client has no `auditEvent` model, so nothing can be ' +
          'audited durably. Run `prisma generate` after the migration that ' +
          'creates it.',
      );
    }
    return table;
  }

  /**
   * Writes the row, and lets a duplicate id pass rather than fail.
   *
   * Two writers can agree on the same id only by generating the same timestamp
   * and the same random suffix, so a collision here means the same event was
   * recorded twice rather than two events colliding. An audit log would rather
   * hold one copy than reject the write.
   */
  public async recordEvent(event: AuditEvent): Promise<AuditEvent> {
    const saved = await this.events.upsert({
      where: { id: event.id },
      create: {
        id: event.id,
        timestamp: event.timestamp,
        action: event.action,
        managerId: event.managerId,
        organizationId: event.organizationId,
        roundId: event.roundId ?? null,
        details: event.details ?? undefined,
      },
      update: {},
    });
    return toAuditEvent(saved);
  }

  /**
   * One page of a school's log, newest first — the order anybody reading it
   * wants, and the direction a cursor has to walk.
   *
   * Bounded rather than whole. This table takes a row from every mutation of
   * every school and nothing prunes it, so an unbounded read is a query that
   * gets slower for as long as the platform stays up. The bound is here before
   * a screen exists rather than after one does.
   *
   * The `[organizationId, timestamp]` index carries both the filter and the
   * order, so a page costs the page and not the history behind it. The tie-break
   * on `id` is what keeps the cursor from stepping over an event that shares a
   * timestamp with the last one read — and two do, whenever two administrators
   * act in the same millisecond.
   */
  public async findByOrganizationId(
    organizationId: string,
    page?: AuditLogPage,
  ): Promise<AuditEvent[]> {
    const after = page?.after;
    const rows = await this.events.findMany({
      where: {
        organizationId,
        ...(after
          ? {
              OR: [
                { timestamp: { lt: after.timestamp } },
                { AND: [{ timestamp: after.timestamp }, { id: { lt: after.id } }] },
              ],
            }
          : {}),
      },
      orderBy: [{ timestamp: 'desc' }, { id: 'desc' }],
      take: auditLogPageSize(page?.limit),
    });
    return rows.map(toAuditEvent);
  }
}
