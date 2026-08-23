"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  type AiInsightsLoadResult,
  loadAiInsights,
} from "@/lib/ai-insights-client";
import {
  isAnalysisInFlight,
  isSettledMap,
  planAiInsightsWatch,
} from "@/lib/dashboard/ai-insights-watch";

export type AiInsightsUiState =
  | { status: "loading" }
  | AiInsightsLoadResult;

/**
 * What the screen knows about the analysis it is waiting for.
 *
 * `arrived` is only ever true for a map this page watched land. A round that
 * was already finished when the screen opened says nothing, because there is
 * nothing to announce — the manager asked for a map and got one.
 */
export interface AiInsightsWatchStatus {
  /** The screen is checking on its own, so the manager need not. */
  watching: boolean;
  /** It watched to the ceiling and stopped; the button is the way on. */
  gaveUp: boolean;
  /** A run finished while this screen was watching it. */
  arrived: boolean;
}

/**
 * The two facts the screen renders, and the round they belong to.
 *
 * The round travels with them so that switching rounds is a derivation rather
 * than a reset: a verdict naming another round simply is not this round's
 * verdict. Resetting instead would either write during render or leave one
 * frame showing the previous round's notice over the new round's map.
 */
interface WatchVerdict {
  roundId: string;
  gaveUp: boolean;
  arrived: boolean;
}

const freshVerdict = (roundId: string): WatchVerdict => ({
  roundId,
  gaveUp: false,
  arrived: false,
});

export function useAiInsights(roundId: string) {
  const [reloadToken, setReloadToken] = useState(0);
  const requestKey = `${roundId}:${reloadToken}`;
  const [result, setResult] = useState<{
    roundId: string;
    requestKey: string;
    value: AiInsightsLoadResult;
  } | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    void loadAiInsights(
      roundId,
      (input, init) =>
        fetch(input, {
          ...init,
          signal: controller.signal,
        }),
    ).then((result) => {
      if (!controller.signal.aborted) {
        setResult({ roundId, requestKey, value: result });
      }
    });

    return () => controller.abort();
  }, [requestKey, roundId]);

  const reload = useCallback(() => {
    setReloadToken((value) => value + 1);
  }, []);

  /*
   * A re-check keeps the answer it already has.
   *
   * Matching on the round rather than on the request is what makes the watch
   * bearable: every check bumps `requestKey`, and reporting `loading` in
   * between would replace the map with a spinner every few seconds for as long
   * as the analysis ran — and would unmount whatever the manager had just
   * clicked along with it. A different round is a different question, and that
   * one does load.
   */
  const forThisRound = result?.roundId === roundId ? result : null;
  const state: AiInsightsUiState = forThisRound?.value ?? { status: "loading" };

  /**
   * The request that produced what is on screen, as opposed to the one in
   * flight. The watch schedules from this so a check is timed from the answer
   * it got, not from the moment it asked.
   */
  const landedKey = forThisRound?.requestKey ?? null;

  /*
   * One watch spans many fetches, so its bookkeeping cannot live in the state
   * those fetches replace.
   *
   * These three are refs rather than state because nothing renders them and
   * each changes inside a timer: `watchedMs` accumulates only the time the page
   * was visible and waiting, `previousDelayMs` is what makes the wait widen
   * instead of restarting at five seconds after every check, and `wasWatching`
   * is what tells a map that arrived from a map that was already there.
   */
  const watchedMs = useRef(0);
  const previousDelayMs = useRef<number | null>(null);
  const wasWatching = useRef(false);

  const [storedVerdict, setVerdict] = useState<WatchVerdict>(() =>
    freshVerdict(roundId),
  );
  const verdict =
    storedVerdict.roundId === roundId ? storedVerdict : freshVerdict(roundId);

  const updateVerdict = useCallback(
    (change: Partial<Omit<WatchVerdict, "roundId">>) => {
      setVerdict((stored) => ({
        ...(stored.roundId === roundId ? stored : freshVerdict(roundId)),
        ...change,
      }));
    },
    [roundId],
  );

  // The refs cannot be derived the way the verdict is, so the one place they
  // are allowed to be cleared for a new round is here: an effect, not a render.
  useEffect(() => {
    watchedMs.current = 0;
    previousDelayMs.current = null;
    wasWatching.current = false;
  }, [roundId]);

  const settled = state.status !== "loading" && isSettledMap(state);
  const inFlight = state.status !== "loading" && isAnalysisInFlight(state);

  useEffect(() => {
    if (inFlight) {
      wasWatching.current = true;
      return;
    }
    // The transition this exists for: the screen was watching, and now there
    // is a finished map in front of it.
    if (wasWatching.current && settled) {
      wasWatching.current = false;
      previousDelayMs.current = null;
      watchedMs.current = 0;
      updateVerdict({ arrived: true });
    }
  }, [inFlight, settled, updateVerdict]);

  useEffect(() => {
    if (!inFlight || verdict.gaveUp) return;

    let timer: ReturnType<typeof setTimeout> | undefined;
    let waitStartedAt = 0;

    const hidden = () =>
      typeof document === "undefined" ? false : document.hidden;

    function schedule() {
      const plan = planAiInsightsWatch({
        inFlight: true,
        hidden: hidden(),
        watchedMs: watchedMs.current,
        previousDelayMs: previousDelayMs.current,
      });

      if (plan.action === "gave-up") {
        updateVerdict({ gaveUp: true });
        return;
      }
      // Paused: the visibility listener below restarts this the moment
      // somebody looks at the tab again, and it looks immediately rather than
      // waiting out a fresh interval, because time passed while it could not.
      if (plan.action !== "wait") return;

      previousDelayMs.current = plan.delayMs;
      waitStartedAt = Date.now();
      timer = setTimeout(() => {
        timer = undefined;
        watchedMs.current += plan.delayMs;
        reload();
      }, plan.delayMs);
    }

    function stopWaiting() {
      if (timer === undefined) return;
      clearTimeout(timer);
      timer = undefined;
      // Only the part actually spent waiting counts, so a tab hidden two
      // seconds into a thirty-second wait is not charged the other twenty
      // eight.
      watchedMs.current += Math.max(0, Date.now() - waitStartedAt);
    }

    function onVisibilityChange() {
      if (hidden()) {
        stopWaiting();
        return;
      }
      if (timer === undefined) {
        // Back from a hidden tab. Ask now: whatever was running may well have
        // finished while nobody was looking.
        reload();
      }
    }

    schedule();
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      if (timer !== undefined) clearTimeout(timer);
    };
    /*
     * `landedKey` is what makes this run again after every check, and it moves
     * only when a fetch comes back. Depending on the requested key instead
     * would start the next wait the moment the timer fired, so a slow round
     * would have checks queueing behind each other.
     */
  }, [inFlight, verdict.gaveUp, landedKey, reload, updateVerdict]);

  const watch: AiInsightsWatchStatus = {
    watching: inFlight && !verdict.gaveUp,
    gaveUp: verdict.gaveUp,
    /*
     * A run in flight retires the previous arrival rather than clearing it.
     * The map on screen is once more the previous one, so announcing it as the
     * result of a finished analysis would be describing the run before this
     * one — and derived here rather than reset in the effect, so that the
     * announcement comes back by itself when this run lands too.
     */
    arrived: verdict.arrived && !inFlight,
  };

  return { state, reload, watch };
}
