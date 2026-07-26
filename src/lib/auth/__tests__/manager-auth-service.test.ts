import assert from "node:assert/strict";
import test from "node:test";
import { ManagerAuthenticationService } from "../manager-auth-service";

test("ManagerAuthenticationService: authenticates valid admin credentials", async () => {
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

test("ManagerAuthenticationService: authenticates valid manager credentials", async () => {
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
