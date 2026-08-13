"use client";

import Link from "next/link";
import { Archive, CheckCircle2, Clipboard, History, Loader2, Lock, Map, RotateCcw, Sparkles } from "lucide-react";
import type { CSSProperties } from "react";
import { useRef, useState } from "react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { CopyLinkStatus } from "@/components/ui/copy-link-status";
import { useClipboard } from "@/lib/hooks/use-clipboard";
import { calculatePercentage } from "@/lib/utils/math";
import { getNavigationAction } from "@/lib/navigation";
import { isRoundTransitionAllowed } from "@/lib/rounds/round-status";
import { useShareUrl } from "@/lib/use-share-url";

type RoundControlsProps = {
  roundId: string;
  shareCode: string;
  responseCount: number;
  expectedResponses: number;
  minimumResponses: number;
  status: "draft" | "active" | "closed" | "archived";
  /**
   * Whether the school has moved on to a later round. A superseded round is
   * read: the school has already acted on what it said, so nothing here
   * rewrites its answers or its analysis.
   */
  isSuperseded?: boolean;
};

/**
 * What the manager reads when closing a round did not work.
 *
 * The route answers a refused transition in English prose — `Transition from
 * 'draft' to 'closed' is not allowed.` — which used to be printed straight into
 * this Hebrew screen. The API's wording is for the log; the screen says what
 * happened and what to do about it, in the language it is written in.
 *
 * A `409` is now a race rather than a dead button: the round changed status
 * since this page was rendered, so the answer is to look at it again.
 */
export function closeFailureMessage(status: number | undefined): string {
  if (status === 409) {
    return "מצב הסבב השתנה מאז טעינת הדף, ולכן לא ניתן לסגור אותו כעת. רעננו את הדף כדי לראות את מצבו העדכני.";
  }

  if (status === 503) {
    return "שירות הנתונים אינו זמין כרגע, ולכן הסבב לא נסגר. נסו שוב מאוחר יותר.";
  }

  return "לא ניתן היה לסגור את הסבב.";
}

export function RoundControls({
  roundId,
  shareCode,
  responseCount,
  expectedResponses,
  minimumResponses,
  status,
  isSuperseded = false,
}: RoundControlsProps) {
  const [closed, setClosed] = useState(status === "closed");
  const [closing, setClosing] = useState(false);
  const [archived, setArchived] = useState(status === "archived");
  const [archiving, setArchiving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisNote, setAnalysisNote] = useState<string | null>(null);
  const [closeError, setCloseError] = useState<string | null>(null);
  /**
   * Which irreversible action is waiting to be confirmed, if any. One piece of
   * state rather than one flag per action: exactly one of these dialogs can be
   * open, and two booleans can disagree about that.
   */
  const [pendingAction, setPendingAction] = useState<
    "archive" | "reset" | null
  >(null);
  const shareUrl = useShareUrl(shareCode);
  const { status: copyStatus, copy } = useClipboard();
  const shareInputRef = useRef<HTMLInputElement | null>(null);
  const openDashboardAction = getNavigationAction("openDashboard", roundId);
  /**
   * Both of the actions below rewrite what a round measured. An archived round
   * refuses them at the route with 409, and a superseded one is a measurement
   * the school has already answered, so neither is offered a button that
   * should not be pressed.
   */
  const readOnly = archived || isSuperseded;
  /**
   * Closing is for a round that is collecting answers. A draft has not started
   * — it opens or it is filed away, and there is nothing yet to close — and an
   * archived round is finished with. The route refuses both with a 409, so the
   * screen asks the same rule it does rather than keeping its own list of the
   * statuses that happen to work.
   */
  const closable = isRoundTransitionAllowed(status, "closed");

  /**
   * Copy the link, and when the browser refuses, select it so the manual copy
   * the failure note asks for is a single keystroke away.
   */
  async function copyShareUrl() {
    const written = await copy(shareUrl);
    if (!written) shareInputRef.current?.select();
  }

  const progress = calculatePercentage(responseCount, expectedResponses);

  async function closeRound() {
    setClosing(true);
    setCloseError(null);

    const response = await fetch(
      `/api/rounds/${encodeURIComponent(roundId)}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "closed" }),
      },
    ).catch(() => null);

    if (!response?.ok) {
      setCloseError(closeFailureMessage(response?.status));
      setClosing(false);
      return;
    }

    setClosed(true);
    setClosing(false);
  }

  /**
   * Filing a round away. Offered only once the round has stopped running,
   * because a live round leaving the list would take its share link with it,
   * and terminal — `archived` has no transition out — so it asks first.
   */
  async function archiveRound() {
    setPendingAction(null);
    setArchiving(true);
    setCloseError(null);

    const response = await fetch(
      `/api/rounds/${encodeURIComponent(roundId)}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "archived" }),
      },
    ).catch(() => null);

    if (!response?.ok) {
      // The route answers a refused transition in English prose. Managers get
      // our own sentence; the API's wording is for the log, not the screen.
      setCloseError("לא ניתן היה להעביר את הסבב לארכיון.");
      setArchiving(false);
      return;
    }

    setArchived(true);
    setArchiving(false);
  }

  async function refreshAnalysis() {
    setAnalyzing(true);
    setAnalysisNote(null);
    setCloseError(null);

    const response = await fetch(
      `/api/rounds/${encodeURIComponent(roundId)}/trigger-ai`,
      { method: "POST" },
    ).catch(() => null);

    if (!response) {
      setCloseError("לא ניתן היה לפנות לשירות הניתוח. בדקו את החיבור ונסו שוב.");
      setAnalyzing(false);
      return;
    }

    if (response.status === 409) {
      setAnalysisNote("ניתוח כבר רץ עבור הסבב הזה. המתינו לסיומו לפני הפעלה נוספת.");
      setAnalyzing(false);
      return;
    }

    if (!response.ok) {
      setCloseError(
        responseCount < minimumResponses
          ? `הניתוח יופעל רק לאחר ${minimumResponses} תשובות לפחות.`
          : "שירות הניתוח אינו זמין כרגע. נסו שוב מאוחר יותר.",
      );
      setAnalyzing(false);
      return;
    }

    setAnalysisNote("הניתוח הופעל. התוצאות יתעדכנו במפה בתוך דקות ספורות.");
    setAnalyzing(false);
  }

  async function resetRound() {
    setPendingAction(null);
    setResetting(true);
    setCloseError(null);

    const response = await fetch(
      `/api/rounds/${encodeURIComponent(roundId)}/reset`,
      { method: "POST" },
    ).catch(() => null);

    if (!response?.ok) {
      setCloseError("לא ניתן היה לאפס את נתוני הסבב.");
      setResetting(false);
      return;
    }

    window.location.reload();
  }

  return (
    <section className="round-layout">
      <div
        className="round-progress"
        role="progressbar"
        aria-label="התקדמות מילוי סבב האבחון"
        aria-valuenow={responseCount}
        aria-valuemin={0}
        aria-valuemax={expectedResponses}
        aria-valuetext={`${responseCount} מתוך ${expectedResponses} תשובות`}
      >
        <div className="progress-ring" style={{ "--progress": `${progress}%` } as CSSProperties}>
          <strong>{responseCount}</strong>
          <span>מתוך {expectedResponses}</span>
        </div>
        <p>התוצאות יוצגו רק אחרי לפחות {minimumResponses} תשובות, ללא שמות או פרטי זיהוי.</p>
      </div>

      <div className="share-panel">
        <p className="eyebrow">לינק הפצה</p>
        <div className="copy-row">
          <input
            ref={shareInputRef}
            readOnly
            dir="ltr"
            value={shareUrl}
            aria-label="לינק אנונימי לשאלון"
          />
          <button className="icon-button" type="button" onClick={copyShareUrl} aria-label="העתקת לינק">
            <Clipboard size={18} aria-hidden="true" />
          </button>
        </div>
        <CopyLinkStatus
          status={copyStatus}
          successText="הלינק הועתק. אפשר לשלוח לצוות."
        />

        <div className="round-actions">
          {readOnly ? null : (
            <>
              <button
                id="refresh-round-analysis"
                className="secondary-button"
                type="button"
                disabled={analyzing || responseCount < minimumResponses}
                onClick={refreshAnalysis}
                title={
                  responseCount < minimumResponses
                    ? `הניתוח יופעל לאחר ${minimumResponses} תשובות לפחות`
                    : "הפעלת ניתוח מחדש על כל התשובות שהתקבלו עד כה"
                }
              >
                {analyzing ? (
                  <Loader2 size={18} className="animate-spin" aria-hidden="true" />
                ) : (
                  <Sparkles size={18} aria-hidden="true" />
                )}
                {analyzing ? "מפעיל ניתוח..." : "רענון ניתוח"}
              </button>
              <button
                className="secondary-button"
                type="button"
                disabled={resetting}
                onClick={() => setPendingAction("reset")}
                title="מחיקת תשובות והחזרה לעריכת שאלון"
              >
                {resetting ? (
                  <Loader2 size={18} className="animate-spin" aria-hidden="true" />
                ) : (
                  <RotateCcw size={18} aria-hidden="true" />
                )}
                {resetting ? "מאפס..." : "איפוס נתונים"}
              </button>
            </>
          )}
          <button
            className="secondary-button"
            type="button"
            disabled={closed || closing || !closable}
            data-round-id={roundId}
            onClick={closeRound}
            title={
              closable
                ? "סימון הסבב כסגור ועצירת איסוף התשובות"
                : "סגירה ידנית אפשרית רק לסבב שאוסף תשובות"
            }
          >
            {closing ? (
              <Loader2 size={18} className="animate-spin" aria-hidden="true" />
            ) : (
              <Lock size={18} aria-hidden="true" />
            )}
            {closing ? "סוגר..." : "סגירת סבב אבחון ידנית"}
          </button>
          {closed && !archived ? (
            <button
              className="secondary-button"
              type="button"
              disabled={archiving}
              data-round-id={roundId}
              onClick={() => setPendingAction("archive")}
              title="הוצאת הסבב מרשימת הסבבים, בלי למחוק אותו"
            >
              {archiving ? (
                <Loader2 size={18} className="animate-spin" aria-hidden="true" />
              ) : (
                <Archive size={18} aria-hidden="true" />
              )}
              {archiving ? "מעביר לארכיון..." : "העברה לארכיון"}
            </button>
          ) : null}
          <Link className="primary-button" href={openDashboardAction.href}>
            <Map size={18} aria-hidden="true" />
            {openDashboardAction.label}
          </Link>
        </div>

        {closed && !archived && !isSuperseded ? (
          <div className="closed-note">
            <CheckCircle2 size={18} aria-hidden="true" />
            סבב האבחון מסומן כסגור. הדשבורד זמין לצפייה.
          </div>
        ) : null}
        {isSuperseded && !archived ? (
          <div className="closed-note">
            <History size={18} aria-hidden="true" />
            זהו סבב קודם. בית הספר עבר לסבב חדש יותר, ולכן הסבב הזה פתוח לקריאה
            בלבד: הנתונים והניתוח שלו נשמרים כפי שהיו, בלי איפוס ובלי ניתוח
            מחדש. היעדים שנבחרו בו ממשיכים להתעדכן כרגיל.
          </div>
        ) : null}
        {archived ? (
          <div className="closed-note">
            <Archive size={18} aria-hidden="true" />
            הסבב הועבר לארכיון. הוא יצא מרשימת הסבבים ונשאר זמין דרך הארכיון
            שבתחתית הרשימה, עם כל הנתונים והניתוח שלו — לקריאה בלבד. היעדים
            שנבחרו בו ממשיכים להתעדכן כרגיל.
          </div>
        ) : null}
        {analysisNote ? (
          <p className="success-note" role="status">
            {analysisNote}
          </p>
        ) : null}
        {closeError ? (
          <p className="survey-submit-error" role="alert">
            {closeError}
          </p>
        ) : null}
      </div>

      {/*
        Both of these used to ask through `window.confirm`: one English-chrome
        sentence, in the browser's own reading direction, with two buttons named
        by the browser rather than by what they do. The question is the same;
        the dialog is the product's.
      */}
      <ConfirmDialog
        isOpen={pendingAction === "archive"}
        title="העברת הסבב לארכיון"
        body="הסבב יצא מרשימת הסבבים ויישאר זמין לקריאה דרך הארכיון, עם כל הנתונים והניתוח שלו. אין דרך חזרה מארכיון לסבב פעיל."
        confirmLabel="העברה לארכיון"
        isDestructive
        isBusy={archiving}
        onConfirm={archiveRound}
        onCancel={() => setPendingAction(null)}
      />

      <ConfirmDialog
        isOpen={pendingAction === "reset"}
        title="איפוס נתוני הסבב"
        body={
          <>
            <p>
              כל התשובות שהתקבלו בסבב הזה יימחקו, והשאלון יחזור למצב עריכה.
              התשובות אנונימיות ואינן ניתנות לשחזור לאחר המחיקה.
            </p>
            <p>
              עד כה התקבלו <strong>{responseCount}</strong> תשובות.
            </p>
          </>
        }
        confirmLabel="מחיקת התשובות ואיפוס"
        isDestructive
        isBusy={resetting}
        onConfirm={resetRound}
        onCancel={() => setPendingAction(null)}
      />
    </section>
  );
}
