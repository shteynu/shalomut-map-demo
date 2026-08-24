import assert from "node:assert";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import type { ActivityLogEntry } from "@/lib/audit/activity-log-view";
import { ActivityLog, type ActivityLogProps } from "../activity-log";

const EMPTY_TEXT = "עדיין לא נרשמה פעולה בבית הספר הזה.";

/** The screen as a school's log, which is the caller most of these describe. */
function render(props: Omit<ActivityLogProps, "emptyText">) {
  return renderToStaticMarkup(<ActivityLog {...props} emptyText={EMPTY_TEXT} />);
}

function entry(overrides: Partial<ActivityLogEntry> = {}): ActivityLogEntry {
  return {
    id: "audit-1",
    at: new Date("2026-08-24T09:15:00.000Z"),
    action: "ROUND_CREATED",
    actionLabel: "פתיחת סבב אבחון",
    actor: "rosh@school.example",
    actorIsIdentified: true,
    details: [],
    ...overrides,
  };
}

test("an entry names what was done, by whom and when", () => {
  const html = render({ entries: [entry({ roundTitle: "רבעון ב׳" })] });

  assert.match(html, /פתיחת סבב אבחון/);
  assert.match(html, /rosh@school\.example/);
  assert.match(html, /רבעון ב׳/);
  // The machine-readable instant is the stored one; the visible one is the
  // school's own clock — 09:15Z is 12:15 in Jerusalem — so the two are asserted
  // separately. The attribute is matched case-insensitively because the server
  // renderer emits React's own spelling, which HTML reads as `datetime`.
  assert.match(html, /datetime="2026-08-24T09:15:00\.000Z"/i);
  assert.match(html, /12:15/);
});

test("nothing on the screen offers to change a recorded line", () => {
  // An audit log a reader can edit is not evidence. The screen has no controls
  // at all, which is a stronger promise than "the controls refuse".
  const html = render({
    entries: [entry({ details: [{ key: "title", value: "רבעון ב׳" }] })],
    nextHref: "/activity?after=1.audit-1",
  });

  assert.doesNotMatch(html, /<button/);
  assert.doesNotMatch(html, /<form/);
  assert.doesNotMatch(html, /<input/);
});

test("an actor the product can no longer name is said to be gone, not left blank", () => {
  const html = render({
    entries: [entry({ actor: "mgr-deleted", actorIsIdentified: false })],
  });

  assert.match(html, /חשבון שאינו קיים עוד/);
  assert.match(html, /mgr-deleted/);
});

test("an empty newest page and an empty continued page say different things", () => {
  const firstPage = render({ entries: [] });
  const continued = render({ entries: [], newestHref: "/activity" });

  assert.match(firstPage, /עדיין לא נרשמה פעולה/);
  assert.match(continued, /אין פעולות ישנות יותר/);
});

test("the empty first page names the log it is empty of", () => {
  // The platform's log and a school's log are empty for different reasons, and
  // the sentence is the caller's rather than the component's. The end of a walk
  // is not: nothing older is nothing older, whatever is being read.
  const platform = renderToStaticMarkup(
    <ActivityLog entries={[]} emptyText="עדיין לא נרשמה פעולה מעל בתי הספר." />,
  );

  assert.match(platform, /מעל בתי הספר/);
  assert.doesNotMatch(platform, /בבית הספר הזה/);
});

test("the newest page offers no link back to itself", () => {
  const html = render({
    entries: [entry()],
    nextHref: "/activity?after=1.audit-1",
  });

  assert.match(html, /after=1\.audit-1/);
  assert.doesNotMatch(html, /חזרה לפעולות האחרונות/);
});

test("the end of the log offers the way back and no way onward", () => {
  const html = render({ entries: [entry()], newestHref: "/activity" });

  assert.match(html, /חזרה לפעולות האחרונות/);
  assert.doesNotMatch(html, /לפעולות ישנות יותר/);
});

test("a page with no pager at all renders no navigation landmark", () => {
  const html = render({ entries: [entry()] });

  assert.doesNotMatch(html, /<nav/);
});
