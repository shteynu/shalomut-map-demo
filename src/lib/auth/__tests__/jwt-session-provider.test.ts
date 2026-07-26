import assert from "node:assert/strict";
import test from "node:test";
import { JwtSessionProvider } from "../jwt-session-provider";
import type { Manager, OrganizationMembership } from "../types";

const mockManager: Manager = {
  id: "mgr-101",
  email: "manager@school.edu.il",
  name: "Sarah Manager",
  createdAt: new Date(),
};

const mockMembership: OrganizationMembership = {
  id: "mbs-101",
  managerId: "mgr-101",
  organizationId: "org-school-101",
  role: "manager",
  status: "active",
  createdAt: new Date(),
};

test("JwtSessionProvider creates and verifies valid JWT session tokens", async () => {
  const provider = new JwtSessionProvider("test-secret-key-12345");
  const { token, session } = await provider.createSession(
    mockManager,
    "org-school-101",
    [mockMembership],
  );

  assert.ok(token);
  assert.strictEqual(session.managerId, "mgr-101");
  assert.strictEqual(session.activeOrganizationId, "org-school-101");
  assert.strictEqual(session.role, "manager");

  const verified = await provider.verifyToken(token);
  assert.ok(verified);
  assert.strictEqual(verified.managerId, "mgr-101");
  assert.strictEqual(verified.activeOrganizationId, "org-school-101");
  assert.strictEqual(verified.role, "manager");
});

test("JwtSessionProvider rejects tampered or expired tokens", async () => {
  const provider = new JwtSessionProvider("test-secret-key-12345");
  const { token } = await provider.createSession(
    mockManager,
    "org-school-101",
    [mockMembership],
    -1, // Expired immediately
  );

  const verifiedExpired = await provider.verifyToken(token);
  assert.strictEqual(verifiedExpired, null);

  const tamperedToken = token.slice(0, -5) + "xxxxx";
  const verifiedTampered = await provider.verifyToken(tamperedToken);
  assert.strictEqual(verifiedTampered, null);
});
