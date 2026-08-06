import assert from "node:assert";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { toRoundSwitcherOptions } from "@/lib/rounds/round-options";
import { roundSwitcherAction } from "@/lib/navigation";
import type { SurveyRound } from "@/lib/types/backend";
import { RoundSwitcher } from "../round-switcher";

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

function renderSwitcher(
  list: SurveyRound[],
  selectedId: string,
  action = roundSwitcherAction("round"),
) {
  return renderToStaticMarkup(
    <RoundSwitcher
      options={toRoundSwitcherOptions(list, selectedId)}
      action={action}
    />,
  );
}

test("the rounds are one select, and the selected one is the value", () => {
  const html = renderSwitcher(rounds, "round-2");

  assert.match(html, /<select[^>]*name="round"/);
  assert.match(html, /<option[^>]*value="round-1"/);
  assert.match(html, /<option[^>]*value="round-2"[^>]*selected/);
  assert.match(html, /סבב שני/);
  assert.match(html, /סבב ראשון/);
});

test("switching rounds works without JavaScript", () => {
  // The form is a plain GET back to the screen the manager is reading, with
  // the same parameter every screen already reads, so a no-JS submission
  // produces exactly the URL a link would have.
  const html = renderSwitcher(rounds, "round-2");

  assert.match(html, /<form[^>]*method="get"/);
  assert.match(html, /<form[^>]*action="\/round\/"/);
  assert.match(html, /<button[^>]*type="submit"/);
});

test("the form posts back to the screen it is on", () => {
  const html = renderSwitcher(
    rounds,
    "round-2",
    roundSwitcherAction("surveyBuilder"),
  );

  assert.match(html, /action="\/survey\/"/);
});

test("the status of each round is a word, not only a position in the list", () => {
  const html = renderSwitcher(rounds, "round-1");

  assert.match(html, /פעיל/);
  assert.match(html, /סגור/);
});

test("the select is labelled", () => {
  const html = renderSwitcher(rounds, "round-2");

  assert.match(html, /<label[^>]*for="round-switcher-select"/);
  assert.match(html, /id="round-switcher-select"/);
});

test("an archived round is not one of the everyday choices", () => {
  const { current } = toRoundSwitcherOptions(withArchive, "round-2");

  assert.deepStrictEqual(
    current.map((option) => option.id),
    ["round-2", "round-1"],
  );
});

test("the archive is a group in the same list, reachable without its URL", () => {
  const html = renderSwitcher(withArchive, "round-2");

  assert.match(html, /<optgroup[^>]*label="ארכיון \(1\)"/);
  assert.match(html, /value="round-0"/);
  assert.match(html, /סבב ניסיון/);
});

test("the archived round a manager is looking at stays in the everyday list", () => {
  const options = toRoundSwitcherOptions(withArchive, "round-0");
  const html = renderSwitcher(withArchive, "round-0");

  assert.deepStrictEqual(options.archived, []);
  assert.match(html, /<option[^>]*value="round-0"[^>]*selected/);
  assert.match(html, /בארכיון/);
  assert.doesNotMatch(html, /<optgroup/);
});

test("a school whose only other round is archived still gets the switcher", () => {
  const html = renderSwitcher(
    [rounds[0], round("round-0", "סבב ניסיון", "archived")],
    "round-2",
  );

  assert.match(html, /<optgroup[^>]*label="ארכיון \(1\)"/);
});

test("a school with one round gets no switcher at all", () => {
  assert.strictEqual(renderSwitcher([rounds[0]], "round-2"), "");
});
