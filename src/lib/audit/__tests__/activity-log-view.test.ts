import assert from "node:assert";
import test from "node:test";
import type { AuditActionType } from "@/lib/auth/manager-audit-service";
import type { AuditEvent } from "@/lib/auth/types";
import { buildActivityLog, type ActivityLogNames } from "../activity-log-view";

const NO_NAMES: ActivityLogNames = {
  actorsById: new Map(),
  roundTitlesById: new Map(),
};

function event(overrides: Partial<AuditEvent> = {}): AuditEvent {
  return {
    id: "audit-1",
    timestamp: new Date("2026-08-24T09:15:00.000Z"),
    action: "ROUND_CREATED",
    managerId: "mgr-1",
    organizationId: "org-1",
    ...overrides,
  };
}

/**
 * Every action the log can record has a name a reader recognises.
 *
 * The list is spelled out rather than derived from the label map, because a map
 * checked against itself would pass with every entry missing. `AuditActionType`
 * is what keeps the two in step: an action added to the union fails the type
 * check here as well as in the labels.
 */
const EVERY_ACTION: AuditActionType[] = [
  "ADMINISTRATOR_SCHOOL_VISIT",
  "SETUP_SAVED",
  "ROUND_CREATED",
  "ROUND_STATUS_UPDATED",
  "ROUND_RESET",
  "SURVEY_DEFINITION_UPDATED",
  "AI_TRIGGERED",
  "SCHOOL_CREATED",
  "MEMBER_INVITED",
  "MEMBER_REVOKED",
  "MEMBER_RESTORED",
  "ADMINISTRATOR_INVITED",
];

test("every recorded action is named in Hebrew, and no two share a name", () => {
  const labels = buildActivityLog(
    EVERY_ACTION.map((action, index) =>
      event({ id: `audit-${index}`, action }),
    ),
    NO_NAMES,
  ).map((entry) => entry.actionLabel);

  for (const [index, label] of labels.entries()) {
    assert.notStrictEqual(
      label,
      EVERY_ACTION[index],
      `${EVERY_ACTION[index]} is shown as its stored name rather than a label`,
    );
    assert.match(label, /[֐-׿]/);
  }

  assert.strictEqual(new Set(labels).size, labels.length);
});

test("an action this version has no label for is shown as it was stored", () => {
  // The log outlives the code that wrote it. A row from a version that recorded
  // something this one has never heard of is still evidence, and hiding it or
  // calling it "unknown" would lose the only thing it says.
  const [entry] = buildActivityLog(
    [event({ action: "SOMETHING_A_LATER_VERSION_RECORDED" })],
    NO_NAMES,
  );

  assert.strictEqual(entry.actionLabel, "SOMETHING_A_LATER_VERSION_RECORDED");
});

test("an actor is named when the account is still known, and by id when it is not", () => {
  const [known, gone] = buildActivityLog(
    [event({ id: "audit-1", managerId: "mgr-1" }), event({ id: "audit-2", managerId: "mgr-deleted" })],
    { ...NO_NAMES, actorsById: new Map([["mgr-1", "rosh@school.example"]]) },
  );

  assert.strictEqual(known.actor, "rosh@school.example");
  assert.strictEqual(known.actorIsIdentified, true);

  assert.strictEqual(gone.actor, "mgr-deleted");
  assert.strictEqual(gone.actorIsIdentified, false);
});

test("a round is named when the school still has it, and left out when it does not", () => {
  const [named, orphaned, schoolWide] = buildActivityLog(
    [
      event({ id: "audit-1", roundId: "round-1" }),
      event({ id: "audit-2", roundId: "round-erased" }),
      event({ id: "audit-3" }),
    ],
    { ...NO_NAMES, roundTitlesById: new Map([["round-1", "רבעון ב׳"]]) },
  );

  assert.strictEqual(named.roundTitle, "רבעון ב׳");
  assert.strictEqual(orphaned.roundTitle, undefined);
  assert.strictEqual(schoolWide.roundTitle, undefined);
});

test("recorded fields keep their names and are read as values, not as JSON", () => {
  const [entry] = buildActivityLog(
    [
      event({
        action: "SURVEY_DEFINITION_UPDATED",
        details: {
          changed: true,
          activated: false,
          questionCount: 126,
          regenerateDimensionIds: ["balance", "meaning"],
          empty: "   ",
        },
      }),
    ],
    NO_NAMES,
  );

  assert.deepStrictEqual(entry.details, [
    { key: "changed", value: "כן" },
    { key: "activated", value: "לא" },
    { key: "questionCount", value: "126" },
    { key: "regenerateDimensionIds", value: "balance, meaning" },
  ]);
});

test("a nested field is left out rather than shown as [object Object]", () => {
  const [entry] = buildActivityLog(
    [event({ details: { nested: { a: 1 }, title: "רבעון ב׳" } })],
    NO_NAMES,
  );

  assert.deepStrictEqual(entry.details, [{ key: "title", value: "רבעון ב׳" }]);
});

test("a details map nobody expected does not become the whole screen", () => {
  const details = Object.fromEntries(
    Array.from({ length: 40 }, (_, index) => [`field${index}`, index]),
  );

  const [entry] = buildActivityLog([event({ details })], NO_NAMES);

  assert.strictEqual(entry.details.length, 8);
  assert.strictEqual(entry.details[0].key, "field0");
});

test("a visit does not say the same address twice, and says both when they differ", () => {
  const names = {
    ...NO_NAMES,
    actorsById: new Map([["mgr-1", "rosh@school.example"]]),
  };

  const [same] = buildActivityLog(
    [
      event({
        action: "ADMINISTRATOR_SCHOOL_VISIT",
        details: { email: "rosh@school.example" },
      }),
    ],
    names,
  );
  assert.deepStrictEqual(same.details, []);

  // The case the field exists for: the account was renamed after the visit, so
  // the address in the row is not the address on the account, and the log is
  // the only place the old one survives.
  const [changed] = buildActivityLog(
    [
      event({
        action: "ADMINISTRATOR_SCHOOL_VISIT",
        details: { email: "old-address@school.example" },
      }),
    ],
    names,
  );
  assert.deepStrictEqual(changed.details, [
    { key: "email", value: "old-address@school.example" },
  ]);
});

test("a round's recorded title is not repeated beside the round it names", () => {
  const names = {
    ...NO_NAMES,
    roundTitlesById: new Map([["round-1", "רבעון ב׳"]]),
  };

  const [same] = buildActivityLog(
    [event({ roundId: "round-1", details: { title: "רבעון ב׳" } })],
    names,
  );
  assert.deepStrictEqual(same.details, []);

  // Renamed since. The title the round was opened under survives only here.
  const [renamed] = buildActivityLog(
    [event({ roundId: "round-1", details: { title: "רבעון א׳" } })],
    names,
  );
  assert.deepStrictEqual(renamed.details, [{ key: "title", value: "רבעון א׳" }]);
});
