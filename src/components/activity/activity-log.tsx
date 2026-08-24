import type { ActivityLogEntry } from "@/lib/audit/activity-log-view";

/**
 * The school's own hours. The log is written wherever the runtime happens to
 * run — which is not this country — and «at 03:14» has to mean the time the
 * person acting would have seen on their own clock.
 */
const SCHOOL_TIME_ZONE = "Asia/Jerusalem";

const timestampFormatter = new Intl.DateTimeFormat("he-IL", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: SCHOOL_TIME_ZONE,
});

export interface ActivityLogProps {
  entries: ActivityLogEntry[];
  /** The next page, older than this one. Absent at the end of the log. */
  nextHref?: string;
  /** The newest page, offered only when this one is not it. */
  newestHref?: string;
}

/**
 * What was done in one school, newest first.
 *
 * Every row is a record of an action that already happened, so nothing here is
 * a control: the screen offers no way to change, hide or delete a line. That is
 * not a simplification — an audit log a reader can edit is not evidence, and
 * whether rows are ever *removed* is a retention decision that belongs to the
 * owner and to a scheduled job, not to whoever has this page open.
 *
 * The page walks by cursor rather than by number. An audit log is written to
 * while it is being read, so a numbered page is a different set of rows each
 * time it is asked for, and «page 3» would quietly skip whatever arrived since
 * page 2.
 */
export function ActivityLog({ entries, nextHref, newestHref }: ActivityLogProps) {
  return (
    <section className="activity-log" dir="rtl">
      {entries.length === 0 ? (
        <p className="activity-empty">
          {newestHref
            ? "אין פעולות ישנות יותר להצגה."
            : "עדיין לא נרשמה פעולה בבית הספר הזה."}
        </p>
      ) : (
        <ol className="activity-entries">
          {entries.map((entry) => (
            <li key={entry.id} className="activity-entry">
              <p className="activity-entry-head">
                <strong>{entry.actionLabel}</strong>
                <time dateTime={entry.at.toISOString()}>
                  {timestampFormatter.format(entry.at)}
                </time>
              </p>

              <p className="activity-entry-actor">
                {entry.actorIsIdentified ? (
                  <span dir="ltr">{entry.actor}</span>
                ) : (
                  <>
                    {"חשבון שאינו קיים עוד · "}
                    <span dir="ltr">{entry.actor}</span>
                  </>
                )}
              </p>

              {entry.roundTitle ? (
                <p className="activity-entry-round">סבב: {entry.roundTitle}</p>
              ) : null}

              {entry.details.length > 0 ? (
                <ul className="activity-entry-details">
                  {entry.details.map((detail) => (
                    <li key={detail.key}>
                      {/* The field keeps the name it was recorded under, so a
                          reader can match the screen against the row. */}
                      <code dir="ltr">{detail.key}</code>
                      <span dir="auto">{detail.value}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          ))}
        </ol>
      )}

      {nextHref || newestHref ? (
        <nav className="activity-pager" aria-label="דפדוף ביומן">
          {newestHref ? (
            <a className="secondary-button" href={newestHref}>
              חזרה לפעולות האחרונות
            </a>
          ) : null}
          {nextHref ? (
            <a className="secondary-button" href={nextHref}>
              לפעולות ישנות יותר
            </a>
          ) : null}
        </nav>
      ) : null}
    </section>
  );
}
