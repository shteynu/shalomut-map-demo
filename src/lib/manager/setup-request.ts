import type { RoundBackgroundContext } from "@/lib/types/backend";

export type ManagerSetupRequest = {
  /** Say it out loud or the API scopes the write to the school already in hand. */
  createOrganization: boolean;
  organization: {
    id?: string;
    name: string;
    city: string;
    schoolType: string;
    totalStaffCount: number;
  };
  round: {
    /** Absent is what makes the write open a round rather than edit one. */
    id?: string;
    title: string;
    startDate: string;
    endDate: string;
    privacyThreshold: number;
    backgroundContext: RoundBackgroundContext;
  };
};

export type ManagerSetupOutcome =
  | { ok: true; organizationId?: string; roundId?: string }
  | { ok: false; error: string };

/**
 * One way for a dialog to reach `PUT /api/manager/setup`.
 *
 * The route answers a bad payload with `Invalid manager setup payload.` and a
 * refused round with a Hebrew sentence of its own. Only the second is worth
 * showing: the first means this code sent something the route did not
 * recognise, which is a defect and not something a manager can act on, so it
 * is replaced with a sentence that at least says what to do next.
 */
export async function saveManagerSetup(
  body: ManagerSetupRequest,
): Promise<ManagerSetupOutcome> {
  const response = await fetch("/api/manager/setup", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).catch(() => null);

  if (!response) {
    return {
      ok: false,
      error: "לא ניתן היה לפנות לשרת. בדקו את החיבור ונסו שוב.",
    };
  }

  const payload = (await response.json().catch(() => null)) as {
    error?: string;
    organization?: { id?: string };
    round?: { id?: string };
  } | null;

  if (!response.ok) {
    return { ok: false, error: managerSetupError(payload?.error) };
  }

  return {
    ok: true,
    organizationId: payload?.organization?.id,
    roundId: payload?.round?.id,
  };
}

/** Hebrew the manager can act on, whatever the route happened to say. */
export function managerSetupError(error: string | undefined): string {
  const trimmed = error?.trim();

  if (trimmed && /[֐-׿]/u.test(trimmed)) {
    return trimmed;
  }

  return "לא ניתן היה לשמור. בדקו את הפרטים ונסו שוב.";
}
