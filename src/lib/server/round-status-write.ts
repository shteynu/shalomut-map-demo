import { NextResponse } from "next/server";
import type { RoundStatusWrite } from "@/lib/repositories/interfaces";

export type RefusedStatusWrite = Exclude<
  RoundStatusWrite,
  { outcome: "written" }
>;

/**
 * Turn a status write that did not happen into the answer the manager gets.
 *
 * One mapping for every route, because the previous arrangement was no mapping
 * at all: a refused write came back as `null`, every caller read that as
 * "nothing to report", and the response said `success: true`. The status codes
 * are the ones the client already distinguishes — 404 for a round that is gone,
 * 409 for a conflict the manager can resolve by looking at the school's rounds,
 * 500 only for a failure that is ours.
 *
 * The database's own words are deliberately not forwarded. `write_failed`
 * carries a driver message meant for a log, and a connection string or a
 * constraint name is not something a manager screen should print.
 */
export function describeRefusedStatusWrite(write: RefusedStatusWrite): {
  status: number;
  error: string;
} {
  switch (write.outcome) {
    case "not_found":
      return { status: 404, error: "This survey round no longer exists." };

    case "status_changed":
      return {
        status: 409,
        error: `This round is '${write.current}' now, so the change was not applied. Reload the round and try again.`,
      };

    case "another_round_is_active":
      return {
        status: 409,
        error: write.activeRound
          ? `This school is already running '${write.activeRound.title}'. Close that round before starting another.`
          : "This school is already running another round. Close that round before starting another.",
      };

    case "write_failed":
      return { status: 500, error: "The round status could not be saved." };
  }
}

export function refusedStatusWriteResponse(
  write: RefusedStatusWrite,
): NextResponse {
  const { status, error } = describeRefusedStatusWrite(write);

  if (write.outcome === "write_failed") {
    console.error("A round status write failed:", write.reason);
  }

  return NextResponse.json({ error }, { status });
}
