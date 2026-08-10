import assert from "node:assert";
import test from "node:test";
import { createSurveyAttemptBeacon } from "@/lib/survey-attempt-beacon";

/**
 * The beacon's whole job is to cost the respondent nothing. These tests pin the
 * three ways it could start costing them something: firing before there is a
 * key to fire with, firing again for something already reported, and letting a
 * network failure surface as an exception in the middle of answering.
 */

const HASH = "a".repeat(64);

function recorder(behaviour: "resolve" | "reject" | "throw" = "resolve") {
  const calls: { url: string; body: Record<string, unknown> }[] = [];

  return {
    calls,
    send: (url: string, init: RequestInit) => {
      calls.push({ url, body: JSON.parse(String(init.body)) });
      if (behaviour === "throw") throw new Error("no network");
      return behaviour === "reject"
        ? Promise.reject(new Error("dropped"))
        : Promise.resolve(undefined);
    },
  };
}

test("nothing is sent until the session has a token hash", () => {
  const { calls, send } = recorder();
  const beacon = createSurveyAttemptBeacon({
    shareCode: "SHALOM-TEST",
    tokenHash: () => null,
    send,
  });

  beacon.opened();
  beacon.consented();
  beacon.progress(3);

  assert.strictEqual(calls.length, 0);
});

test("each stage is reported once, however many times it is called", () => {
  const { calls, send } = recorder();
  const beacon = createSurveyAttemptBeacon({
    shareCode: "SHALOM-TEST",
    tokenHash: () => HASH,
    send,
  });

  beacon.opened();
  beacon.opened();
  beacon.consented();
  beacon.consented();

  assert.deepStrictEqual(
    calls.map((call) => call.body.stage),
    ["opened", "consented"],
  );
  assert.strictEqual(calls[0].url, "/api/survey/SHALOM-TEST/attempt");
  assert.strictEqual(calls[0].body.anonymousTokenHash, HASH);
});

test("only forward progress is worth a request", () => {
  const { calls, send } = recorder();
  const beacon = createSurveyAttemptBeacon({
    shareCode: "SHALOM-TEST",
    tokenHash: () => HASH,
    send,
  });

  beacon.progress(2);
  beacon.progress(2);
  beacon.progress(1);
  beacon.progress(5);

  assert.deepStrictEqual(
    calls.map((call) => call.body.lastQuestionReached),
    [2, 5],
  );
});

test("a nonsense index is not sent at all", () => {
  const { calls, send } = recorder();
  const beacon = createSurveyAttemptBeacon({
    shareCode: "SHALOM-TEST",
    tokenHash: () => HASH,
    send,
  });

  beacon.progress(-1);
  beacon.progress(1.5);
  beacon.progress(Number.NaN);

  assert.strictEqual(calls.length, 0);
});

test("a dropped connection never reaches the respondent", async () => {
  for (const behaviour of ["reject", "throw"] as const) {
    const { send } = recorder(behaviour);
    const beacon = createSurveyAttemptBeacon({
      shareCode: "SHALOM-TEST",
      tokenHash: () => HASH,
      send,
    });

    assert.doesNotThrow(() => beacon.opened());
  }

  // An unhandled rejection would fail the process rather than this assertion,
  // so let the microtask queue drain before the test ends.
  await new Promise((resolve) => setTimeout(resolve, 0));
});

test("the request survives the page going away", () => {
  const sent: RequestInit[] = [];
  const beacon = createSurveyAttemptBeacon({
    shareCode: "SHALOM-TEST",
    tokenHash: () => HASH,
    send: (_url, init) => {
      sent.push(init);
      return Promise.resolve(undefined);
    },
  });

  beacon.opened();

  // The most valuable beacon fires from `pagehide`, which cancels an ordinary
  // fetch — and that is exactly the session a manager wants to know about.
  assert.strictEqual(sent[0].keepalive, true);
});
