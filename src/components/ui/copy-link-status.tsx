import type { ClipboardStatus } from "@/lib/hooks/use-clipboard";

type CopyLinkStatusProps = {
  status: ClipboardStatus;
  /** What was copied, so the success line can say it in the screen's own words. */
  successText: string;
};

/**
 * What the screen says after a copy attempt.
 *
 * A blocked clipboard used to look exactly like a successful copy, which is the
 * worst of the three outcomes: the manager walks away believing the link is in
 * hand. The failure line names what happened and what to do instead — the link
 * is on screen and selected, so copying it by hand is one keystroke.
 */
export function CopyLinkStatus({ status, successText }: CopyLinkStatusProps) {
  if (status === "copied") {
    return (
      <p className="success-note" role="status">
        {successText}
      </p>
    );
  }

  if (status === "failed") {
    return (
      <p className="copy-failure-note" role="alert">
        הדפדפן חסם את ההעתקה האוטומטית. הקישור מסומן בשדה שלמעלה — העתיקו אותו
        ידנית עם Ctrl+C (או Cmd+C במק).
      </p>
    );
  }

  return null;
}
