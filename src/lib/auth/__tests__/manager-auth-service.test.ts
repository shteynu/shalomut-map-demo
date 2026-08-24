import assert from "node:assert/strict";
import test from "node:test";
import { InMemoryManagerRepository } from "../domain-contract";
import {
  ManagerAuthenticationService,
  managerPasswordWeakness,
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

/*
 * The password strength gate.
 *
 * One manager account per deployment means the password is the whole search
 * space, so these rules are the control rather than a formality. They apply on
 * a deployed runtime only: local development keeps `admin123`, which is the
 * point of having a local runtime.
 */

test("managerPasswordWeakness: accepts what .env.example tells the operator to generate", () => {
  // `openssl rand -hex 32` — 64 characters, sixteen distinct.
  assert.strictEqual(
    managerPasswordWeakness(
      "9f2c4b7e1a08d365fe4c2b9a70d1e83f5c6a4b2d8e0f1937a5c4b6d2e8f0a1c3",
    ),
    null,
  );
  // A long, varied passphrase is not what the docs suggest, but it is not weak.
  assert.strictEqual(
    managerPasswordWeakness("correct-horse-battery-staple-47"),
    null,
  );
});

test("managerPasswordWeakness: names why a password is unusable", () => {
  assert.strictEqual(managerPasswordWeakness("admin123"), "well-known");
  assert.strictEqual(managerPasswordWeakness("ADMIN123"), "well-known");
  assert.strictEqual(managerPasswordWeakness("123"), "too-short");
  // Fifteen characters: one short of the floor, and the floor is exclusive.
  assert.strictEqual(managerPasswordWeakness("aB3$xY9!qW2#zR7"), "too-short");
  assert.strictEqual(managerPasswordWeakness("aB3$xY9!qW2#zR7t"), null);
  // Long enough, and still barely a password.
  assert.strictEqual(
    managerPasswordWeakness("abababababababababab"),
    "too-few-distinct-characters",
  );
  // Surrounding whitespace is not strength; the runtime trims it too.
  assert.strictEqual(managerPasswordWeakness("   admin123   "), "well-known");
});

test("ManagerAuthenticationService: a weak password leaves a deployed runtime unconfigured", async () => {
  for (const weak of ["admin123", "short", "aaaaaaaaaaaaaaaaaaaa"]) {
    await withEnv(
      {
        NODE_ENV: "production",
        VERCEL_ENV: "production",
        SESSION_SECRET: "test-secret-12345678901234567890",
        MANAGER_ADMIN_PASSWORD: weak,
        MANAGER_ORGANIZATION_ID: "be9f184a-dee8-4d72-9805-c0f4e45f6d40",
      },
      async () => {
        assert.strictEqual(
          ManagerAuthenticationService.isUnconfigured(),
          true,
          `${weak} must not run a deployment`,
        );

        // And the refusal must not tell the caller which rule it broke: the
        // message is the same one a missing variable produces.
        const result =
          await ManagerAuthenticationService.authenticateCredentials(
            "admin@shalomut.edu.il",
            weak,
          );

        assert.strictEqual(result.ok, false);
        if (!result.ok) {
          assert.strictEqual(result.reason, "UNCONFIGURED");
          assert.ok(!result.message.includes(weak));
          assert.ok(!/short|distinct|weak|חלש/u.test(result.message));
        }
      },
    );
  }
});

test("ManagerAuthenticationService: a session minted before the gate stops renewing", async () => {
  // The gate has two doors and this is the quieter one. `isUnconfigured`
  // refuses a password being offered; renewal offers none — it holds a session
  // this runtime signed and asks whether the account is still there. A
  // deployment that gets this rule with a weak password already set would
  // otherwise keep renewing whoever was let in before it.
  await withEnv(
    {
      NODE_ENV: "production",
      VERCEL_ENV: "production",
      NEXT_PHASE: undefined,
      SESSION_SECRET: "test-secret-12345678901234567890",
      MANAGER_ADMIN_PASSWORD: "strong-enough-password-47",
      MANAGER_ORGANIZATION_ID: "be9f184a-dee8-4d72-9805-c0f4e45f6d40",
    },
    async () => {
      const account =
        await ManagerAuthenticationService.findAccountById("mgr-admin-001");
      assert.ok(account, "a usable password still vouches for its session");
    },
  );

  await withEnv(
    {
      NODE_ENV: "production",
      VERCEL_ENV: "production",
      NEXT_PHASE: undefined,
      SESSION_SECRET: "test-secret-12345678901234567890",
      MANAGER_ADMIN_PASSWORD: "admin123",
      MANAGER_ORGANIZATION_ID: "be9f184a-dee8-4d72-9805-c0f4e45f6d40",
    },
    async () => {
      assert.strictEqual(
        await ManagerAuthenticationService.findAccountById("mgr-admin-001"),
        null,
      );
    },
  );
});

test("ManagerAuthenticationService: local development is untouched by the gate", async () => {
  await withEnv(
    {
      NODE_ENV: "development",
      VERCEL_ENV: undefined,
      MANAGER_ADMIN_PASSWORD: undefined,
    },
    async () => {
      assert.strictEqual(ManagerAuthenticationService.isUnconfigured(), false);

      const result = await ManagerAuthenticationService.authenticateCredentials(
        "admin@shalomut.edu.il",
        "admin123",
      );

      assert.strictEqual(result.ok, true);
    },
  );
});
