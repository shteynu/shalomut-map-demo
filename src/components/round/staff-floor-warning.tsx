import { AlertTriangle } from "lucide-react";
import { describeStaffFloorRefusal } from "@/lib/rounds/staff-floor";

/**
 * The two numbers that disagree, said while the manager is still typing them.
 *
 * The rule itself is not new: `POST /api/manager/setup` has refused this round
 * since `staff-floor.ts` existed. What was missing is that the refusal arrived
 * only after the manager filled in the whole screen and pressed save. The same
 * function answers here, so the two can never say different things.
 *
 * A staff count of zero is not a disagreement, it is an unfilled field, and the
 * input's own `required` owns that case.
 */
export function staffFloorWarningText(
  totalStaffCount: number,
  privacyThreshold: number,
): string | null {
  if (
    !Number.isFinite(totalStaffCount) ||
    !Number.isFinite(privacyThreshold) ||
    totalStaffCount < 1
  ) {
    return null;
  }

  return (
    describeStaffFloorRefusal(totalStaffCount, privacyThreshold)?.message ?? null
  );
}

export function StaffFloorWarning({
  totalStaffCount,
  privacyThreshold,
  id,
}: {
  totalStaffCount: number;
  privacyThreshold: number;
  /** Named so the staff-count input can point `aria-describedby` at it. */
  id?: string;
}) {
  const message = staffFloorWarningText(totalStaffCount, privacyThreshold);
  if (!message) return null;

  return (
    // The warning is carried by the words and by the icon's own label, never by
    // colour alone; `status` rather than `alert` because the manager is typing
    // and has not asked for anything yet.
    <span
      id={id}
      className="survey-submit-error"
      style={{ display: "block" }}
      role="status"
    >
      <AlertTriangle size={16} aria-hidden="true" /> {message}
    </span>
  );
}
