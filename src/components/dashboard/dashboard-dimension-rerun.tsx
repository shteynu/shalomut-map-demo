"use client";

import { useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import type { WellbeingDimensionId } from "@/lib/shalomut-source";

/**
 * Ask for this one dimension to be written again.
 *
 * The note beside it says the paragraphs came from the numbers and that a
 * re-run would get a real reading. Until now the only thing that sentence
 * could mean was the round screen's button, which re-runs all eight — so the
 * manager had to leave the screen, find it, and pay for seven dimensions
 * nobody had complained about. This asks for the one they are looking at.
 *
 * `onQueued` is how the screen learns to start watching. It was once right for
 * this button to promise nothing about when — the run is queued, a worker
 * claims it, and a spinner that pretends to track a background job lies the
 * moment the tab is closed. The screen can now genuinely follow the run and
 * says so only while it is following, so telling the caller a run exists is
 * both true and the useful thing to do. Without the callback the old sentence
 * stands, because then nothing is watching.
 */
export function DashboardDimensionRerun({
  roundId,
  dimensionId,
  onQueued,
}: {
  roundId: string;
  dimensionId: WellbeingDimensionId;
  onQueued?: () => void;
}) {
  const [status, setStatus] = useState<
    "idle" | "sending" | "queued" | "busy" | "gone" | "error"
  >("idle");

  async function request() {
    setStatus("sending");

    const response = await fetch(
      `/api/rounds/${encodeURIComponent(roundId)}/trigger-ai`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ dimensionIds: [dimensionId] }),
      },
    ).catch(() => null);

    if (!response) return setStatus("error");

    if (response.status === 409) {
      // Two different 409s reach here and they ask for two different things of
      // the reader: wait, or run the whole round first.
      const code = await response
        .json()
        .then((body) => body?.code)
        .catch(() => undefined);
      return setStatus(code === "no_previous_analysis" ? "gone" : "busy");
    }

    if (!response.ok) return setStatus("error");

    setStatus("queued");
    // Read again straight away: the run is now `queued`, so this is what turns
    // the screen from one that has an answer into one that is waiting for a
    // better one — and the waiting is what the watch follows.
    onQueued?.();
  }

  if (status === "queued") {
    return (
      <p className="dashboard-blob-provenance" role="status">
        {onQueued
          ? "הבקשה נקלטה. הניתוח של הממד הזה נכתב מחדש כעת, והמסך יתעדכן מעצמו בסיומו."
          : "הבקשה נקלטה. הניתוח של הממד הזה ייכתב מחדש ברקע, ויופיע כאן בכניסה הבאה למסך."}
      </p>
    );
  }

  return (
    <>
      <button
        type="button"
        className="secondary-button"
        disabled={status === "sending"}
        onClick={request}
        title="הפעלת ניתוח מחדש לממד הזה בלבד, בלי להריץ את שאר הסבב"
      >
        {status === "sending" ? (
          <Loader2 size={18} className="animate-spin" aria-hidden="true" />
        ) : (
          <Sparkles size={18} aria-hidden="true" />
        )}
        {status === "sending" ? "שולח..." : "ניתוח מחדש לממד הזה"}
      </button>
      {status === "busy" ? (
        <p className="dashboard-blob-provenance" role="status">
          ניתוח של הסבב הזה כבר רץ. אפשר לנסות שוב אחרי שהוא יסתיים.
        </p>
      ) : null}
      {status === "gone" ? (
        <p className="dashboard-blob-provenance" role="status">
          לסבב הזה אין ניתוח שמור לעדכן. הפעילו ניתוח מלא ממסך הסבב.
        </p>
      ) : null}
      {status === "error" ? (
        <p className="dashboard-blob-provenance" role="alert">
          לא ניתן היה לפנות לשירות הניתוח. בדקו את החיבור ונסו שוב.
        </p>
      ) : null}
    </>
  );
}
