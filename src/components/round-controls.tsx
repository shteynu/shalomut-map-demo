"use client";

import Link from "next/link";
import { CheckCircle2, Clipboard, Lock, Map } from "lucide-react";
import type { CSSProperties } from "react";
import { useState } from "react";
import { activeRound } from "@/lib/demo-data";
import { getNavigationAction } from "@/lib/navigation";
import { useShareUrl } from "@/lib/use-share-url";

export function RoundControls() {
  const [copied, setCopied] = useState(false);
  const [closed, setClosed] = useState(false);
  const shareUrl = useShareUrl();
  const openDashboardAction = getNavigationAction("openDashboard");

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
    } catch {
      setCopied(true);
    }
  }

  const progress = Math.round((activeRound.responseCount / activeRound.expectedResponses) * 100);

  return (
    <section className="round-layout">
      <div
        className="round-progress"
        role="progressbar"
        aria-label="התקדמות מילוי סבב האבחון"
        aria-valuenow={activeRound.responseCount}
        aria-valuemin={0}
        aria-valuemax={activeRound.expectedResponses}
        aria-valuetext={`${activeRound.responseCount} מתוך ${activeRound.expectedResponses} תשובות`}
      >
        <div className="progress-ring" style={{ "--progress": `${progress}%` } as CSSProperties}>
          <strong>{activeRound.responseCount}</strong>
          <span>מתוך {activeRound.expectedResponses}</span>
        </div>
        <p>התוצאות יוצגו רק אחרי לפחות {activeRound.minimumResponses} תשובות, ללא שמות או פרטי זיהוי.</p>
      </div>

      <div className="share-panel">
        <p className="eyebrow">לינק הפצה</p>
        <div className="copy-row">
          <input readOnly dir="ltr" value={shareUrl} aria-label="לינק אנונימי לשאלון" />
          <button className="icon-button" type="button" onClick={copyLink} aria-label="העתקת לינק">
            <Clipboard size={18} aria-hidden="true" />
          </button>
        </div>
        {copied ? <p className="success-note">הלינק הועתק. אפשר לשלוח לצוות.</p> : null}

        <div className="round-actions">
          <button className="secondary-button" type="button" onClick={() => setClosed(true)}>
            <Lock size={18} aria-hidden="true" />
            סגירת סבב אבחון ידנית
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
      </div>
    </section>
  );
}
