import type { AuditLogCursor } from "@/lib/auth/domain-contract";

/**
 * A cursor into the audit log, written small enough for an address bar.
 *
 * The cursor is two values — a timestamp and an id — because two events share a
 * millisecond whenever two administrators act at once, and a cursor that
 * carried only the timestamp would step over whatever it could not tell apart.
 * The screen pages through the URL, so both values have to survive a link.
 *
 * They travel as one parameter rather than two. Two parameters can arrive apart
 * — a hand-edited link, a copy that lost half — and a half cursor is not a
 * smaller cursor but a different one, pointing at the newest event that shares
 * a millisecond with something. One parameter is either whole or absent.
 */
const SEPARATOR = ".";

export function formatAuditLogCursor(cursor: AuditLogCursor): string {
  return `${cursor.timestamp.getTime()}${SEPARATOR}${cursor.id}`;
}

/**
 * The cursor a link is asking to continue from, or nothing.
 *
 * Nothing is the newest page, which is also what a malformed value gets: the
 * parameter is attacker-controlled and reachable by anyone who may open the
 * screen at all, and the honest answer to a cursor that names no event is the
 * start of the log rather than an error page about a query string.
 *
 * The id is taken from after the *first* separator. Ids hold no dot today, and
 * a split that assumed exactly one would turn the day they do into a cursor
 * that silently points at nothing.
 */
export function parseAuditLogCursor(
  value: string | string[] | undefined,
): AuditLogCursor | undefined {
  const raw = (Array.isArray(value) ? value[0] : value)?.trim();
  if (!raw) return undefined;

  const separatorAt = raw.indexOf(SEPARATOR);
  if (separatorAt <= 0) return undefined;

  const milliseconds = Number(raw.slice(0, separatorAt));
  const id = raw.slice(separatorAt + SEPARATOR.length).trim();
  if (!id || !Number.isInteger(milliseconds)) return undefined;

  const timestamp = new Date(milliseconds);
  if (Number.isNaN(timestamp.getTime())) return undefined;

  return { timestamp, id };
}

/**
 * The rows a page shows, and where the next one starts.
 *
 * The caller asks the repository for one row more than it means to render, and
 * that extra row is the whole answer to "is there more". The alternative is a
 * second query counting what is left — an unbounded read of the one table that
 * is never allowed one — or a next link that leads to an empty page, which is a
 * reader clicking to find out whether there was anything to click for.
 *
 * The cursor points at the last *rendered* row, never at the extra one: the
 * extra row is the first row of the next page and would be skipped by a cursor
 * that had already passed it.
 */
export function takeAuditLogPage<T extends { id: string; timestamp: Date }>(
  events: readonly T[],
  pageSize: number,
): { page: T[]; nextCursor?: AuditLogCursor } {
  const page = events.slice(0, pageSize);
  const last = page.at(-1);

  if (events.length <= page.length || !last) return { page };

  return { page, nextCursor: { timestamp: last.timestamp, id: last.id } };
}
