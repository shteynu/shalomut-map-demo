import { CheckCircle2, PencilLine } from "lucide-react";

type SaveStatusProps = {
  /**
   * When the server confirmed the write, as it reported it — not when the
   * button was clicked. A save the browser never completed has no time.
   */
  savedAt: Date | null;
  /** Edits made since that save, so the time is not read as current. */
  hasUnsavedChanges: boolean;
};

/**
 * The `savedAt` a save endpoint reported, or null when it said nothing usable.
 *
 * A missing or unparsable value shows no time at all rather than the browser's
 * own clock: a made-up timestamp is worse than none, because it is exactly the
 * claim the manager would rely on.
 */
export function parseSavedAt(value: unknown): Date | null {
  if (typeof value !== "string") return null;

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatTime(savedAt: Date) {
  return new Intl.DateTimeFormat("he-IL", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(savedAt);
}

function formatFullTimestamp(savedAt: Date) {
  return new Intl.DateTimeFormat("he-IL", {
    dateStyle: "long",
    timeStyle: "medium",
  }).format(savedAt);
}

/**
 * When this screen's work last reached the database.
 *
 * "Did that save?" was answerable only by reloading the page: the success note
 * said a save had happened at some point, and stayed on screen while the
 * manager kept typing. This says when, and stops claiming the screen matches
 * the database the moment it stops being true.
 *
 * The time comes from the server's response rather than the browser clock, so
 * it is evidence that a write completed rather than that a button was pressed.
 */
export function SaveStatus({ savedAt, hasUnsavedChanges }: SaveStatusProps) {
  if (!savedAt) {
    if (!hasUnsavedChanges) return null;

    return (
      <p className="save-status save-status-pending" role="status">
        <PencilLine size={16} aria-hidden="true" />
        יש שינויים שטרם נשמרו.
      </p>
    );
  }

  const time = formatTime(savedAt);
  const fullTimestamp = formatFullTimestamp(savedAt);

  if (hasUnsavedChanges) {
    return (
      <p className="save-status save-status-pending" role="status">
        <PencilLine size={16} aria-hidden="true" />
        יש שינויים שטרם נשמרו. שמירה אחרונה בשעה{" "}
        <time dateTime={savedAt.toISOString()} title={fullTimestamp}>
          {time}
        </time>
        .
      </p>
    );
  }

  return (
    <p className="save-status save-status-saved" role="status">
      <CheckCircle2 size={16} aria-hidden="true" />
      נשמר בשעה{" "}
      <time dateTime={savedAt.toISOString()} title={fullTimestamp}>
        {time}
      </time>
      .
    </p>
  );
}
