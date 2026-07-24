"use client";

import Link from "next/link";
import { CheckCircle2, Clipboard, Lock, Map } from "lucide-react";
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
            disabled={closed || closing}
            data-round-id={roundId}
            onClick={closeRound}
          >
            <Lock size={18} aria-hidden="true" />
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
        {closeError ? (
          <p className="survey-submit-error" role="alert">
            {closeError}
          </p>
        ) : null}
      </div>
    </section>
  );
}
