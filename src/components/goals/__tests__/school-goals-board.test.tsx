import assert from "node:assert";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { SchoolGoalsBoard } from "../school-goals-board";
import type { SchoolGoalRow } from "@/lib/goals/school-goals";

function row(overrides: Partial<SchoolGoalRow> = {}): SchoolGoalRow {
  return {
    id: "goal-1",
    roundId: "round-1",
    roundTitle: "סבב אביב",
    roundStatus: "closed",
    dimensionId: "balance",
    dimensionLabel: "איזון",
    title: "יום ללא ישיבות",
    body: "לקבוע יום קבוע בשבוע ללא ישיבות צוות.",
    status: "selected",
    ...overrides,
  };
}

test("a school that never chose a goal is told where goals come from", () => {
  const html = renderToStaticMarkup(
    <SchoolGoalsBoard view={{ open: [], done: [] }} />,
  );

  assert.match(html, /עדיין לא נבחרו יעדים/);
  assert.doesNotMatch(html, /בעבודה/);
});

test("a goal names its dimension and the round it was chosen in", () => {
  const html = renderToStaticMarkup(
    <SchoolGoalsBoard view={{ open: [row()], done: [] }} />,
  );

  assert.match(html, /יום ללא ישיבות/);
  assert.match(html, /איזון/);
  assert.match(html, /סבב אביב/);
  // The dimension links back to the recommendations of that round, not of
  // whichever round the manager last looked at.
  assert.match(html, /\/dashboard\/balance\/recommendations\?round=round-1/);
});

test("a goal from an archived round says so, because it is the one that is hard to find", () => {
  const html = renderToStaticMarkup(
    <SchoolGoalsBoard
      view={{ open: [row({ roundStatus: "archived" })], done: [] }}
    />,
  );

  assert.match(html, /בארכיון/);
});

test("finished goals are counted and kept apart from the work in progress", () => {
  const html = renderToStaticMarkup(
    <SchoolGoalsBoard
      view={{
        open: [row()],
        done: [row({ id: "goal-2", title: "שעת צוות קבועה", status: "done" })],
      }}
    />,
  );

  assert.match(html, /בעבודה \(1\)/);
  assert.match(html, /הושלמו \(1\)/);
});
