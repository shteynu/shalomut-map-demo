import assert from "node:assert";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { toDashboardRoundOptions } from "@/lib/dashboard/round-options";
import type { SurveyRound } from "@/lib/types/backend";
import { DashboardRoundSwitcher } from "../dashboard-round-switcher";

function round(
  id: string,
  title: string,
  status: SurveyRound["status"],
): SurveyRound {
  return {
    id,
    organizationId: "org-1",
    title,
    status,
    shareCode: `SHALOM-${id.toUpperCase()}`,
    privacyThreshold: 10,
    startDate: new Date("2026-07-01T00:00:00.000Z"),
    createdAt: new Date("2026-07-01T00:00:00.000Z"),
  };
}

const rounds = [
  round("round-2", "סבב שני", "active"),
  round("round-1", "סבב ראשון", "closed"),
];

const withArchive = [...rounds, round("round-0", "סבב ניסיון", "archived")];

test("each round links to its own dashboard and the selected one is announced", () => {
  const html = renderToStaticMarkup(
    <DashboardRoundSwitcher
      options={toDashboardRoundOptions(rounds, "round-2")}
    />,
  );

  assert.match(html, /href="\/dashboard\?round=round-1"/);
  assert.doesNotMatch(html, /href="\/dashboard\?round=round-2"/);
  assert.match(html, /aria-current="page"/);
  assert.match(html, /סבב שני/);
  assert.match(html, /סבב ראשון/);
});

test("the status of each round is a word, not only the border", () => {
  const html = renderToStaticMarkup(
    <DashboardRoundSwitcher
      options={toDashboardRoundOptions(rounds, "round-1")}
    />,
  );

  assert.match(html, /פעיל/);
  assert.match(html, /סגור/);
});

test("an archived round is not one of the everyday choices", () => {
  const { current } = toDashboardRoundOptions(withArchive, "round-2");

  assert.deepStrictEqual(
    current.map((option) => option.id),
    ["round-2", "round-1"],
  );
});

test("the archive is reachable without knowing the round's URL", () => {
  const html = renderToStaticMarkup(
    <DashboardRoundSwitcher
      options={toDashboardRoundOptions(withArchive, "round-2")}
    />,
  );

  assert.match(html, /<details/);
  assert.match(html, /הצגת הארכיון \(1\)/);
  assert.match(html, /href="\/dashboard\?round=round-0"/);
  assert.match(html, /סבב ניסיון/);
});

test("the archive stays closed until a manager asks for it", () => {
  const html = renderToStaticMarkup(
    <DashboardRoundSwitcher
      options={toDashboardRoundOptions(withArchive, "round-2")}
    />,
  );

  assert.doesNotMatch(html, /<details open/);
});

test("the archived round a manager is looking at stays in the everyday list", () => {
  const options = toDashboardRoundOptions(withArchive, "round-0");
  const html = renderToStaticMarkup(<DashboardRoundSwitcher options={options} />);

  assert.deepStrictEqual(options.archived, []);
  assert.match(html, /סבב ניסיון/);
  assert.match(html, /בארכיון/);
  assert.match(html, /aria-current="page"/);
  assert.doesNotMatch(html, /<details/);
});

test("a school whose only other round is archived still gets the switcher", () => {
  const html = renderToStaticMarkup(
    <DashboardRoundSwitcher
      options={toDashboardRoundOptions(
        [rounds[0], round("round-0", "סבב ניסיון", "archived")],
        "round-2",
      )}
    />,
  );

  assert.match(html, /הצגת הארכיון \(1\)/);
});

test("a school with one round gets no switcher at all", () => {
  const html = renderToStaticMarkup(
    <DashboardRoundSwitcher
      options={toDashboardRoundOptions([rounds[0]], "round-2")}
    />,
  );

  assert.strictEqual(html, "");
});
