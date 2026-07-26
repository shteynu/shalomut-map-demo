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
  createdAt: Date;
}

export interface ManagerSession {
  managerId: string;
  email: string;
  activeOrganizationId: string;
  role: ManagerRole;
  memberships: OrganizationMembership[];
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
