import assert from 'node:assert/strict';
import test from 'node:test';
import {
  InMemoryAuditLogRepository,
  InMemoryManagerRepository,
  InMemorySessionProvider,
  ManagerAuthorizationService,
} from '../domain-contract';
import type { Manager, OrganizationMembership } from '../types';

const adminUser: Manager = {
  id: 'mgr-admin-1',
  email: 'admin@school-a.edu',
  name: 'School A Principal',
  isPlatformAdministrator: false,
  createdAt: new Date('2026-07-01T00:00:00.000Z'),
};

const managerUser: Manager = {
  id: 'mgr-user-1',
  email: 'teacher@school-a.edu',
  name: 'School A Teacher',
  isPlatformAdministrator: false,
  createdAt: new Date('2026-07-01T00:00:00.000Z'),
};

const suspendedUser: Manager = {
  id: 'mgr-suspended-1',
  email: 'former@school-a.edu',
  name: 'Former Staff',
  isPlatformAdministrator: false,
  createdAt: new Date('2026-07-01T00:00:00.000Z'),
};

const adminMembership: OrganizationMembership = {
  id: 'mem-1',
  managerId: adminUser.id,
  organizationId: 'org-school-a',
  role: 'admin',
  status: 'active',
  createdAt: new Date('2026-07-01T00:00:00.000Z'),
};

const managerMembership: OrganizationMembership = {
  id: 'mem-2',
  managerId: managerUser.id,
  organizationId: 'org-school-a',
  role: 'manager',
  status: 'active',
  createdAt: new Date('2026-07-01T00:00:00.000Z'),
};

const suspendedMembership: OrganizationMembership = {
  id: 'mem-3',
  managerId: suspendedUser.id,
  organizationId: 'org-school-a',
  role: 'manager',
  status: 'suspended',
  createdAt: new Date('2026-07-01T00:00:00.000Z'),
};

test('Manager Identity: authorizes active admin session', async () => {
  const sessionProvider = new InMemorySessionProvider();
  const { token } = await sessionProvider.createSession(
    adminUser,
    'org-school-a',
    [adminMembership],
  );

  const authResult = await ManagerAuthorizationService.authorizeManagerAccess(
    sessionProvider,
    token,
  );

  assert.strictEqual(authResult.ok, true);
  if (authResult.ok && authResult.context.type === 'manager') {
    assert.strictEqual(authResult.context.session.managerId, adminUser.id);
    assert.strictEqual(authResult.context.session.role, 'admin');
    assert.strictEqual(authResult.context.session.activeOrganizationId, 'org-school-a');
  }
});

test('Manager Identity: challenges missing, invalid or expired tokens with 401', async () => {
  const sessionProvider = new InMemorySessionProvider();
  const { token } = await sessionProvider.createSession(
    managerUser,
    'org-school-a',
    [managerMembership],
    { ttlSeconds: -10 }, // expired 10s ago
  );

  const missingResult = await ManagerAuthorizationService.authorizeManagerAccess(
    sessionProvider,
    null,
  );
  assert.strictEqual(missingResult.ok, false);
  if (!missingResult.ok) {
    assert.strictEqual(missingResult.error.statusCode, 401);
  }

  const invalidResult = await ManagerAuthorizationService.authorizeManagerAccess(
    sessionProvider,
    'invalid-token-123',
  );
  assert.strictEqual(invalidResult.ok, false);
  if (!invalidResult.ok) {
    assert.strictEqual(invalidResult.error.statusCode, 401);
  }

  const expiredResult = await ManagerAuthorizationService.authorizeManagerAccess(
    sessionProvider,
    token,
  );
  assert.strictEqual(expiredResult.ok, false);
  if (!expiredResult.ok) {
    assert.strictEqual(expiredResult.error.statusCode, 401);
  }
});

test('Manager Identity: forbids suspended membership with 403', async () => {
  const sessionProvider = new InMemorySessionProvider();
  const { token } = await sessionProvider.createSession(
    suspendedUser,
    'org-school-a',
    [suspendedMembership],
  );

  const authResult = await ManagerAuthorizationService.authorizeManagerAccess(
    sessionProvider,
    token,
  );

  assert.strictEqual(authResult.ok, false);
  if (!authResult.ok) {
    assert.strictEqual(authResult.error.statusCode, 403);
    assert.match(authResult.error.error, /no active membership/i);
  }
});

test('Role Authorization: requires admin role for sensitive management operations', async () => {
  const sessionProvider = new InMemorySessionProvider();
  const { token: managerToken } = await sessionProvider.createSession(
    managerUser,
    'org-school-a',
    [managerMembership],
  );

  const roleResult = await ManagerAuthorizationService.authorizeManagerAccess(
    sessionProvider,
    managerToken,
    'admin',
  );

  assert.strictEqual(roleResult.ok, false);
  if (!roleResult.ok) {
    assert.strictEqual(roleResult.error.statusCode, 403);
    assert.match(roleResult.error.error, /admin role required/i);
  }
});

test('Tenant Scope: hides foreign organization resources with 404 Not Found', async () => {
  const sessionProvider = new InMemorySessionProvider();
  const { session } = await sessionProvider.createSession(
    adminUser,
    'org-school-a',
    [adminMembership],
  );

  const ownResourceResult = ManagerAuthorizationService.authorizeResourceAccess(
    session,
    'org-school-a',
  );
  assert.strictEqual(ownResourceResult.ok, true);

  const foreignResourceResult = ManagerAuthorizationService.authorizeResourceAccess(
    session,
    'org-school-b', // Intruding into another school!
  );
  assert.strictEqual(foreignResourceResult.ok, false);
  if (!foreignResourceResult.ok) {
    // Crucial security requirement: MUST return 404 to avoid tenant entity enumeration
    assert.strictEqual(foreignResourceResult.error.statusCode, 404);
    assert.strictEqual(foreignResourceResult.error.error, 'Resource not found.');
  }
});

test('Route Isolation: respondent and machine routes bypass browser authentication', () => {
  for (const pathname of [
    '/answer/SHALOM-ABC123',
    '/api/survey/SHALOM-ABC123',
    '/api/survey/SHALOM-ABC123/submit',
  ]) {
    assert.strictEqual(
      ManagerAuthorizationService.isRespondentRoute(pathname),
      true,
      `Expected ${pathname} to be a respondent route`,
    );
  }

  assert.strictEqual(
    ManagerAuthorizationService.isMachineRoute('/api/mcp', 'POST'),
    true,
  );
  assert.strictEqual(
    ManagerAuthorizationService.isMachineRoute(
      '/api/rounds/round-1/ai-insights',
      'POST',
    ),
    true,
  );

  // GET on ai-insights is manager read, MUST NOT be a machine route
  assert.strictEqual(
    ManagerAuthorizationService.isMachineRoute(
      '/api/rounds/round-1/ai-insights',
      'GET',
    ),
    false,
  );
});

test('Audit Boundary: creates and records audit events for sensitive manager actions', async () => {
  const sessionProvider = new InMemorySessionProvider();
  const auditRepo = new InMemoryAuditLogRepository();

  const { session } = await sessionProvider.createSession(
    adminUser,
    'org-school-a',
    [adminMembership],
  );

  const event = ManagerAuthorizationService.createAuditEvent(
    'update_survey_definition',
    session,
    'round-101',
    { minimumResponses: 15 },
  );

  await auditRepo.recordEvent(event);

  const recorded = await auditRepo.findByOrganizationId('org-school-a');
  assert.strictEqual(recorded.length, 1);
  assert.strictEqual(recorded[0].action, 'update_survey_definition');
  assert.strictEqual(recorded[0].managerId, adminUser.id);
  assert.strictEqual(recorded[0].organizationId, 'org-school-a');
  assert.strictEqual(recorded[0].roundId, 'round-101');
});
