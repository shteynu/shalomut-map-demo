import type {
  AuditEvent,
  AuthorizeResult,
  Manager,
  ManagerRole,
  ManagerSession,
  OrganizationMembership,
} from './types';
import { absoluteDeadlineFrom, ttlSecondsWithin } from './session-lifetime';

/**
 * A school already has somebody standing, and the store refused a second.
 *
 * Thrown by `saveMembership` rather than returned, because it is the answer to
 * a question the caller believed it had already asked. Both callers read the
 * school's memberships and refuse a second standing one; this is what happens
 * when two of them read before either writes, which no amount of reading can
 * prevent. The database is the only thing that can refuse it atomically — the
 * partial unique index
 * `organization_memberships_one_standing_per_organization` — and this is that
 * refusal, in the domain's own words rather than as a `P2002`.
 *
 * Both implementations raise it, so the in-memory suite and PostgreSQL agree
 * about what the product does. The in-memory one cannot reproduce the race, and
 * that is not what it is for: it is there so no caller can be written against a
 * store that quietly allows two.
 */
export class SchoolAlreadyHasSomebodyError extends Error {
  constructor(public readonly organizationId: string) {
    super(`This school already has a standing membership: ${organizationId}`);
    this.name = 'SchoolAlreadyHasSomebodyError';
  }
}

export interface IManagerRepository {
  findById(id: string): Promise<Manager | null>;
  findByEmail(email: string): Promise<Manager | null>;
  findMembershipsByManagerId(managerId: string): Promise<OrganizationMembership[]>;
  /**
   * Who reaches one school, which is the question the administrator area asks
   * and no session ever does. A session is built from one person outward; this
   * reads from one school outward, and they are different queries against the
   * same rows.
   */
  findMembershipsByOrganizationId(
    organizationId: string,
  ): Promise<OrganizationMembership[]>;
  /**
   * The same question asked about many schools at once.
   *
   * The administrator overview needs every school's people, and asking school
   * by school made the screen cost one round trip per school — some 180 ms
   * apiece against the deployed database, which is how a hundred schools became
   * a function timeout. Named ids rather than "all of them" so the day the
   * console pages its list, the page is what it asks about.
   */
  findMembershipsByOrganizationIds(
    organizationIds: readonly string[],
  ): Promise<OrganizationMembership[]>;
  /**
   * Every person who may sign in.
   *
   * Only the administrator area calls this, and it is the reason that area is
   * gated rather than merely unlinked: this is the one query that returns a
   * list of named people.
   */
  findAllManagers(): Promise<Manager[]>;
  saveManager(manager: Manager): Promise<Manager>;
  saveMembership(membership: OrganizationMembership): Promise<OrganizationMembership>;
  /**
   * How many platform administrators exist, which is the only question the
   * bootstrap asks. A count rather than a list: nothing needs to know who they
   * are to decide whether the first one is still missing, and a list would
   * invite a screen that enumerates them without an audit trail.
   */
  countPlatformAdministrators(): Promise<number>;
}

/**
 * What a mint may be told, beyond who the session is for.
 *
 * Both fields exist for renewal and both default correctly without it: a fresh
 * sign-in names neither, and gets the configured window and a deadline starting
 * now. A renewal names `absoluteExpiresAt` — the one its predecessor carried —
 * which is what stops activity from extending a session forever.
 */
export interface SessionMintOptions {
  ttlSeconds?: number;
  absoluteExpiresAt?: Date;
}

export interface ISessionProvider {
  createSession(
    manager: Manager,
    activeOrganizationId: string | null,
    memberships: OrganizationMembership[],
    options?: SessionMintOptions,
  ): Promise<{ token: string; session: ManagerSession }>;

  verifyToken(token: string): Promise<ManagerSession | null>;
  revokeSession(token: string): Promise<void>;
}

/**
 * Where a page of the log ends and the next one starts.
 *
 * The cursor is the last event of the page just read, not an offset: an audit
 * log is written to while it is being read, and an offset would skip or repeat
 * whatever arrived in between. Both halves are needed because two events can
 * share a timestamp — the log is written by whoever is acting, and two
 * administrators act at once.
 */
export interface AuditLogCursor {
  timestamp: Date;
  id: string;
}

export interface AuditLogPage {
  /** Events at most. Absent means the default; above the maximum is clamped. */
  limit?: number;
  /** The last event of the previous page. Absent means start at the newest. */
  after?: AuditLogCursor;
}

/** A page nobody sized, and the largest one anybody may ask for. */
export const DEFAULT_AUDIT_LOG_PAGE_SIZE = 50;
export const MAXIMUM_AUDIT_LOG_PAGE_SIZE = 200;

/**
 * The size a page actually gets, resolved in one place for both stores.
 *
 * A caller asking for nothing, for a fraction, for zero or for ten thousand
 * gets a bounded answer, because the table this reads grows with every mutation
 * every school makes and never shrinks. Left to each repository, the clamp
 * would be two clamps that could disagree, and the one nobody runs tests
 * against would be the one serving the deployed screen.
 */
export function auditLogPageSize(requested?: number): number {
  if (requested === undefined || !Number.isInteger(requested) || requested < 1) {
    return DEFAULT_AUDIT_LOG_PAGE_SIZE;
  }
  return Math.min(requested, MAXIMUM_AUDIT_LOG_PAGE_SIZE);
}

/** Newest first, ties broken by id, so a cursor can always point past one row. */
export function compareAuditEventsNewestFirst(
  left: AuditEvent,
  right: AuditEvent,
): number {
  const byTime = right.timestamp.getTime() - left.timestamp.getTime();
  return byTime !== 0 ? byTime : right.id.localeCompare(left.id);
}

export interface IAuditLogRepository {
  recordEvent(event: AuditEvent): Promise<AuditEvent>;
  /**
   * One page of a school's log, newest first.
   *
   * Bounded before anything renders it rather than after. `audit_events` takes
   * a row from every mutation of every school and has no retention, so the
   * unbounded version of this read was a query whose cost was the age of the
   * platform — and the moment a screen calls it is the moment that stops being
   * theoretical.
   */
  findByOrganizationId(
    organizationId: string,
    page?: AuditLogPage,
  ): Promise<AuditEvent[]>;
}

export class InMemoryManagerRepository implements IManagerRepository {
  private managers = new Map<string, Manager>();
  private memberships = new Map<string, OrganizationMembership[]>();

  constructor(initialManagers: Manager[] = [], initialMemberships: OrganizationMembership[] = []) {
    for (const manager of initialManagers) {
      this.managers.set(manager.id, manager);
    }
    for (const membership of initialMemberships) {
      const existing = this.memberships.get(membership.managerId) ?? [];
      this.memberships.set(membership.managerId, [...existing, membership]);
    }
  }

  async findById(id: string): Promise<Manager | null> {
    return this.managers.get(id) ?? null;
  }

  async findByEmail(email: string): Promise<Manager | null> {
    const normalized = email.toLowerCase().trim();
    for (const manager of this.managers.values()) {
      if (manager.email.toLowerCase() === normalized) {
        return manager;
      }
    }
    return null;
  }

  async findMembershipsByManagerId(managerId: string): Promise<OrganizationMembership[]> {
    return this.memberships.get(managerId) ?? [];
  }

  async findMembershipsByOrganizationId(
    organizationId: string,
  ): Promise<OrganizationMembership[]> {
    return Array.from(this.memberships.values())
      .flat()
      .filter((membership) => membership.organizationId === organizationId);
  }

  async findMembershipsByOrganizationIds(
    organizationIds: readonly string[],
  ): Promise<OrganizationMembership[]> {
    const wanted = new Set(organizationIds);
    return Array.from(this.memberships.values())
      .flat()
      .filter((membership) => wanted.has(membership.organizationId));
  }

  async findAllManagers(): Promise<Manager[]> {
    return Array.from(this.managers.values());
  }

  async saveManager(manager: Manager): Promise<Manager> {
    this.managers.set(manager.id, manager);
    return manager;
  }

  async saveMembership(membership: OrganizationMembership): Promise<OrganizationMembership> {
    // The same rule PostgreSQL holds through its partial unique index. Kept
    // here so the two stores answer alike; a `Map` cannot reproduce the race
    // that makes the index necessary, and does not need to.
    if (membership.status === 'active' || membership.status === 'invited') {
      const conflicting = Array.from(this.memberships.values())
        .flat()
        .some(
          (row) =>
            row.organizationId === membership.organizationId &&
            row.id !== membership.id &&
            (row.status === 'active' || row.status === 'invited'),
        );
      if (conflicting) {
        throw new SchoolAlreadyHasSomebodyError(membership.organizationId);
      }
    }

    const existing = this.memberships.get(membership.managerId) ?? [];
    const index = existing.findIndex((m) => m.id === membership.id);
    if (index >= 0) {
      existing[index] = membership;
    } else {
      existing.push(membership);
    }
    this.memberships.set(membership.managerId, existing);
    return membership;
  }

  async countPlatformAdministrators(): Promise<number> {
    let count = 0;
    for (const manager of this.managers.values()) {
      if (manager.isPlatformAdministrator) count += 1;
    }
    return count;
  }
}

export class InMemorySessionProvider implements ISessionProvider {
  private sessions = new Map<string, ManagerSession>();

  async createSession(
    manager: Manager,
    activeOrganizationId: string | null,
    memberships: OrganizationMembership[],
    options: SessionMintOptions = {},
  ): Promise<{ token: string; session: ManagerSession }> {
    const membership = activeOrganizationId
      ? memberships.find((m) => m.organizationId === activeOrganizationId)
      : null;
    if (activeOrganizationId && !membership) {
      throw new Error(`Manager is not a member of organization '${activeOrganizationId}'`);
    }
    if (!activeOrganizationId && !manager.isPlatformAdministrator) {
      throw new Error('A school user session must name the school it is read inside');
    }

    const token = `token-${manager.id}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const now = new Date();
    const absoluteExpiresAt =
      options.absoluteExpiresAt ?? absoluteDeadlineFrom(now);
    const ttlSeconds = options.ttlSeconds ?? ttlSecondsWithin(absoluteExpiresAt, now);
    const expiresAt = new Date(now.getTime() + ttlSeconds * 1000);

    const session: ManagerSession = {
      managerId: manager.id,
      email: manager.email,
      activeOrganizationId,
      role: membership?.role ?? 'admin',
      memberships,
      isPlatformAdministrator: manager.isPlatformAdministrator,
      issuedAt: now,
      expiresAt,
      absoluteExpiresAt,
    };

    this.sessions.set(token, session);
    return { token, session };
  }

  async verifyToken(token: string): Promise<ManagerSession | null> {
    const session = this.sessions.get(token);
    if (!session) return null;
    const now = new Date();
    if (now > session.expiresAt || now > session.absoluteExpiresAt) {
      this.sessions.delete(token);
      return null;
    }
    return session;
  }

  async revokeSession(token: string): Promise<void> {
    this.sessions.delete(token);
  }
}

export class InMemoryAuditLogRepository implements IAuditLogRepository {
  private events: AuditEvent[] = [];

  async recordEvent(event: AuditEvent): Promise<AuditEvent> {
    this.events.push(event);
    return event;
  }

  /**
   * The same page the durable store returns, including the order.
   *
   * This used to hand back insertion order, which is not what PostgreSQL was
   * returning — the two stores disagreed about the log, and the one no test
   * runs against was the durable one. Sorting here is cheap and the divergence
   * was not.
   */
  async findByOrganizationId(
    organizationId: string,
    page?: AuditLogPage,
  ): Promise<AuditEvent[]> {
    const after = page?.after;
    return this.events
      .filter((event) => event.organizationId === organizationId)
      .filter(
        (event) =>
          !after ||
          event.timestamp.getTime() < after.timestamp.getTime() ||
          (event.timestamp.getTime() === after.timestamp.getTime() &&
            event.id.localeCompare(after.id) < 0),
      )
      .sort(compareAuditEventsNewestFirst)
      .slice(0, auditLogPageSize(page?.limit));
  }
}

const RESPONDENT_PREFIXES = ['/answer/', '/api/survey/'];
const AI_INSIGHTS_PATH = /^\/api\/rounds\/[^/]+\/ai-insights\/?$/;

export class ManagerAuthorizationService {
  public static isRespondentRoute(pathname: string): boolean {
    return RESPONDENT_PREFIXES.some((prefix) => pathname.startsWith(prefix));
  }

  public static isMachineRoute(pathname: string, method: string): boolean {
    if (pathname === '/api/mcp' || pathname === '/api/mcp/') return true;
    return method === 'POST' && AI_INSIGHTS_PATH.test(pathname);
  }

  public static async authorizeManagerAccess(
    sessionProvider: ISessionProvider,
    token: string | null,
    requiredRole?: ManagerRole,
  ): Promise<AuthorizeResult> {
    if (!token) {
      return {
        ok: false,
        error: { error: 'Authentication required.', statusCode: 401 },
      };
    }

    const session = await sessionProvider.verifyToken(token);
    if (!session) {
      return {
        ok: false,
        error: { error: 'Invalid or expired manager session.', statusCode: 401 },
      };
    }

    const activeMembership = session.memberships.find(
      (m) => m.organizationId === session.activeOrganizationId && m.status === 'active',
    );

    // A platform administrator is outside the membership system rather than a
    // member of everything, so asking which membership authorises them is the
    // wrong question. The flag is the answer.
    if (!activeMembership && !session.isPlatformAdministrator) {
      return {
        ok: false,
        error: { error: 'Manager has no active membership in the selected organization.', statusCode: 403 },
      };
    }

    if (
      requiredRole === 'admin' &&
      session.role !== 'admin' &&
      !session.isPlatformAdministrator
    ) {
      return {
        ok: false,
        error: { error: 'Insufficient permissions: admin role required.', statusCode: 403 },
      };
    }

    return {
      ok: true,
      context: {
        type: 'manager',
        session,
      },
    };
  }

  public static authorizeResourceAccess(
    session: ManagerSession,
    resourceOrganizationId: string,
  ): AuthorizeResult {
    if (
      session.activeOrganizationId !== resourceOrganizationId &&
      !session.isPlatformAdministrator
    ) {
      // Hiding foreign resources with 404 to avoid tenant entity enumeration
      return {
        ok: false,
        error: { error: 'Resource not found.', statusCode: 404 },
      };
    }

    return {
      ok: true,
      context: {
        type: 'manager',
        session,
      },
    };
  }

  public static createAuditEvent(
    action: string,
    session: ManagerSession,
    roundId?: string,
    details?: Record<string, unknown>,
  ): AuditEvent {
    return {
      id: `audit-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      timestamp: new Date(),
      action,
      managerId: session.managerId,
      // An event that names no school is an event nobody can file. A session
      // without one has not opened a school yet, so it has not acted on one.
      organizationId: session.activeOrganizationId ?? 'unknown',
      roundId,
      details,
    };
  }
}
