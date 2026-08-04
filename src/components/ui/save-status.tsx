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

/**
 * The school's own clock, not the reader's and not the server's.
 *
 * The line is rendered on the server first and hydrated in the browser, and a
 * saved time now arrives with the page rather than only after a save in this
 * tab. Formatting in whichever zone each side happens to run in would make the
 * two disagree, and the product serves Israeli schools, so the school day is
 * the right frame for "at what time".
 */
const SCHOOL_TIME_ZONE = "Asia/Jerusalem";

function formatTime(savedAt: Date) {
  return new Intl.DateTimeFormat("he-IL", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: SCHOOL_TIME_ZONE,
  }).format(savedAt);
}

function formatDate(savedAt: Date) {
  return new Intl.DateTimeFormat("he-IL", {
    dateStyle: "long",
    timeZone: SCHOOL_TIME_ZONE,
  }).format(savedAt);
}

function formatFullTimestamp(savedAt: Date) {
  return new Intl.DateTimeFormat("he-IL", {
    dateStyle: "long",
    timeStyle: "medium",
    timeZone: SCHOOL_TIME_ZONE,
  }).format(savedAt);
}

function isToday(savedAt: Date) {
  const day = new Intl.DateTimeFormat("he-IL", {
    dateStyle: "short",
    timeZone: SCHOOL_TIME_ZONE,
  });
  return day.format(savedAt) === day.format(new Date());
}

/**
 * "בשעה 14:03" for work saved today, "ב־4 באוגוסט 2026 בשעה 14:03" otherwise.
 *
 * A save time now arrives with the page and can be days old, and an hour on its
 * own would then read as this morning's — the one claim the manager is here to
 * check.
 */
function SavedAtStamp({ savedAt }: { savedAt: Date }) {
  const time = formatTime(savedAt);
  const today = isToday(savedAt);

  return (
    <>
      {today ? "בשעה " : "ב־"}
      <time dateTime={savedAt.toISOString()} title={formatFullTimestamp(savedAt)}>
        {today ? time : `${formatDate(savedAt)} בשעה ${time}`}
      </time>
    </>
  );
}

/**
 * When this screen's work last reached the database.
 *
 * "Did that save?" was answerable only by reloading the page: the success note
 * said a save had happened at some point, and stayed on screen while the
 * manager kept typing. This says when, and stops claiming the screen matches
 * the database the moment it stops being true.
 *
 * The time is the round's own `updatedAt` rather than the browser clock, so it
 * is evidence that a write completed rather than that a button was pressed —
 * and because it is stored, a reload still answers the question.
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

  if (hasUnsavedChanges) {
    return (
      <p className="save-status save-status-pending" role="status">
        <PencilLine size={16} aria-hidden="true" />
        יש שינויים שטרם נשמרו. שמירה אחרונה <SavedAtStamp savedAt={savedAt} />.
      </p>
    );
  }

  return (
    <p className="save-status save-status-saved" role="status">
      <CheckCircle2 size={16} aria-hidden="true" />
      נשמר <SavedAtStamp savedAt={savedAt} />.
    </p>
  );
}
