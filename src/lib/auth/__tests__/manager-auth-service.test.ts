import assert from "node:assert/strict";
import test from "node:test";
import { ManagerAuthenticationService } from "../manager-auth-service";

test("ManagerAuthenticationService: authenticates valid admin credentials in dev", async () => {
  const result = await ManagerAuthenticationService.authenticateCredentials(
    "admin@shalomut.edu.il",
    "admin123",
  );

  assert.strictEqual(result.ok, true);
  if (result.ok) {
    assert.strictEqual(result.manager.email, "admin@shalomut.edu.il");
    assert.strictEqual(result.memberships.length, 1);
    assert.strictEqual(result.memberships[0].role, "admin");
    assert.strictEqual(result.memberships[0].status, "active");
  }
});

test("ManagerAuthenticationService: authenticates valid manager credentials in dev", async () => {
  const result = await ManagerAuthenticationService.authenticateCredentials(
    "manager@shalomut.edu.il",
    "manager123",
  );

  assert.strictEqual(result.ok, true);
  if (result.ok) {
    assert.strictEqual(result.manager.email, "manager@shalomut.edu.il");
    assert.strictEqual(result.memberships[0].role, "manager");
  }
});

test("ManagerAuthenticationService: rejects invalid password", async () => {
  const result = await ManagerAuthenticationService.authenticateCredentials(
    "admin@shalomut.edu.il",
    "wrong-password",
  );

  assert.strictEqual(result.ok, false);
  if (!result.ok) {
    assert.strictEqual(result.reason, "INVALID_CREDENTIALS");
  }
});

test("ManagerAuthenticationService: rejects non-existent user", async () => {
  const result = await ManagerAuthenticationService.authenticateCredentials(
    "unknown@shalomut.edu.il",
    "password123",
  );

  assert.strictEqual(result.ok, false);
  if (!result.ok) {
    assert.strictEqual(result.reason, "USER_NOT_FOUND");
  }
});

test("ManagerAuthenticationService: rejects suspended manager account", async () => {
  const result = await ManagerAuthenticationService.authenticateCredentials(
    "suspended@shalomut.edu.il",
    "suspended123",
  );

  assert.strictEqual(result.ok, false);
  if (!result.ok) {
    assert.strictEqual(result.reason, "ACCOUNT_SUSPENDED");
  }
});

test("ManagerAuthenticationService: returns UNCONFIGURED 503 error in deployed runtime when secrets are missing", async () => {
  const origEnv = process.env.NODE_ENV;
  const origVercel = process.env.VERCEL_ENV;
  const origSecret = process.env.SESSION_SECRET;
  const origAdminPass = process.env.MANAGER_ADMIN_PASSWORD;

  try {
    process.env.NODE_ENV = "production";
    process.env.VERCEL_ENV = "production";
    delete process.env.SESSION_SECRET;
    delete process.env.MANAGER_ADMIN_PASSWORD;

    const isUnconfigured = ManagerAuthenticationService.isUnconfigured();
    assert.strictEqual(isUnconfigured, true);

    const result = await ManagerAuthenticationService.authenticateCredentials(
      "admin@shalomut.edu.il",
      "admin123",
    );

    assert.strictEqual(result.ok, false);
    if (!result.ok) {
      assert.strictEqual(result.reason, "UNCONFIGURED");
    }
  } finally {
    process.env.NODE_ENV = origEnv;
    if (origVercel !== undefined) process.env.VERCEL_ENV = origVercel;
    else delete process.env.VERCEL_ENV;
    if (origSecret !== undefined) process.env.SESSION_SECRET = origSecret;
    else delete process.env.SESSION_SECRET;
    if (origAdminPass !== undefined) process.env.MANAGER_ADMIN_PASSWORD = origAdminPass;
    else delete process.env.MANAGER_ADMIN_PASSWORD;
  }
});

test("ManagerAuthenticationService: rejects default manager123 in deployed runtime even if admin password is set", async () => {
  const origEnv = process.env.NODE_ENV;
  const origVercel = process.env.VERCEL_ENV;
  const origAdminPass = process.env.MANAGER_ADMIN_PASSWORD;
  const origSecret = process.env.SESSION_SECRET;

  try {
    process.env.NODE_ENV = "production";
    process.env.VERCEL_ENV = "production";
    process.env.SESSION_SECRET = "test-secret-12345678901234567890";
    process.env.MANAGER_ADMIN_PASSWORD = "custom-prod-password";

    const resultManager = await ManagerAuthenticationService.authenticateCredentials(
      "manager@shalomut.edu.il",
      "manager123",
    );

    assert.strictEqual(resultManager.ok, false);
    if (!resultManager.ok) {
      assert.strictEqual(resultManager.reason, "USER_NOT_FOUND");
    }

    const resultAdmin = await ManagerAuthenticationService.authenticateCredentials(
      "admin@shalomut.edu.il",
      "custom-prod-password",
    );
    assert.strictEqual(resultAdmin.ok, true);
  } finally {
    process.env.NODE_ENV = origEnv;
    if (origVercel !== undefined) process.env.VERCEL_ENV = origVercel;
    else delete process.env.VERCEL_ENV;
    if (origSecret !== undefined) process.env.SESSION_SECRET = origSecret;
    else delete process.env.SESSION_SECRET;
    if (origAdminPass !== undefined) process.env.MANAGER_ADMIN_PASSWORD = origAdminPass;
    else delete process.env.MANAGER_ADMIN_PASSWORD;
  }
});
