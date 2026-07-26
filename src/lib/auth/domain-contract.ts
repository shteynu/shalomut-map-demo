import type {
  AuditEvent,
  AuthorizeResult,
  Manager,
  ManagerRole,
  ManagerSession,
  OrganizationMembership,
} from './types';

export interface IManagerRepository {
  findById(id: string): Promise<Manager | null>;
  findByEmail(email: string): Promise<Manager | null>;
  findMembershipsByManagerId(managerId: string): Promise<OrganizationMembership[]>;
  saveManager(manager: Manager): Promise<Manager>;
  saveMembership(membership: OrganizationMembership): Promise<OrganizationMembership>;
}

export interface ISessionProvider {
  createSession(
    manager: Manager,
    activeOrganizationId: string,
    memberships: OrganizationMembership[],
    ttlSeconds?: number,
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
}

export class InMemorySessionProvider implements ISessionProvider {
  private sessions = new Map<string, ManagerSession>();

  async createSession(
    manager: Manager,
    activeOrganizationId: string,
    memberships: OrganizationMembership[],
    ttlSeconds = 86400,
  ): Promise<{ token: string; session: ManagerSession }> {
    const membership = memberships.find(
      (m) => m.organizationId === activeOrganizationId,
    );
    if (!membership) {
      throw new Error(`Manager is not a member of organization '${activeOrganizationId}'`);
    }

    const token = `token-${manager.id}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + ttlSeconds * 1000);

    const session: ManagerSession = {
      managerId: manager.id,
      email: manager.email,
      activeOrganizationId,
      role: membership.role,
      memberships,
      issuedAt: now,
      expiresAt,
    };

    this.sessions.set(token, session);
    return { token, session };
  }

  async verifyToken(token: string): Promise<ManagerSession | null> {
    const session = this.sessions.get(token);
    if (!session) return null;
    if (new Date() > session.expiresAt) {
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

    if (!activeMembership) {
      return {
        ok: false,
        error: { error: 'Manager has no active membership in the selected organization.', statusCode: 403 },
      };
    }

    if (requiredRole === 'admin' && session.role !== 'admin') {
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
    if (session.activeOrganizationId !== resourceOrganizationId) {
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
      organizationId: session.activeOrganizationId,
      roundId,
      details,
    };
  }
}
