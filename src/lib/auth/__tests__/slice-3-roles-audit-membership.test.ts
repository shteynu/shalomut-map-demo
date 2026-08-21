import assert from "node:assert/strict";
import test from "node:test";
import {
  InMemoryAuditLogRepository,
  InMemoryManagerRepository,
  InMemorySessionProvider,
} from "../domain-contract";
import { ManagerAuditService } from "../manager-audit-service";
import { MembershipService } from "../membership-service";
import { RolePermissionService } from "../roles-and-permissions";
import type { ManagerSession, OrganizationMembership } from "../types";

const mockMemberships: OrganizationMembership[] = [
  {
    id: "mbs-school-a",
    managerId: "mgr-cohen",
    organizationId: "org-school-a",
    role: "admin",
    status: "active",
    createdAt: new Date(),
  },
  {
    id: "mbs-school-b",
    managerId: "mgr-cohen",
    organizationId: "org-school-b",
    role: "manager",
    status: "active",
    createdAt: new Date(),
  },
];

const sessionAdminSchoolA: ManagerSession = {
  managerId: "mgr-cohen",
  email: "cohen@school-a.ac.il",
  activeOrganizationId: "org-school-a",
  role: "admin",
  memberships: mockMemberships,
  isPlatformAdministrator: false,
  issuedAt: new Date(),
  expiresAt: new Date(Date.now() + 86400000),
  absoluteExpiresAt: new Date(Date.now() + 86400000),
};

const sessionManagerSchoolB: ManagerSession = {
  managerId: "mgr-cohen",
  email: "cohen@school-a.ac.il",
  activeOrganizationId: "org-school-b",
  role: "manager",
  memberships: mockMemberships,
  isPlatformAdministrator: false,
  issuedAt: new Date(),
  expiresAt: new Date(Date.now() + 86400000),
  absoluteExpiresAt: new Date(Date.now() + 86400000),
};

test("RolePermissionService grants full mutation rights to admin and restricts manager to read-only", () => {
  assert.strictEqual(
    RolePermissionService.hasPermission("admin", "write:setup"),
    true,
  );
  assert.strictEqual(
    RolePermissionService.hasPermission("admin", "write:trigger-ai"),
    true,
  );
  assert.strictEqual(
    RolePermissionService.hasPermission("admin", "manage:members"),
    true,
  );

  assert.strictEqual(
    RolePermissionService.hasPermission("manager", "read:analytics"),
    true,
  );
  assert.strictEqual(
    RolePermissionService.hasPermission("manager", "write:setup"),
    false,
  );
  assert.strictEqual(
    RolePermissionService.hasPermission("manager", "write:trigger-ai"),
    false,
  );

  const enforceAdminSetup = RolePermissionService.enforcePermission(
    "admin",
    "write:setup",
  );
  assert.strictEqual(enforceAdminSetup.allowed, true);

  const enforceManagerSetup = RolePermissionService.enforcePermission(
    "manager",
    "write:setup",
  );
  assert.strictEqual(enforceManagerSetup.allowed, false);
});

test("ManagerAuditService records audit log events and enforces tenant isolation", async () => {
  const auditRepo = new InMemoryAuditLogRepository();

  const event1 = await ManagerAuditService.logEvent(
    auditRepo,
    sessionAdminSchoolA,
    "SETUP_SAVED",
    "round-101",
    { updatedFields: ["title", "privacyThreshold"] },
  );

  assert.ok(event1.id);
  assert.strictEqual(event1.managerId, "mgr-cohen");
  assert.strictEqual(event1.organizationId, "org-school-a");
  assert.strictEqual(event1.action, "SETUP_SAVED");

  const logsSchoolA = await ManagerAuditService.getOrganizationAuditLogs(
    auditRepo,
    sessionAdminSchoolA,
    "org-school-a",
  );
  assert.strictEqual(logsSchoolA.length, 1);
  assert.strictEqual(logsSchoolA[0].action, "SETUP_SAVED");

  const logsForeign = await ManagerAuditService.getOrganizationAuditLogs(
    auditRepo,
    sessionAdminSchoolA,
    "org-school-foreign",
  );
  assert.strictEqual(logsForeign.length, 0); // Foreign organization logs hidden
});

test("MembershipService allows multi-org managers to switch active organization", async () => {
  const sessionProvider = new InMemorySessionProvider();
  const managerRepo = new InMemoryManagerRepository(
    [
      {
        id: "mgr-cohen",
        email: "cohen@school-a.ac.il",
        name: "Cohen",
        isPlatformAdministrator: false,
        createdAt: new Date(),
      },
    ],
    mockMemberships,
  );

  const switched = await MembershipService.switchActiveOrganization(
    sessionProvider,
    sessionAdminSchoolA,
    "org-school-b",
  );

  assert.ok(switched);
  assert.strictEqual(switched.session.activeOrganizationId, "org-school-b");
  assert.strictEqual(switched.session.role, "manager");

  const invalidSwitch = await MembershipService.switchActiveOrganization(
    sessionProvider,
    sessionAdminSchoolA,
    "org-unauthorized-school",
  );
  assert.strictEqual(invalidSwitch, null);
});

test("MembershipService allows admin to add member and denies non-admins", async () => {
  const managerRepo = new InMemoryManagerRepository();

  const addedByAdmin = await MembershipService.addMembership(
    managerRepo,
    sessionAdminSchoolA,
    "mgr-new-teacher",
    "org-school-a",
    "manager",
  );
  assert.ok(addedByAdmin);
  assert.strictEqual(addedByAdmin.managerId, "mgr-new-teacher");
  assert.strictEqual(addedByAdmin.role, "manager");

  const addedByManager = await MembershipService.addMembership(
    managerRepo,
    sessionManagerSchoolB,
    "mgr-another-teacher",
    "org-school-b",
    "manager",
  );
  assert.strictEqual(addedByManager, null); // Manager role cannot add members
});

test("a platform administrator may read any school's log, and a school user only their own", async () => {
  const auditRepo = new InMemoryAuditLogRepository();
  await ManagerAuditService.logEvent(
    auditRepo,
    sessionAdminSchoolA,
    "SETUP_SAVED",
    "round-101",
  );

  const administrator: ManagerSession = {
    managerId: "mgr-operator",
    email: "operator@shalomut.example",
    // An administrator belongs to no school, which is why the old comparison
    // against the active organization gave them nothing at all.
    activeOrganizationId: null,
    role: "admin",
    memberships: [],
    isPlatformAdministrator: true,
    issuedAt: new Date(),
    expiresAt: new Date(Date.now() + 86400000),
  absoluteExpiresAt: new Date(Date.now() + 86400000),
  };

  const readByAdministrator = await ManagerAuditService.getOrganizationAuditLogs(
    auditRepo,
    administrator,
    "org-school-a",
  );
  assert.strictEqual(readByAdministrator.length, 1);

  const readByOutsider = await ManagerAuditService.getOrganizationAuditLogs(
    auditRepo,
    sessionManagerSchoolB,
    "org-school-a",
  );
  assert.strictEqual(readByOutsider.length, 0);
});
