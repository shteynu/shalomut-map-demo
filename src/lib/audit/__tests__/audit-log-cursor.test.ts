import assert from "node:assert";
import test from "node:test";
import {
  formatAuditLogCursor,
  parseAuditLogCursor,
  takeAuditLogPage,
} from "../audit-log-cursor";

/**
 * The cursor survives a link, which is the only thing it has to do.
 *
 * Both halves matter and the tests say why: two events written in the same
 * millisecond are told apart by the id alone, so a cursor that lost it would
 * point at "the newest of several" and step over the rest.
 */
test("a cursor written into a link reads back as the same two values", () => {
  const cursor = {
    timestamp: new Date("2026-08-24T09:15:00.123Z"),
    id: "audit-1756025700123-k3n9xq",
  };

  const parsed = parseAuditLogCursor(formatAuditLogCursor(cursor));

  assert.ok(parsed);
  assert.strictEqual(parsed.timestamp.getTime(), cursor.timestamp.getTime());
  assert.strictEqual(parsed.id, cursor.id);
});

test("the millisecond survives, because it is what tells two events apart", () => {
  const first = { timestamp: new Date(1756025700123), id: "audit-a" };
  const second = { timestamp: new Date(1756025700124), id: "audit-a" };

  assert.notStrictEqual(
    formatAuditLogCursor(first),
    formatAuditLogCursor(second),
  );
});

test("an id holding the separator keeps all of itself", () => {
  // Nothing writes such an id today. The split takes the first separator so the
  // day something does, the cursor points at the event rather than at nothing.
  const cursor = { timestamp: new Date(1756025700000), id: "audit.1.2" };

  assert.strictEqual(parseAuditLogCursor(formatAuditLogCursor(cursor))?.id, "audit.1.2");
});

test("a cursor that names no event is the newest page rather than an error", () => {
  for (const value of [
    undefined,
    "",
    "   ",
    "not-a-cursor",
    ".audit-1",
    "1756025700123.",
    "1756025700123",
    "abc.audit-1",
    // Past the largest instant a `Date` can hold, which `Number.isInteger`
    // happily accepts and only the date itself refuses.
    `${Number.MAX_SAFE_INTEGER}0.audit-1`,
  ]) {
    assert.strictEqual(
      parseAuditLogCursor(value),
      undefined,
      `expected no cursor from ${JSON.stringify(value)}`,
    );
  }
});

test("a repeated parameter is read the way every other screen reads one", () => {
  const parsed = parseAuditLogCursor(["1756025700123.audit-a", "9.audit-b"]);

  assert.strictEqual(parsed?.id, "audit-a");
});

const rows = (count: number) =>
  Array.from({ length: count }, (_, index) => ({
    id: `audit-${index}`,
    timestamp: new Date(1756025700000 + index),
  }));

test("a full page plus one row means there is a next page", () => {
  const { page, nextCursor } = takeAuditLogPage(rows(26), 25);

  assert.strictEqual(page.length, 25);
  // The cursor names the last row shown, not the extra one that was read to
  // discover the page exists — that row is the first of the next page.
  assert.strictEqual(nextCursor?.id, "audit-24");
});

test("exactly a full page is the end of the log, not a page with more behind it", () => {
  // The case a `>=` would get wrong, and the one a reader notices: a link that
  // leads to an empty page.
  assert.strictEqual(takeAuditLogPage(rows(25), 25).nextCursor, undefined);
  assert.strictEqual(takeAuditLogPage(rows(3), 25).nextCursor, undefined);
  assert.strictEqual(takeAuditLogPage([], 25).nextCursor, undefined);
});

test("the page a cursor continues from can be re-read as a link", () => {
  const { nextCursor } = takeAuditLogPage(rows(26), 25);
  assert.ok(nextCursor);

  const parsed = parseAuditLogCursor(formatAuditLogCursor(nextCursor));

  assert.strictEqual(parsed?.id, nextCursor.id);
  assert.strictEqual(parsed?.timestamp.getTime(), nextCursor.timestamp.getTime());
});
