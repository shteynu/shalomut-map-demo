import assert from "node:assert";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import type { FastFillingCount } from "@/lib/analytics/filling-duration";
import type {
  RoundFillingReport,
  UnmeasuredFillings,
} from "@/lib/services";
import { RoundFilling, RoundFillingBody } from "../round-filling";

/**
 * The panel is the first place this feature meets a manager, and the first
 * place its copy can overstate what the number means. So these tests are about
 * the sentences: that a round nobody rushed reads as good news rather than as
 * an absence, that a response without timing is never described as a fast one,
 * and that no state offers to remove anybody.
 */

function ready(
  overrides: {
    estimatedMinutes?: number;
    responses?: number;
    measured?: number;
    /** Passed through as written, including an explicit `undefined`. */
    medianMinutes?: number;
    farBelowEstimate?: FastFillingCount;
    unmeasured?: Partial<UnmeasuredFillings>;
  } = {},
): RoundFillingReport {
  return {
    status: "ready",
    summary: {
      estimatedMinutes: overrides.estimatedMinutes ?? 24,
      responses: overrides.responses ?? 20,
      unmeasured: {
        withoutToken: 0,
        withoutAttempt: 0,
        unusable: 0,
        ...overrides.unmeasured,
      },
      durations: {
        measured: overrides.measured ?? 20,
        medianMinutes:
          "medianMinutes" in overrides ? overrides.medianMinutes : 18,
        farBelowEstimate: overrides.farBelowEstimate ?? {
          known: true,
          count: 0,
        },
      },
    },
  };
}

function render(report: RoundFillingReport): string {
  return renderToStaticMarkup(<RoundFillingBody report={report} />);
}

test("a round nobody rushed says so, in a sentence and not as a blank", () => {
  const markup = render(ready());

  assert.ok(markup.includes("אף שאלון מבין 20 שנמדדו לא הוחזר"));
  assert.ok(
    markup.includes("<strong>0</strong>"),
    "the count is zero, and zero is the answer rather than a suppressed value",
  );
  assert.ok(
    markup.includes("<strong>18</strong>"),
    "a median that exists is shown, never replaced by a placeholder",
  );
});

test("a fast group at or above the floor is named with its count", () => {
  const markup = render(ready({ farBelowEstimate: { known: true, count: 4 } }));

  assert.ok(markup.includes("4 שאלונים מבין 20 שנמדדו הוחזרו"));
});

test("a fast group below the floor is bounded, and says why the number is withheld", () => {
  const markup = render(
    ready({ farBelowEstimate: { known: false, fewerThan: 3 } }),
  );

  assert.ok(markup.includes("פחות מ־3 שאלונים מבין 20 שנמדדו הוחזרו"));
  assert.ok(markup.includes("כדי שלא יתאר אדם אחד"));
});

test("a withheld count is written in words, because `<` inverts on an RTL line", () => {
  const markup = render(
    ready({ farBelowEstimate: { known: false, fewerThan: 3 } }),
  );

  assert.ok(
    !markup.includes("&lt; 3"),
    "a bidi-neutral `<` renders as `3 >`, which claims the opposite",
  );
  assert.ok(markup.includes(">פחות מ־3</strong>"));
});

test("every fast sentence names how many sessions it was computed over", () => {
  // Two measured out of fourteen responses: "nobody was fast" is true and
  // nearly empty, and the sentence has to carry the denominator that says so.
  const markup = render(
    ready({ responses: 14, measured: 2, medianMinutes: undefined }),
  );

  assert.ok(markup.includes("אף שאלון מבין 2 שנמדדו"));
});

test("the fast boundary is stated in minutes, not left as a fraction", () => {
  const markup = render(ready({ estimatedMinutes: 24 }));

  // A third of twenty-four minutes. A manager should not have to divide.
  assert.ok(markup.includes("8 דקות"));
});

test("responses without timing are counted and are not called fast", () => {
  const markup = render(
    ready({
      responses: 20,
      measured: 17,
      unmeasured: { withoutToken: 2, withoutAttempt: 1 },
    }),
  );

  assert.ok(markup.includes("ל־3 מתוך 20"));
  assert.ok(markup.includes("אינה תשובה מהירה"));
});

test("a round with no unmeasured responses does not raise the subject", () => {
  const markup = render(ready());

  assert.ok(!markup.includes("אין מדידת זמן"));
});

test("the median waits for the floor rather than showing one session", () => {
  const markup = render(ready({ measured: 2, medianMinutes: undefined }));

  assert.ok(markup.includes("יוצג כשיימדדו 3 מילויים לפחות"));
});

test("a round below its privacy threshold says what it is waiting for", () => {
  const markup = render({
    status: "below-privacy-threshold",
    responses: 4,
    threshold: 10,
  });

  assert.ok(markup.includes("לאחר 10 תשובות"));
  assert.ok(markup.includes("4"));
});

test("a round with no questionnaire says that, not zero minutes", () => {
  const markup = render({ status: "no-questionnaire" });

  assert.ok(markup.includes("לא נשמר שאלון"));
  assert.ok(!markup.includes("0 דקות"));
});

test("a round where nothing could be measured explains itself", () => {
  const markup = render(
    ready({
      responses: 12,
      measured: 0,
      medianMinutes: undefined,
      unmeasured: { withoutAttempt: 12 },
    }),
  );

  assert.ok(markup.includes("לאף אחת מ־12 התשובות אין מדידת זמן"));
  assert.ok(markup.includes("היא פשוט לא נמדדה"));
});

test("no state offers to remove a response, and the report says why", () => {
  const states: RoundFillingReport[] = [
    ready(),
    ready({ farBelowEstimate: { known: true, count: 5 } }),
    ready({ measured: 0, medianMinutes: undefined }),
    { status: "below-privacy-threshold", responses: 4, threshold: 10 },
    { status: "no-questionnaire" },
  ];

  for (const state of states) {
    const markup = render(state);

    // Structural rather than textual: a panel with no control cannot grow one
    // by an edit to its copy, and an assertion about a Hebrew substring would
    // pass against any rewording of the same button.
    assert.ok(
      !markup.includes("<button"),
      "the panel is a reading, not an action",
    );
    assert.ok(!markup.includes("<input"), "and it collects nothing");
    assert.ok(!markup.includes("חשוד"), "no state calls a respondent suspect");
  }

  assert.ok(
    render(ready()).includes("בסיס חישוב אחד בלבד"),
    "the report states why removal is not offered",
  );
});

test("the panel names itself and describes what the duration is", () => {
  const markup = renderToStaticMarkup(<RoundFilling report={ready()} />);

  assert.ok(markup.includes('id="round-filling-title"'));
  assert.ok(markup.includes('aria-labelledby="round-filling-title"'));
  // The measurement is a session's lifetime, so the head has to say that
  // before the numbers below invite a different reading.
  assert.ok(markup.includes("לא כמה זמן"));
});
