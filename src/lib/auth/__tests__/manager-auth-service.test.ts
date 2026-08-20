import assert from "node:assert/strict";
import test from "node:test";
import { InMemoryManagerRepository } from "../domain-contract";
import {
  ManagerAuthenticationService,
  resolveManagerOrganizationId,
} from "../manager-auth-service";

const ENV_KEYS = [
  "NODE_ENV",
  "VERCEL_ENV",
  "NEXT_PHASE",
  "SESSION_SECRET",
  "MANAGER_ADMIN_PASSWORD",
  "MANAGER_ORGANIZATION_ID",
] as const;

/**
 * `next` declares `NODE_ENV` as a readonly literal union, so writing it back
 * needs a mutable view of the very same object.
 */
const mutableEnv = process.env as Record<string, string | undefined>;

/**
 * Runs `body` with the given process env overrides (`undefined` deletes the
 * variable) and restores the previous values afterwards.
 */
async function withEnv(
  overrides: Partial<Record<(typeof ENV_KEYS)[number], string | undefined>>,
  body: () => Promise<void> | void,
) {
  const original = Object.fromEntries(
    ENV_KEYS.map((key) => [key, process.env[key]]),
  );

  try {
    for (const [key, value] of Object.entries(overrides)) {
      if (value === undefined) delete mutableEnv[key];
      else mutableEnv[key] = value;
    }
    await body();
  } finally {
    for (const key of ENV_KEYS) {
      const value = original[key];
      if (value === undefined) delete mutableEnv[key];
      else mutableEnv[key] = value;
    }
  }
}

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

test("ManagerAuthenticationService: a manager record is not a credential", async () => {
  // The service used to take an optional manager repository and, when one was
  // supplied, hand back a session for anyone that repository could find by
  // email — no password verified, and none stored to verify, because a manager
  // record carries no credential. The parameter is gone; this passes one
  // anyway, the way a future caller might, and requires it to change nothing.
  const knownManager = {
    id: "mgr-cohen",
    email: "cohen@school-a.ac.il",
    name: "Cohen",
    isPlatformAdministrator: false,
    createdAt: new Date(),
  };
  const membership = {
    id: "mbs-school-a",
    managerId: knownManager.id,
    organizationId: "org-school-a",
    role: "admin" as const,
    status: "active" as const,
    createdAt: new Date(),
  };
  const repository = new InMemoryManagerRepository(
    [knownManager],
    [membership],
  );
  assert.ok(await repository.findByEmail(knownManager.email));

  const authenticateWithRepository =
    ManagerAuthenticationService.authenticateCredentials.bind(
      ManagerAuthenticationService,
    ) as unknown as (
      email: string,
      password: string,
      repository: unknown,
    ) => ReturnType<typeof ManagerAuthenticationService.authenticateCredentials>;

  const result = await authenticateWithRepository(
    knownManager.email,
    "any-password-at-all",
    repository,
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
  await withEnv(
    {
      NODE_ENV: "production",
      VERCEL_ENV: "production",
      SESSION_SECRET: undefined,
      MANAGER_ADMIN_PASSWORD: undefined,
      MANAGER_ORGANIZATION_ID: "be9f184a-dee8-4d72-9805-c0f4e45f6d40",
    },
    async () => {
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
    },
  );
});

test("ManagerAuthenticationService: rejects default manager123 in deployed runtime even if admin password is set", async () => {
  await withEnv(
    {
      NODE_ENV: "production",
      VERCEL_ENV: "production",
      SESSION_SECRET: "test-secret-12345678901234567890",
      MANAGER_ADMIN_PASSWORD: "custom-prod-password",
      MANAGER_ORGANIZATION_ID: "be9f184a-dee8-4d72-9805-c0f4e45f6d40",
    },
    async () => {
      const resultManager =
        await ManagerAuthenticationService.authenticateCredentials(
          "manager@shalomut.edu.il",
          "manager123",
        );

      assert.strictEqual(resultManager.ok, false);
      if (!resultManager.ok) {
        assert.strictEqual(resultManager.reason, "USER_NOT_FOUND");
      }

      const resultAdmin =
        await ManagerAuthenticationService.authenticateCredentials(
          "admin@shalomut.edu.il",
          "custom-prod-password",
        );
      assert.strictEqual(resultAdmin.ok, true);
    },
  );
});

test("resolveManagerOrganizationId: has no organization to fall back to in a deployed runtime", async () => {
  await withEnv(
    {
      NODE_ENV: "production",
      VERCEL_ENV: "production",
      NEXT_PHASE: undefined,
      MANAGER_ORGANIZATION_ID: undefined,
    },
    () => {
      assert.strictEqual(resolveManagerOrganizationId(), null);
    },
  );

  // A preview deployment is a deployed runtime too, even with NODE_ENV unset.
  await withEnv(
    {
      NODE_ENV: undefined,
      VERCEL_ENV: "preview",
      NEXT_PHASE: undefined,
      MANAGER_ORGANIZATION_ID: "   ",
    },
    () => {
      assert.strictEqual(resolveManagerOrganizationId(), null);
    },
  );
});

test("resolveManagerOrganizationId: uses the configured organization when it is set", async () => {
  await withEnv(
    {
      NODE_ENV: "production",
      VERCEL_ENV: "production",
      MANAGER_ORGANIZATION_ID: " be9f184a-dee8-4d72-9805-c0f4e45f6d40 ",
    },
    () => {
      assert.strictEqual(
        resolveManagerOrganizationId(),
        "be9f184a-dee8-4d72-9805-c0f4e45f6d40",
      );
    },
  );
});

test("resolveManagerOrganizationId: falls back only outside a deployed runtime, never to the retired organization", async () => {
  await withEnv(
    {
      NODE_ENV: "development",
      VERCEL_ENV: undefined,
      NEXT_PHASE: undefined,
      MANAGER_ORGANIZATION_ID: undefined,
    },
    () => {
      const organizationId = resolveManagerOrganizationId();
      assert.ok(organizationId);
      assert.notStrictEqual(
        organizationId,
        "34d05e66-fa4d-4a07-a2af-c9d5c41b6088",
      );
    },
  );

  // The production build runs without runtime env, so it must not fail closed.
  await withEnv(
    {
      NODE_ENV: "production",
      VERCEL_ENV: "production",
      NEXT_PHASE: "phase-production-build",
      MANAGER_ORGANIZATION_ID: undefined,
    },
    () => {
      assert.ok(resolveManagerOrganizationId());
    },
  );
});

test("ManagerAuthenticationService: returns UNCONFIGURED in deployed runtime when only MANAGER_ORGANIZATION_ID is missing", async () => {
  await withEnv(
    {
      NODE_ENV: "production",
      VERCEL_ENV: "production",
      NEXT_PHASE: undefined,
      SESSION_SECRET: "test-secret-12345678901234567890",
      MANAGER_ADMIN_PASSWORD: "custom-prod-password",
      MANAGER_ORGANIZATION_ID: undefined,
    },
    async () => {
      assert.strictEqual(ManagerAuthenticationService.isUnconfigured(), true);

      // Correct credentials must still fail loudly instead of issuing a
      // session scoped to a non-existent organization.
      const result = await ManagerAuthenticationService.authenticateCredentials(
        "admin@shalomut.edu.il",
        "custom-prod-password",
      );

      assert.strictEqual(result.ok, false);
      if (!result.ok) {
        assert.strictEqual(result.reason, "UNCONFIGURED");
      }
    },
  );
});

test("ManagerAuthenticationService: scopes the deployed session to the configured organization", async () => {
  await withEnv(
    {
      NODE_ENV: "production",
      VERCEL_ENV: "production",
      NEXT_PHASE: undefined,
      SESSION_SECRET: "test-secret-12345678901234567890",
      MANAGER_ADMIN_PASSWORD: "custom-prod-password",
      MANAGER_ORGANIZATION_ID: "be9f184a-dee8-4d72-9805-c0f4e45f6d40",
    },
    async () => {
      assert.strictEqual(ManagerAuthenticationService.isUnconfigured(), false);

      const result = await ManagerAuthenticationService.authenticateCredentials(
        "admin@shalomut.edu.il",
        "custom-prod-password",
      );

      assert.strictEqual(result.ok, true);
      if (result.ok) {
        assert.strictEqual(result.memberships.length, 1);
        assert.strictEqual(
          result.memberships[0].organizationId,
          "be9f184a-dee8-4d72-9805-c0f4e45f6d40",
        );
      }
    },
  );
});
