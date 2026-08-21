import type {
  AuditEvent,
  AuthorizeResult,
  Manager,
  ManagerRole,
  ManagerSession,
  OrganizationMembership,
} from './types';
import { absoluteDeadlineFrom, ttlSecondsWithin } from './session-lifetime';

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

export interface IAuditLogRepository {
  recordEvent(event: AuditEvent): Promise<AuditEvent>;
  findByOrganizationId(organizationId: string): Promise<AuditEvent[]>;
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

  async findAllManagers(): Promise<Manager[]> {
    return Array.from(this.managers.values());
  }

  async saveManager(manager: Manager): Promise<Manager> {
    this.managers.set(manager.id, manager);
    return manager;
  }

  async saveMembership(membership: OrganizationMembership): Promise<OrganizationMembership> {
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

  async findByOrganizationId(organizationId: string): Promise<AuditEvent[]> {
    return this.events.filter((e) => e.organizationId === organizationId);
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
