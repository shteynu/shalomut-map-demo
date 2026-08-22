/**
 * The one field on the setup screen whose text leaves this platform.
 *
 * The background note reaches the model's prompt verbatim on contract 4.0 and
 * above — `background_context.notes` on the MCP payload — and until 2026-08-22
 * nothing at the point of entry said so. A manager typing "our counsellor has
 * been on sick leave since March" was naming a member of staff to a
 * subprocessor from a screen that looked entirely internal.
 *
 * A component rather than a paragraph in the form, for the same reason
 * `StaffFloorWarning` is one: the sentence is a rule the product makes about
 * itself, and a rule with a test does not quietly disappear in a redesign.
 */
export function BackgroundNoteWarning({ id }: { id?: string }) {
  return (
    <p id={id} className="quiet-note">
      ההערה נשלחת כלשונה למודל שכותב את המפה, ולכן היא יוצאת מהפלטפורמה. אל
      תכתבו כאן שמות של אנשי צוות או פרטים מזהים אחרים.
    </p>
  );
}
