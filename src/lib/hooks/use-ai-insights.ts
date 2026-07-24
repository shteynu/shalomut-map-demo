"use client";

import { useCallback, useEffect, useState } from "react";
import {
  type AiInsightsLoadResult,
  loadAiInsights,
} from "@/lib/ai-insights-client";

export type AiInsightsUiState =
  | { status: "loading" }
  | AiInsightsLoadResult;

export function useAiInsights(roundId: string) {
  const [reloadToken, setReloadToken] = useState(0);
  const requestKey = `${roundId}:${reloadToken}`;
  const [result, setResult] = useState<{
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
        setResult({ requestKey, value: result });
      }
    });

    return () => controller.abort();
  }, [requestKey, roundId]);

  const reload = useCallback(() => {
    setReloadToken((value) => value + 1);
  }, []);

  const state: AiInsightsUiState =
    result?.requestKey === requestKey
      ? result.value
      : { status: "loading" };

  return { state, reload };
}
