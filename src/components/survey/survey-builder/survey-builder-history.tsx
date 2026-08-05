"use client";

import { History, Loader2, RotateCcw } from "lucide-react";
import { useEffect, useState } from "react";
import type { SurveyDefinition } from "@/lib/types/backend";
import {
  loadVersionDefinition,
  loadVersionList,
  type SurveyVersionSummaryDto as SurveyVersionSummary,
} from "@/lib/survey-definition-versions-client";

export type { SurveyVersionSummaryDto as SurveyVersionSummary } from "@/lib/survey-definition-versions-client";

type HistoryProps = {
  roundId: string;
  /** Bumped by the builder after every save, so the list refetches itself. */
  refreshToken: number;
  /**
   * Hands an earlier questionnaire back to the builder. Loading it does not
   * save it: the manager reviews it and presses save, which is also what makes
   * the restore reversible — the version they are leaving is already in this
   * list.
   */
  onLoadVersion: (definition: SurveyDefinition, savedAt: string) => void;
  /** A round whose questions are frozen cannot take an earlier questionnaire. */
  isFrozen?: boolean;
};

const timeFormatter = new Intl.DateTimeFormat("he-IL", {
  hour: "2-digit",
  minute: "2-digit",
});

const dateFormatter = new Intl.DateTimeFormat("he-IL", {
  day: "2-digit",
  month: "2-digit",
});

/**
 * A saved version is named by when it was saved. Same-day saves show the time
 * alone, older ones carry the date — the same rule the save line under the
 * button follows, so the two never disagree about what "today" means.
 */
function describeSavedAt(value: string): string {
  const savedAt = new Date(value);
  if (Number.isNaN(savedAt.getTime())) return "";

  const now = new Date();
  const sameDay =
    savedAt.getFullYear() === now.getFullYear() &&
    savedAt.getMonth() === now.getMonth() &&
    savedAt.getDate() === now.getDate();

  return sameDay
    ? timeFormatter.format(savedAt)
    : `${dateFormatter.format(savedAt)}, ${timeFormatter.format(savedAt)}`;
}

export function SurveyBuilderHistory({
  roundId,
  refreshToken,
  onLoadVersion,
  isFrozen = false,
}: HistoryProps) {
  const [versions, setVersions] = useState<SurveyVersionSummary[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [loadingVersionId, setLoadingVersionId] = useState<string | null>(null);

  // The fetch lives outside the component, so the effect subscribes to a
  // result rather than setting state on its own body — the shape
  // `useAiInsights` already uses, and the one React's rules expect.
  useEffect(() => {
    const controller = new AbortController();

    void loadVersionList(roundId, (input, init) =>
      fetch(input, { ...init, signal: controller.signal }),
    ).then((result) => {
      if (controller.signal.aborted) return;

      if (result.status === "error") {
        setState("error");
        return;
      }
      setVersions(result.versions);
      setState("ready");
    });

    return () => controller.abort();
  }, [roundId, refreshToken]);

  async function loadVersion(version: SurveyVersionSummary) {
    setLoadingVersionId(version.id);

    const result = await loadVersionDefinition(roundId, version.id);
    if (result.status === "error") {
      setState("error");
      setLoadingVersionId(null);
      return;
    }

    onLoadVersion(result.definition, result.savedAt || version.savedAt);
    setLoadingVersionId(null);
  }

  // A round saved once has a history of one, and that one entry is what is on
  // screen. Nothing to offer, so nothing is shown.
  if (state === "ready" && versions.length < 2) return null;

  return (
    <section className="survey-builder-panel survey-builder-history">
      <div className="survey-builder-heading">
        <div>
          <p className="eyebrow">גרסאות קודמות</p>
          <h2>היסטוריית שאלון</h2>
        </div>
        <History size={18} aria-hidden="true" />
      </div>

      {state === "error" ? (
        <p className="survey-submit-error" role="alert">
          לא ניתן היה לטעון את היסטוריית השאלון. הגרסה הנוכחית אינה מושפעת.
        </p>
      ) : null}

      {state === "loading" ? <p className="muted-note">טוען גרסאות...</p> : null}

      {state === "ready" ? (
        <>
          <ul className="survey-version-list">
            {versions.map((version) => (
              <li key={version.id} className="survey-version-row">
                <div>
                  <strong>{describeSavedAt(version.savedAt)}</strong>
                  <span className="survey-version-meta">
                    {version.enabledQuestionCount} שאלות פעילות מתוך{" "}
                    {version.questionCount}
                  </span>
                </div>
                {version.isCurrent ? (
                  <span className="survey-version-current">הגרסה הנוכחית</span>
                ) : (
                  <button
                    type="button"
                    className="secondary-button"
                    disabled={isFrozen || loadingVersionId !== null}
                    onClick={() => loadVersion(version)}
                    title={
                      isFrozen
                        ? "לא ניתן להחליף שאלון אחרי שהתקבלה תשובה ראשונה"
                        : "טעינת הגרסה לעריכה. השינוי ייכנס לתוקף רק לאחר שמירה"
                    }
                  >
                    {loadingVersionId === version.id ? (
                      <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                    ) : (
                      <RotateCcw size={16} aria-hidden="true" />
                    )}
                    טעינת גרסה
                  </button>
                )}
              </li>
            ))}
          </ul>
          <p className="muted-note">
            טעינת גרסה מחליפה את התוכן במסך העריכה בלבד. השאלון הנוכחי נשאר עד
            שתשמרו.
          </p>
        </>
      ) : null}
    </section>
  );
}
