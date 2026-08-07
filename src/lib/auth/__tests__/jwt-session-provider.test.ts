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

test("verifyToken passes the signature as a typed array, so a foreign-realm ArrayBuffer cannot break it", async () => {
  const provider = new JwtSessionProvider("realm-test-secret-0123456789");
  const { token } = await provider.createSession(
    {
      id: "mgr-realm-001",
      email: "principal@shalom-school.ac.il",
      name: "Principal Cohen",
      createdAt: new Date(),
    },
    "org-realm-001",
    [
      {
        id: "mbs-realm-001",
        managerId: "mgr-realm-001",
        organizationId: "org-realm-001",
        role: "admin",
        status: "active",
        createdAt: new Date(),
      },
    ],
  );

  /**
   * The middleware runs in a sandbox with its own realm, where an
   * `ArrayBuffer` fails `instanceof ArrayBuffer` inside SubtleCrypto and the
   * call throws before it looks at the signature. A test cannot create a
   * second realm, so it checks the property that made the code realm-proof:
   * what reaches `verify` is a view, which `ArrayBuffer.isView` recognises no
   * matter who allocated it.
   */
  const originalVerify = crypto.subtle.verify.bind(crypto.subtle);
  const seen: unknown[] = [];
  crypto.subtle.verify = ((
    algorithm: AlgorithmIdentifier,
    key: CryptoKey,
    signature: BufferSource,
    data: BufferSource,
  ) => {
    seen.push(signature);
    return originalVerify(algorithm, key, signature, data);
  }) as typeof crypto.subtle.verify;

  try {
    const session = await provider.verifyToken(token);
    assert.ok(session);
    assert.strictEqual(seen.length, 1);
    assert.ok(
      ArrayBuffer.isView(seen[0]),
      "the signature must reach SubtleCrypto as a view, not as a raw ArrayBuffer",
    );
  } finally {
    crypto.subtle.verify = originalVerify;
  }
});
