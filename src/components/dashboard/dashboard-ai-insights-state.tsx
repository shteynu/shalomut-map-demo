"use client";

import {
  AlertTriangle,
  LoaderCircle,
  LockKeyhole,
  Sparkles,
} from "lucide-react";
import { useState } from "react";
import type { AiInsightsRefreshState } from "@/lib/ai-insights-client";
import type {
  AiInsightsUiState,
  AiInsightsWatchStatus,
} from "@/lib/hooks/use-ai-insights";

/**
 * Lets the manager start the analysis from the screen where its absence is
 * visible. Without it a closed round whose dispatch never landed — the service
 * was down, the round was closed before analysis moved to closing — stays
 * permanently empty unless the manager knows to go back to the round screen.
 *
 * The route decides whether the request is allowed; this button only reports
 * what it answered. A round that is still collecting gets `round_not_closed`
 * back, which is the correct instruction rather than an error.
 */
function GenerateAnalysisButton({
  roundId,
  label,
  onQueued,
}: {
  roundId: string;
  label: string;
  onQueued?: () => void;
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

    /*
     * A 409 carries more than one reason since analysis moved to the moment a
     * round closes, and the body says which. "Wait for the run to finish" would
     * be the wrong instruction for a round that is simply still open, and it is
     * the one a manager would follow forever.
     */
    if (response.status === 409) {
      const code = await response
        .json()
        .then((body) => body?.code)
        .catch(() => undefined);

      setNote(
        code === "round_not_closed"
          ? "הניתוח יופעל בסגירת הסבב, על כל התשובות שיתקבלו עד אז."
          : code === "below_privacy_threshold"
            ? "הסבב עדיין לא הגיע לסף הפרטיות, ולכן לא ניתן להפיק ניתוח."
            : "ניתוח כבר רץ עבור הסבב הזה. המתינו לסיומו ואז רעננו.",
      );
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

    /*
     * Reading again immediately used to show the same empty state, because the
     * service only acknowledges the dispatch — so the button promised minutes
     * and left the manager to count them. The run is durable now and the read
     * comes back `running`, which is the state the screen watches; the reload
     * is what starts that watch, and the sentence changes with it.
     */
    setNote(
      onQueued
        ? "הניתוח הופעל. אין צורך לרענן — המסך יתעדכן מעצמו כשהמפה תהיה מוכנה."
        : "הניתוח הופעל. התוצאות יתעדכנו במפה בתוך דקות ספורות.",
    );
    setRunning(false);
    onQueued?.();
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

/**
 * The map is on screen and something is happening to it.
 *
 * A re-analysis no longer takes the map away while it runs, which is the
 * behaviour this note exists to explain: without it the screen would be honest
 * about the data and silent about the work, and a manager who pressed "rewrite
 * this dimension" would see the same map, no spinner, and no way to tell
 * whether anything had happened. A failed re-run gets the same treatment for
 * the same reason — the map is the previous one, and saying so is the whole
 * difference between an old map and a wrong one.
 *
 * `role="status"` and not `alert`: nothing is broken on this screen. The map is
 * readable and the numbers in it are real.
 *
 * `watch` says whether the screen is checking on its own. The sentence changes
 * with it rather than being written once for both, because "the map will
 * update in a few minutes" and "the map will update by itself" ask different
 * things of the reader — the first one asks them to come back.
 */
export function DashboardAiRefreshNotice({
  refresh,
  onRetry,
  watch,
}: {
  refresh: AiInsightsRefreshState | undefined;
  onRetry?: () => void;
  watch?: AiInsightsWatchStatus;
}) {
  if (!refresh) return null;

  if (refresh.state === "running") {
    return (
      <p className="dashboard-ai-refresh-note" role="status">
        <LoaderCircle
          className="dashboard-ai-state-spinner"
          size={18}
          aria-hidden="true"
        />
        <span>
          {watch?.gaveUp
            ? "מוצג הניתוח האחרון שהושלם. הניתוח מחדש נמשך יותר מהצפוי, והמסך הפסיק לבדוק מעצמו."
            : watch?.watching
              ? "מוצג הניתוח האחרון שהושלם. ניתוח מחדש פועל כעת, והמפה תתעדכן מעצמה בסיומו."
              : "מוצג הניתוח האחרון שהושלם. ניתוח מחדש פועל כעת, והמפה תתעדכן בתוך דקות ספורות."}
        </span>
        {onRetry ? (
          <button type="button" className="secondary-button" onClick={onRetry}>
            בדיקה חוזרת
          </button>
        ) : null}
      </p>
    );
  }

  return (
    <p className="dashboard-ai-refresh-note" role="status">
      <AlertTriangle size={18} aria-hidden="true" />
      <span>
        מוצג הניתוח האחרון שהושלם. ניתוח מחדש נכשל, ולכן המפה לא התעדכנה. אפשר
        להפעיל אותו שוב בעוד מספר דקות.
      </span>
    </p>
  );
}

export function DashboardAiInsightsState({
  state,
  onRetry,
  roundId,
  watch,
}: {
  state: Exclude<AiInsightsUiState, { status: "ready" }>;
  onRetry: () => void;
  roundId?: string;
  watch?: AiInsightsWatchStatus;
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
    /*
     * The button stays even while the screen checks on its own. It is the only
     * way on once the watch has given up, and a manager who does not trust a
     * page to keep its word should not have to.
     */
    return (
      <section className="dashboard-ai-state" aria-live="polite">
        <LoaderCircle
          className="dashboard-ai-state-spinner"
          size={30}
          aria-hidden="true"
        />
        <h2>הניתוח בעבודה</h2>
        <p>
          {watch?.gaveUp
            ? "הניתוח נמשך יותר מהצפוי. המסך הפסיק לבדוק מעצמו, ואפשר לבדוק שוב עכשיו."
            : watch?.watching
              ? "שירות הניתוח עובד על הסבב הזה. אין צורך לרענן — המסך יתעדכן מעצמו כשהמפה תהיה מוכנה."
              : "שירות הניתוח עובד על הסבב הזה. התוצאות יופיעו במפה בתוך דקות ספורות."}
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
          לא נמצאה מפת תובנות עבור הסבב הזה. הניתוח מופק בסגירת הסבב, ואם הסבב
          כבר נסגר אפשר להפעיל אותו כאן.
        </p>
        {roundId ? (
          <GenerateAnalysisButton
            roundId={roundId}
            label="יצירת ניתוח עכשיו"
            onQueued={onRetry}
          />
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
        <GenerateAnalysisButton
          roundId={roundId}
          label="הפעלת ניתוח מחדש"
          onQueued={onRetry}
        />
      ) : null}
      <button type="button" className="secondary-button" onClick={onRetry}>
        ניסיון נוסף
      </button>
    </section>
  );
}

/**
 * The map on screen is one this page watched arrive.
 *
 * Shown only after a run the manager waited through, never on a round that was
 * already finished when the screen opened: the point is to explain a map that
 * changed under them, and a map that was there all along changed nothing.
 *
 * It stays rather than fading. A manager who stepped away for two minutes and
 * came back to a different map is exactly the reader this sentence is for, and
 * a notice that had already dismissed itself would have told them nothing.
 */
export function DashboardAiArrivedNotice({
  watch,
}: {
  watch: AiInsightsWatchStatus | undefined;
}) {
  if (!watch?.arrived) return null;

  return (
    <p className="dashboard-ai-refresh-note" role="status">
      <Sparkles size={18} aria-hidden="true" />
      <span>הניתוח הושלם, והמפה שמוצגת כאן היא התוצאה שלו.</span>
    </p>
  );
}
