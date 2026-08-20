import type { IAuditLogRepository } from '../../auth/domain-contract';
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

  /** One school's log, newest first — the order anybody reading it wants. */
  public async findByOrganizationId(
    organizationId: string,
  ): Promise<AuditEvent[]> {
    const rows = await this.events.findMany({
      where: { organizationId },
      orderBy: { timestamp: 'desc' },
    });
    return rows.map(toAuditEvent);
  }
}
