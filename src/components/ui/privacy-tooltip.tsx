"use client";

import { HelpCircle } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { DEFAULT_PRIVACY_THRESHOLD } from "@/lib/survey-definition";

/**
 * Explains the privacy threshold ("סף פרטיות"). The trigger is a real button so
 * the tooltip works with keyboard (:focus-within) and touch (tap toggles
 * is-open); hover keeps working via CSS.
 */
export function PrivacyTooltip({
  minimumResponses = DEFAULT_PRIVACY_THRESHOLD,
}: {
  minimumResponses?: number;
}) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLSpanElement | null>(null);
  const tooltipId = useId();

  useEffect(() => {
    if (!open) {
      return;
    }

    function handleOutside(event: PointerEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    window.addEventListener("pointerdown", handleOutside);
    window.addEventListener("keydown", handleEscape);

    return () => {
      window.removeEventListener("pointerdown", handleOutside);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  return (
    <span ref={wrapperRef} className={`custom-tooltip-wrapper${open ? " is-open" : ""}`}>
      <button
        type="button"
        className="custom-tooltip-trigger"
        aria-expanded={open}
        aria-describedby={tooltipId}
        aria-label="הסבר על סף הפרטיות"
        onClick={() => setOpen((current) => !current)}
      >
        <HelpCircle size={14} className="custom-tooltip-icon" aria-hidden="true" />
      </button>
      <span id={tooltipId} className="custom-tooltip-content" role="tooltip">
        <strong>סף פרטיות (סף מינימום להצגת תוצאות)</strong>
        <span style={{ display: "block", marginTop: "0.4rem", marginBottom: "0.8rem", fontSize: "0.88rem", lineHeight: 1.45 }}>
          זהו מספר המשיבים המינימלי הנדרש כדי לפתוח את מפת השלומות והתוצאות לצפייה (בסבב הנוכחי: {minimumResponses} אנשי צוות).
        </span>
        <strong style={{ fontSize: "0.88rem", display: "block", marginBottom: "0.35rem" }}>למה זה חשוב?</strong>
        <ul style={{ margin: 0, paddingInlineStart: "1.1rem", fontSize: "0.84rem", lineHeight: 1.5, listStyleType: "disc" }}>
          <li style={{ marginBottom: "0.3rem" }}><strong>הגנה על אנונימיות</strong>: מניעת אפשרות לזהות משיב בודד לפי תשובותיו או הערותיו.</li>
          <li style={{ marginBottom: "0.3rem" }}><strong>שיקוף משוב כנה</strong>: הצוות מרגיש בטוח לתת ביקורת בונה כשהתוצאות מצרפיות בלבד.</li>
          <li style={{ marginBottom: "0.3rem" }}><strong>מהימנות הנתונים</strong>: קבלת תמונת מצב אובייקטיבית ומקצועית המייצגת את כלל בית הספר.</li>
        </ul>
        <span style={{ display: "block", marginTop: "0.8rem", fontSize: "0.8rem", opacity: 0.85, borderTop: "1px dashed rgba(87, 79, 58, 0.2)", paddingTop: "0.5rem", lineHeight: 1.4 }}>
          כל עוד לא התקבלו מספיק תשובות, המפה תישאר נעולה ויוצג רק מספר המשיבים הכללי.
        </span>
      </span>
    </span>
  );
}
