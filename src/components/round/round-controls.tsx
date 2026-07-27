"use client";

import Link from "next/link";
import { CheckCircle2, Clipboard, Loader2, Lock, Map, RotateCcw, Sparkles } from "lucide-react";
import type { CSSProperties } from "react";
import { useState } from "react";
import { useClipboard } from "@/lib/hooks/use-clipboard";
import { calculatePercentage } from "@/lib/utils/math";
import { getNavigationAction } from "@/lib/navigation";
import { useShareUrl } from "@/lib/use-share-url";

type RoundControlsProps = {
  roundId: string;
  shareCode: string;
  responseCount: number;
  expectedResponses: number;
  minimumResponses: number;
  status: "draft" | "active" | "closed" | "archived";
};

export function RoundControls({
  roundId,
  shareCode,
  responseCount,
  expectedResponses,
  minimumResponses,
  status,
}: RoundControlsProps) {
  const [closed, setClosed] = useState(status === "closed");
  const [closing, setClosing] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisNote, setAnalysisNote] = useState<string | null>(null);
  const [closeError, setCloseError] = useState<string | null>(null);
  const shareUrl = useShareUrl(shareCode);
  const { copied, copy } = useClipboard();
  const openDashboardAction = getNavigationAction("openDashboard");

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
      const payload = response
        ? ((await response.json().catch(() => null)) as { error?: string } | null)
        : null;
      setCloseError(payload?.error ?? "לא ניתן היה לסגור את הסבב.");
      setClosing(false);
      return;
    }

    setClosed(true);
    setClosing(false);
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
    if (!confirm("האם למחוק את כל התשובות ולהחזיר את השאלון למצב עריכה?")) {
      return;
    }
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
          <input readOnly dir="ltr" value={shareUrl} aria-label="לינק אנונימי לשאלון" />
          <button className="icon-button" type="button" onClick={() => copy(shareUrl)} aria-label="העתקת לינק">
            <Clipboard size={18} aria-hidden="true" />
          </button>
        </div>
        {copied ? <p className="success-note">הלינק הועתק. אפשר לשלוח לצוות.</p> : null}

        <div className="round-actions">
          <button
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
            onClick={resetRound}
            title="מחיקת תשובות והחזרה לעריכת שאלון"
          >
            {resetting ? (
              <Loader2 size={18} className="animate-spin" aria-hidden="true" />
            ) : (
              <RotateCcw size={18} aria-hidden="true" />
            )}
            {resetting ? "מאפס..." : "איפוס נתונים"}
          </button>
          <button
            className="secondary-button"
            type="button"
            disabled={closed || closing}
            data-round-id={roundId}
            onClick={closeRound}
          >
            {closing ? (
              <Loader2 size={18} className="animate-spin" aria-hidden="true" />
            ) : (
              <Lock size={18} aria-hidden="true" />
            )}
            {closing ? "סוגר..." : "סגירת סבב אבחון ידנית"}
          </button>
          <Link className="primary-button" href={openDashboardAction.href}>
            <Map size={18} aria-hidden="true" />
            {openDashboardAction.label}
          </Link>
        </div>

        {closed ? (
          <div className="closed-note">
            <CheckCircle2 size={18} aria-hidden="true" />
            סבב האבחון מסומן כסגור. הדשבורד זמין לצפייה.
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
    </section>
  );
}
