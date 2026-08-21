import assert from "node:assert/strict";
import test from "node:test";
import { PrismaManagerRepository } from "..";
import type { MinimalPrismaClient } from "../prisma/prisma-client";
import type { Manager, OrganizationMembership } from "../../auth/types";

/**
 * Enough of a Prisma client to answer the four questions this repository asks,
 * with the two constraints the migration actually enforces: the address is
 * unique and lowercased, and one person is a member of one school once.
 */
function createManagerClient() {
  const managers = new Map<string, any>();
  const memberships = new Map<string, any>();

  const client: MinimalPrismaClient = {
    organization: {} as never,
    surveyRound: {} as never,
    surveyResponse: {} as never,
    manager: {
      findMany: async () => Array.from(managers.values()),
      findUnique: async ({ where }: any) => {
        if (where.id) return managers.get(where.id) ?? null;
        for (const row of managers.values()) {
          if (row.email === where.email) return row;
        }
        return null;
      },
      upsert: async ({ where, create, update }: any) => {
        const existing = managers.get(where.id);
        const row = existing
          ? { ...existing, ...update }
          : { createdAt: new Date(), ...create };
        for (const [id, other] of managers) {
          if (id !== row.id && other.email === row.email) {
            throw new Error("managers_email_key");
          }
        }
        managers.set(row.id, row);
        return row;
      },
      count: async ({ where }: any = {}) =>
        Array.from(managers.values()).filter((row) =>
          Object.entries(where ?? {}).every(
            ([field, value]) => row[field] === value,
          ),
        ).length,
      deleteMany: async () => {
        const count = managers.size;
        managers.clear();
        return { count };
      },
    },
    organizationMembership: {
      findMany: async ({ where }: any) =>
        Array.from(memberships.values()).filter(
          (row) => row.managerId === where.managerId,
        ),
      upsert: async ({ where, create, update }: any) => {
        const existing = memberships.get(where.id);
        const row = existing
          ? { ...existing, ...update }
          : { createdAt: new Date(), ...create };
        for (const [id, other] of memberships) {
          if (
            id !== row.id &&
            other.managerId === row.managerId &&
            other.organizationId === row.organizationId
          ) {
            throw new Error("organization_memberships_manager_id_organization_id_key");
          }
        }
        memberships.set(row.id, row);
        return row;
      },
      deleteMany: async () => {
        const count = memberships.size;
        memberships.clear();
        return { count };
      },
    },
  };

  return { client, managers, memberships };
}

const cohen: Manager = {
  id: "mgr-cohen",
  email: "Cohen@School.ac.il",
  name: "Principal Cohen",
  isPlatformAdministrator: false,
  createdAt: new Date("2026-08-20T00:00:00.000Z"),
};

function membershipOf(organizationId: string): OrganizationMembership {
  return {
    id: `mbs-${organizationId}`,
    managerId: cohen.id,
    organizationId,
    role: "manager",
    status: "active",
    createdAt: new Date("2026-08-20T00:00:00.000Z"),
  };
}

test("an address is stored lowercased, so one person cannot become two", async () => {
  const { client, managers } = createManagerClient();
  const repo = new PrismaManagerRepository(client);

  await repo.saveManager(cohen);

  assert.strictEqual(managers.get("mgr-cohen").email, "cohen@school.ac.il");
  assert.strictEqual(
    (await repo.findByEmail("COHEN@SCHOOL.AC.IL"))?.id,
    "mgr-cohen",
  );
  assert.strictEqual((await repo.findByEmail(" cohen@school.ac.il "))?.id, "mgr-cohen");
});

test("an address nobody has is nobody", async () => {
  const { client } = createManagerClient();
  const repo = new PrismaManagerRepository(client);

  assert.strictEqual(await repo.findByEmail("stranger@school.ac.il"), null);
  assert.strictEqual(await repo.findByEmail("   "), null);
});

test("the memberships come back as the session's own type", async () => {
  const { client } = createManagerClient();
  const repo = new PrismaManagerRepository(client);

  await repo.saveManager(cohen);
  await repo.saveMembership(membershipOf("org-a"));
  await repo.saveMembership(membershipOf("org-b"));

  const found = await repo.findMembershipsByManagerId("mgr-cohen");

  assert.deepStrictEqual(
    found.map((m) => m.organizationId).sort(),
    ["org-a", "org-b"],
  );
  assert.strictEqual(found[0].status, "active");
  assert.ok(found[0].createdAt instanceof Date);
});

test("saving a membership twice changes it rather than adding a second", async () => {
  const { client, memberships } = createManagerClient();
  const repo = new PrismaManagerRepository(client);

  await repo.saveManager(cohen);
  await repo.saveMembership(membershipOf("org-a"));
  await repo.saveMembership({ ...membershipOf("org-a"), status: "suspended" });

  assert.strictEqual(memberships.size, 1);
  assert.strictEqual(
    (await repo.findMembershipsByManagerId("mgr-cohen"))[0].status,
    "suspended",
  );
});

test("the bootstrap asks how many administrators there are, not who they are", async () => {
  const { client } = createManagerClient();
  const repo = new PrismaManagerRepository(client);

  assert.strictEqual(await repo.countPlatformAdministrators(), 0);

  await repo.saveManager(cohen);
  assert.strictEqual(await repo.countPlatformAdministrators(), 0);

  await repo.saveManager({
    ...cohen,
    id: "mgr-platform",
    email: "platform@shalomut.edu.il",
    isPlatformAdministrator: true,
  });
  assert.strictEqual(await repo.countPlatformAdministrators(), 1);
});

test("a client generated before the migration says so instead of answering", async () => {
  const { client } = createManagerClient();
  const repo = new PrismaManagerRepository({
    ...client,
    manager: undefined,
  });

  await assert.rejects(
    () => repo.findByEmail("cohen@school.ac.il"),
    /prisma generate/,
  );
});
