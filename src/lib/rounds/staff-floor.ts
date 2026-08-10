/**
 * The round a school must not be allowed to run.
 *
 * The privacy threshold is a promise to the people answering: nothing is shown
 * until enough of them have answered that no one is identifiable. A staff
 * smaller than that threshold cannot keep the promise and cannot break it
 * either — the round simply collects answers that can never be displayed. Every
 * teacher who fills it in has handed something to their principal in exchange
 * for nothing, and the product has spent the one round's worth of goodwill a
 * school gives it.
 *
 * So this is a refusal rather than a warning. It is not a judgement about how
 * small a staff room is too small to measure safely — that question needs a
 * human, and `docs/product-strategy-axes-2026-08-10.md` axis 7 holds it open.
 * It is the case that is provable from two numbers the manager already typed.
 */
export interface StaffFloorRefusal {
  totalStaffCount: number;
  privacyThreshold: number;
  message: string;
}

export function describeStaffFloorRefusal(
  totalStaffCount: number,
  privacyThreshold: number,
): StaffFloorRefusal | null {
  if (totalStaffCount >= privacyThreshold) return null;

  return {
    totalStaffCount,
    privacyThreshold,
    message:
      `בבית ספר עם ${totalStaffCount} אנשי צוות לא ניתן להגיע לסף הפרטיות ` +
      `של ${privacyThreshold} משיבים, ולכן התוצאות לא ייפתחו לעולם. ` +
      `אם מספר אנשי הצוות הוזן בטעות אפשר לתקן אותו; אחרת בית הספר הזה קטן ` +
      `מכדי להריץ סבב, ולא נכון לאסוף תשובות שאי אפשר להראות.`,
  };
}
