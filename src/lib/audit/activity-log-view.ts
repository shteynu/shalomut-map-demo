import type { AuditActionType } from "@/lib/auth/manager-audit-service";
import type { AuditEvent } from "@/lib/auth/types";

/**
 * What each recorded action is called on screen.
 *
 * `Record<AuditActionType, string>` rather than a lookup with a fallback baked
 * in: the day an action is added to the log, this file stops compiling, which
 * is the only moment anybody is still thinking about what the new action should
 * be called. The fallback below exists for a different case — a row written by
 * a version that had an action this one does not — and not as permission to
 * skip a label.
 */
const ACTION_LABEL: Record<AuditActionType, string> = {
  ADMINISTRATOR_SCHOOL_VISIT: "צפייה בבית הספר",
  SETUP_SAVED: "שמירת הגדרות הסבב",
  ROUND_CREATED: "פתיחת סבב אבחון",
  ROUND_STATUS_UPDATED: "שינוי מצב הסבב",
  ROUND_RESET: "איפוס הסבב",
  SURVEY_DEFINITION_UPDATED: "עדכון השאלון",
  AI_TRIGGERED: "הפעלת ניתוח",
  SCHOOL_CREATED: "פתיחת בית ספר",
  MEMBER_INVITED: "הזמנת משתמש",
  MEMBER_REVOKED: "השעיית משתמש",
  MEMBER_RESTORED: "החזרת משתמש",
  ADMINISTRATOR_INVITED: "הזמנת מנהל פלטפורמה",
};

/**
 * One recorded field, as the screen shows it.
 *
 * The key keeps the name it was written under, in English, because it is the
 * name in the row rather than product copy. Translating it would create a
 * second vocabulary for the same field, and the reader of an audit log is
 * someone who may have to match what is on screen against what is in the
 * database.
 */
export interface ActivityLogDetail {
  key: string;
  value: string;
}

export interface ActivityLogEntry {
  id: string;
  at: Date;
  /** The stored action, kept for the case where there is no label for it. */
  action: string;
  actionLabel: string;
  /**
   * Who acted: their address when the person is still known, and their stored
   * id when they are not. An audit row outlives the account it names, and an
   * unresolvable id is the honest answer rather than a blank.
   */
  actor: string;
  actorIsIdentified: boolean;
  /** The round this was done to, when it was done to one. */
  roundTitle?: string;
  details: ActivityLogDetail[];
}

/** Who the log can name, and what the rounds it points at are called. */
export interface ActivityLogNames {
  actorsById: ReadonlyMap<string, string>;
  roundTitlesById: ReadonlyMap<string, string>;
}

function formatValue(value: unknown): string | null {
  if (typeof value === "string") return value.trim() || null;
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : null;
  // The two booleans in the log — whether a questionnaire changed, whether
  // saving it activated the round — are read as questions, so they answer in
  // the language the rest of the line is in.
  if (typeof value === "boolean") return value ? "כן" : "לא";
  if (Array.isArray(value)) {
    const parts = value.map(formatValue).filter((part): part is string => part !== null);
    return parts.length > 0 ? parts.join(", ") : null;
  }

  // Anything nested is dropped rather than stringified. Nothing writes a nested
  // detail today, and `[object Object]` on an audit screen is worse than the
  // field being absent: it looks like a value that was recorded and is not.
  return null;
}

/**
 * The recorded fields of one event, in the order they were written.
 *
 * Bounded, because the details column takes whatever a route passed it and a
 * screen is not the place to discover that something passed a hundred fields.
 */
const MAXIMUM_DETAILS = 8;

function toDetails(details: Record<string, unknown> | undefined): ActivityLogDetail[] {
  if (!details) return [];

  const rows: ActivityLogDetail[] = [];
  for (const [key, value] of Object.entries(details)) {
    if (rows.length === MAXIMUM_DETAILS) break;
    const formatted = formatValue(value);
    if (formatted !== null) rows.push({ key, value: formatted });
  }

  return rows;
}

/**
 * One page of the log, ready to render.
 *
 * The names come in rather than being looked up here: the ids in a page are
 * known only once the page is read, so resolving them is one query per page at
 * the entrypoint instead of one per row from inside a component.
 */
export function buildActivityLog(
  events: readonly AuditEvent[],
  names: ActivityLogNames,
): ActivityLogEntry[] {
  return events.map((event) => {
    const actor = names.actorsById.get(event.managerId);
    const roundTitle = event.roundId
      ? names.roundTitlesById.get(event.roundId)
      : undefined;

    const shownActor = actor ?? event.managerId;

    return {
      id: event.id,
      at: event.timestamp,
      action: event.action,
      actionLabel:
        ACTION_LABEL[event.action as AuditActionType] ?? event.action,
      actor: shownActor,
      actorIsIdentified: actor !== undefined,
      ...(roundTitle ? { roundTitle } : {}),
      // A field that repeats something already on the line is dropped, and only
      // then. Two rows in the log do this: a visit records the administrator's
      // address as it was at the time, and a round's creation records the title
      // it was given — so without this the two commonest rows each say the same
      // string twice.
      //
      // It is not the field being hidden. When the recorded value and the
      // current one differ — somebody changed their address, a round was
      // renamed — the strings are no longer equal and both are shown, which is
      // exactly the case a reader of an audit log is looking for.
      details: toDetails(event.details).filter(
        (detail) => detail.value !== shownActor && detail.value !== roundTitle,
      ),
    };
  });
}
