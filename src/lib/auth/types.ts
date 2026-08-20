export type ManagerRole = 'admin' | 'manager';

export type MembershipStatus = 'active' | 'invited' | 'suspended';

export interface OrganizationMembership {
  id: string;
  managerId: string;
  organizationId: string;
  role: ManagerRole;
  status: MembershipStatus;
  createdAt: Date;
}

export interface Manager {
  id: string;
  email: string;
  name: string;
  /**
   * One of the handful of people who administer the platform itself.
   *
   * A property of the person and not a membership, which is what keeps an
   * administrator outside the membership system rather than a member of every
   * school: the number of schools never changes what their session carries.
   * Required rather than optional, because "the field was not set" and "this
   * person is not an administrator" must not be the same expression.
   */
  isPlatformAdministrator: boolean;
  createdAt: Date;
}

export interface ManagerSession {
  managerId: string;
  email: string;
  /**
   * The school this session lands on, or `null` for a platform administrator,
   * who belongs to none and chooses one per visit. A school user's session
   * always names one: it is their only school.
   */
  activeOrganizationId: string | null;
  role: ManagerRole;
  memberships: OrganizationMembership[];
  /**
   * Carried in the token so the middleware can answer "may this request open
   * that school" without a database read. It is the reason the plan could
   * refuse a membership lookup per request: Seoul database, Washington
   * functions, roughly 180 ms each time.
   */
  isPlatformAdministrator: boolean;
  issuedAt: Date;
  expiresAt: Date;
}

export interface ManagerAuthContext {
  type: 'manager';
  session: ManagerSession;
}

export interface MachineAuthContext {
  type: 'machine';
  serviceName: string;
}

export interface RespondentAuthContext {
  type: 'respondent';
  shareCode: string;
}

export interface AnonymousAuthContext {
  type: 'anonymous';
}

export type AuthContext =
  | ManagerAuthContext
  | MachineAuthContext
  | RespondentAuthContext
  | AnonymousAuthContext;

export interface AuthError {
  error: string;
  statusCode: 401 | 403 | 404;
}

export type AuthorizeResult =
  | { ok: true; context: AuthContext }
  | { ok: false; error: AuthError };

export interface AuditEvent {
  id: string;
  timestamp: Date;
  action: string;
  managerId: string;
  organizationId: string;
  roundId?: string;
  details?: Record<string, unknown>;
}
