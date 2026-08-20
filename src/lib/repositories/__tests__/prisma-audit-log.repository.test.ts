import assert from "node:assert/strict";
import test from "node:test";
import { PrismaAuditLogRepository } from "..";
import type { MinimalPrismaClient } from "../prisma/prisma-client";
import type { AuditEvent } from "../../auth/types";

/** Enough of a Prisma client to answer the two questions this repository asks. */
function createAuditClient() {
  const rows = new Map<string, any>();

  const client: MinimalPrismaClient = {
    organization: {} as never,
    surveyRound: {} as never,
    surveyResponse: {} as never,
    auditEvent: {
      upsert: async ({ where, create, update }: any) => {
        const existing = rows.get(where.id);
        const row = existing ? { ...existing, ...update } : { ...create };
        rows.set(row.id, row);
        return row;
      },
      findMany: async ({ where, orderBy }: any) => {
        const found = Array.from(rows.values()).filter(
          (row) => row.organizationId === where.organizationId,
        );
        found.sort((a, b) =>
          orderBy?.timestamp === "desc"
            ? b.timestamp - a.timestamp
            : a.timestamp - b.timestamp,
        );
        return found;
      },
      count: async () => rows.size,
      deleteMany: async () => {
        const count = rows.size;
        rows.clear();
        return { count };
      },
    },
  };

  return { client, rows };
}

function event(overrides: Partial<AuditEvent> = {}): AuditEvent {
  return {
    id: "audit-1",
    timestamp: new Date("2026-08-20T10:00:00.000Z"),
    action: "ROUND_RESET",
    managerId: "mgr-1",
    organizationId: "org-1",
    roundId: "round-1",
    details: { deletedResponseCount: 4 },
    ...overrides,
  };
}

test("an event is written and read back whole", async () => {
  const { client } = createAuditClient();
  const repo = new PrismaAuditLogRepository(client);

  await repo.recordEvent(event());
  const [found] = await repo.findByOrganizationId("org-1");

  assert.strictEqual(found.id, "audit-1");
  assert.strictEqual(found.action, "ROUND_RESET");
  assert.strictEqual(found.managerId, "mgr-1");
  assert.strictEqual(found.roundId, "round-1");
  assert.deepStrictEqual(found.details, { deletedResponseCount: 4 });
});

test("a school reads its own events and no other school's", async () => {
  const { client } = createAuditClient();
  const repo = new PrismaAuditLogRepository(client);

  await repo.recordEvent(event({ id: "audit-mine", organizationId: "org-1" }));
  await repo.recordEvent(
    event({ id: "audit-theirs", organizationId: "org-2" }),
  );

  const mine = await repo.findByOrganizationId("org-1");
  assert.strictEqual(mine.length, 1);
  assert.strictEqual(mine[0].id, "audit-mine");
});

test("one school's log comes back newest first", async () => {
  const { client } = createAuditClient();
  const repo = new PrismaAuditLogRepository(client);

  await repo.recordEvent(
    event({ id: "older", timestamp: new Date("2026-08-20T09:00:00.000Z") }),
  );
  await repo.recordEvent(
    event({ id: "newer", timestamp: new Date("2026-08-20T11:00:00.000Z") }),
  );

  const found = await repo.findByOrganizationId("org-1");
  assert.deepStrictEqual(
    found.map((row) => row.id),
    ["newer", "older"],
  );
});

test("the same event recorded twice is one row, not a rejected write", async () => {
  const { client, rows } = createAuditClient();
  const repo = new PrismaAuditLogRepository(client);

  await repo.recordEvent(event());
  await repo.recordEvent(event());

  assert.strictEqual(rows.size, 1);
});

test("an event with no round and no details survives the round trip", async () => {
  const { client } = createAuditClient();
  const repo = new PrismaAuditLogRepository(client);

  await repo.recordEvent(
    event({ roundId: undefined, details: undefined }),
  );
  const [found] = await repo.findByOrganizationId("org-1");

  assert.strictEqual(found.roundId, undefined);
  assert.strictEqual(found.details, undefined);
});

test("a client generated before the audit table says so, rather than losing the event", async () => {
  const repo = new PrismaAuditLogRepository({
    organization: {} as never,
    surveyRound: {} as never,
    surveyResponse: {} as never,
  });

  await assert.rejects(
    () => repo.recordEvent(event()),
    /prisma generate/,
    "a missing model must be an error and never a silently dropped audit row",
  );
});
