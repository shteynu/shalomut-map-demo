"use client";

import {
  AlertTriangle,
  LoaderCircle,
  LockKeyhole,
  Sparkles,
} from "lucide-react";
import { useState } from "react";
import type { AiInsightsUiState } from "@/lib/hooks/use-ai-insights";

/**
 * Lets the manager start the analysis from the screen where its absence is
 * visible. Without it a round whose automatic dispatch never landed — the
 * service was down, the response predates the auto-trigger — stays permanently
 * empty unless the manager knows to go back to the round screen.
 */
function GenerateAnalysisButton({
  roundId,
  label,
}: {
  roundId: string;
  label: string;
}) {
  const [running, setRunning] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setRunning(true);
    setNote(null);
    setError(null);

    const response = await fetch(
      `/api/rounds/${encodeURIComponent(roundId)}/trigger-ai`,
      { method: "POST" },
    ).catch(() => null);

    if (!response) {
      setError("לא ניתן היה לפנות לשירות הניתוח. בדקו את החיבור ונסו שוב.");
      setRunning(false);
      return;
    }

    if (response.status === 409) {
      setNote("ניתוח כבר רץ עבור הסבב הזה. המתינו לסיומו ואז רעננו.");
      setRunning(false);
      return;
    }

    if (!response.ok) {
      setError(
        response.status === 504
          ? "שירות הניתוח לא הספיק לענות. אפשר לנסות שוב בעוד רגע."
          : "שירות הניתוח אינו זמין כרגע. נסו שוב מאוחר יותר.",
      );
      setRunning(false);
      return;
    }

    // The service acknowledges the dispatch and analyses the round afterwards,
    // so an immediate reload would only show the same empty state again. The
    // manager gets the expected wait and re-checks with the button below.
    setNote("הניתוח הופעל. התוצאות יתעדכנו במפה בתוך דקות ספורות.");
    setRunning(false);
  }

  return (
    <>
      <button
        type="button"
        className="primary-button"
        disabled={running}
        onClick={generate}
      >
        {running ? (
          <>
            <LoaderCircle
              className="dashboard-ai-state-spinner"
              size={18}
              aria-hidden="true"
            />
            מייצר ניתוח...
          </>
        ) : (
          <>
            <Sparkles size={18} aria-hidden="true" />
            {label}
          </>
        )}
      </button>
      {note ? <p role="status">{note}</p> : null}
      {error ? <p role="alert">{error}</p> : null}
    </>
  );
}

export function DashboardAiInsightsState({
  state,
  onRetry,
  roundId,
}: {
  state: Exclude<AiInsightsUiState, { status: "ready" }>;
  onRetry: () => void;
  roundId?: string;
}) {
  if (state.status === "loading") {
    return (
      <section className="dashboard-ai-state" aria-live="polite">
        <LoaderCircle className="dashboard-ai-state-spinner" size={30} aria-hidden="true" />
        <h2>טוענים את ניתוח השלומות</h2>
        <p>אנחנו מאמתים את מפת האבנים שנוצרה עבור סבב האבחון.</p>
      </section>
    );
  }

  if (state.status === "locked") {
    return (
      <section className="dashboard-ai-state" aria-live="polite">
        <LockKeyhole size={30} aria-hidden="true" />
        <h2>הניתוח עדיין נעול</h2>
        <p>
          טרם נאספו מספיק תשובות להצגת תובנות מצרפיות בלי לפגוע באנונימיות הצוות.
        </p>
      </section>
    );
  }

  if (state.status === "running") {
    return (
      <section className="dashboard-ai-state" aria-live="polite">
        <LoaderCircle
          className="dashboard-ai-state-spinner"
          size={30}
          aria-hidden="true"
        />
        <h2>הניתוח בעבודה</h2>
        <p>
          שירות הניתוח עובד על הסבב הזה. התוצאות יופיעו במפה בתוך דקות ספורות.
        </p>
        <button type="button" className="secondary-button" onClick={onRetry}>
          בדיקה חוזרת
        </button>
      </section>
    );
  }

  if (state.status === "not-found") {
    return (
      <section className="dashboard-ai-state" aria-live="polite">
        <Sparkles size={30} aria-hidden="true" />
        <h2>הניתוח עדיין לא נוצר</h2>
        <p>
          לא נמצאה מפת תובנות עבור הסבב הזה. אפשר להפעיל את הניתוח על התשובות
          שהתקבלו עד כה.
        </p>
        {roundId ? (
          <GenerateAnalysisButton roundId={roundId} label="יצירת ניתוח עכשיו" />
        ) : null}
        <button type="button" className="secondary-button" onClick={onRetry}>
          בדיקה חוזרת
        </button>
      </section>
    );
  }

  // Every remaining way this can end — the provider never answered, the run
  // died, the stored payload failed validation, the request itself failed — is
  // the same fact for the manager: no analysis, and nothing they did wrong. The
  // round keeps its answers, so retrying later is the whole instruction.
  return (
    <section className="dashboard-ai-state" role="alert">
      <AlertTriangle size={30} aria-hidden="true" />
      <h2>שירות הניתוח אינו זמין כרגע</h2>
      <p>
        לא הופק ניתוח לסבב הזה. התשובות שנאספו נשמרו במלואן, ואפשר להפעיל את
        הניתוח מחדש בעוד מספר דקות.
      </p>
      {roundId ? (
        <GenerateAnalysisButton roundId={roundId} label="הפעלת ניתוח מחדש" />
      ) : null}
      <button type="button" className="secondary-button" onClick={onRetry}>
        ניסיון נוסף
      </button>
    </section>
  );
}
