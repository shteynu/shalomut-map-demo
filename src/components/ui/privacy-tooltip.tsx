"use client";

import { HelpCircle } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { DEFAULT_PRIVACY_THRESHOLD } from "@/lib/survey-definition";
import { PrivacyThresholdNotice } from "@/components/ui/privacy-threshold-notice";

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
        <span className="privacy-tooltip-lede">
          זהו מספר המשיבים המינימלי הנדרש כדי לפתוח את מפת השלומות והתוצאות לצפייה (בסבב הנוכחי: {minimumResponses} אנשי צוות).
        </span>
        <strong className="privacy-tooltip-heading">למה זה חשוב?</strong>
        <ul className="privacy-tooltip-reasons">
          <li><strong>הגנה על אנונימיות</strong>: מניעת אפשרות לזהות משיב בודד לפי תשובותיו או הערותיו.</li>
          <li><strong>שיקוף משוב כנה</strong>: הצוות מרגיש בטוח לתת ביקורת בונה כשהתוצאות מצרפיות בלבד.</li>
          <li><strong>מהימנות הנתונים</strong>: קבלת תמונת מצב אובייקטיבית ומקצועית המייצגת את כלל בית הספר.</li>
        </ul>
        <span className="privacy-tooltip-note">
          כל עוד לא התקבלו מספיק תשובות, המפה תישאר נעולה ויוצג רק מספר המשיבים הכללי.
        </span>
        <span className="privacy-tooltip-threshold">
          <PrivacyThresholdNotice minimumResponses={minimumResponses} />
        </span>
      </span>
    </span>
  );
}
