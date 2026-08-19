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
 * Deliberately not a promise about when. The run is queued, a worker claims
 * it, and the paragraphs appear on the next read; the button says the request
 * landed and nothing more, because a spinner that pretends to track a
 * background job is a spinner that lies as soon as the tab is closed.
 */
export function DashboardDimensionRerun({
  roundId,
  dimensionId,
}: {
  roundId: string;
  dimensionId: WellbeingDimensionId;
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

    setStatus(response.ok ? "queued" : "error");
  }

  if (status === "queued") {
    return (
      <p className="dashboard-blob-provenance" role="status">
        הבקשה נקלטה. הניתוח של הממד הזה ייכתב מחדש ברקע, ויופיע כאן בכניסה הבאה
        למסך.
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
