import type { SurveyDefinition } from "@/lib/types/backend";

export type SurveyVersionSummaryDto = {
  id: string;
  savedAt: string;
  title: string;
  questionCount: number;
  enabledQuestionCount: number;
  isCurrent: boolean;
};

export type VersionListResult =
  | { status: "ready"; versions: SurveyVersionSummaryDto[] }
  | { status: "error" };

export type VersionLoadResult =
  | { status: "ready"; definition: SurveyDefinition; savedAt: string }
  | { status: "error" };

type Fetcher = typeof fetch;

/**
 * Reading the history never fails the builder. A manager whose history could
 * not be fetched still has the questionnaire in front of them, so the failure
 * is reported as its own state rather than thrown at the screen.
 */
export async function loadVersionList(
  roundId: string,
  fetchImpl: Fetcher = fetch,
): Promise<VersionListResult> {
  const response = await fetchImpl(
    `/api/rounds/${encodeURIComponent(roundId)}/survey-definition/versions`,
  ).catch(() => null);

  if (!response?.ok) return { status: "error" };

  const payload = (await response.json().catch(() => null)) as {
    versions?: SurveyVersionSummaryDto[];
  } | null;

  return Array.isArray(payload?.versions)
    ? { status: "ready", versions: payload.versions }
    : { status: "error" };
}

export async function loadVersionDefinition(
  roundId: string,
  versionId: string,
  fetchImpl: Fetcher = fetch,
): Promise<VersionLoadResult> {
  const response = await fetchImpl(
    `/api/rounds/${encodeURIComponent(roundId)}/survey-definition/versions/${encodeURIComponent(versionId)}`,
  ).catch(() => null);

  if (!response?.ok) return { status: "error" };

  const payload = (await response.json().catch(() => null)) as {
    definition?: SurveyDefinition;
    savedAt?: string;
  } | null;

  return payload?.definition
    ? {
        status: "ready",
        definition: payload.definition,
        savedAt: payload.savedAt ?? "",
      }
    : { status: "error" };
}
