import type { SurveyAttemptClientStage } from "./types/backend";

/**
 * Tells the round where this filling session got to.
 *
 * Three rules, all of them about not costing the respondent anything:
 *
 * 1. **Never awaited.** A beacon that blocked an answer would trade the thing
 *    being measured for the measurement. Every call returns immediately and a
 *    failure is swallowed — the funnel loses a row, the teacher loses nothing.
 * 2. **`keepalive`.** The most valuable beacon is the last one, fired from
 *    `pagehide` as the tab goes away, which an ordinary fetch would have
 *    cancelled. That is precisely the session the manager wants to know about.
 * 3. **Deduped in the client.** The server's upsert makes repeats harmless, but
 *    a re-render storm should not become a request storm on a teacher's mobile
 *    data.
 */
export interface SurveyAttemptBeacon {
  opened(): void;
  consented(): void;
  progress(questionIndex: number): void;
}

export interface SurveyAttemptBeaconOptions {
  shareCode: string;
  /** The session's token hash, or null while it is still being computed. */
  tokenHash: () => string | null;
  /** Injected for tests; defaults to the global `fetch`. */
  send?: (url: string, init: RequestInit) => Promise<unknown>;
}

export function createSurveyAttemptBeacon({
  shareCode,
  tokenHash,
  send,
}: SurveyAttemptBeaconOptions): SurveyAttemptBeacon {
  const sent = new Set<string>();
  let furthestQuestion = -1;

  function fire(stage: SurveyAttemptClientStage, lastQuestionReached?: number) {
    const hash = tokenHash();
    if (!hash) return;

    const sender =
      send ??
      (typeof fetch === "function"
        ? (url: string, init: RequestInit) => fetch(url, init)
        : null);
    if (!sender) return;

    try {
      const result = sender(
        `/api/survey/${encodeURIComponent(shareCode)}/attempt`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          keepalive: true,
          body: JSON.stringify({
            anonymousTokenHash: hash,
            stage,
            ...(lastQuestionReached === undefined
              ? {}
              : { lastQuestionReached }),
          }),
        },
      );

      // `fetch` rejects on a dropped connection, and an unhandled rejection in
      // a `pagehide` handler is noise in a respondent's console at the exact
      // moment nobody can act on it.
      if (result && typeof (result as Promise<unknown>).catch === "function") {
        (result as Promise<unknown>).catch(() => {});
      }
    } catch {
      // Same reasoning: a beacon is never worth an exception.
    }
  }

  function once(key: string, stage: SurveyAttemptClientStage) {
    if (sent.has(key)) return;
    sent.add(key);
    fire(stage);
  }

  return {
    opened: () => once("opened", "opened"),
    consented: () => once("consented", "consented"),
    progress: (questionIndex: number) => {
      if (!Number.isInteger(questionIndex) || questionIndex < 0) return;
      // Only forward motion is worth a request: the server keeps the furthest
      // index anyway, so re-reporting a question already reported is a request
      // that changes nothing.
      if (questionIndex <= furthestQuestion) return;

      furthestQuestion = questionIndex;
      fire("progress", questionIndex);
    },
  };
}
