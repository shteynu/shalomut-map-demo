"use client";

/**
 * The reason one field is refused, under the field it is about.
 *
 * Rendered only when there is something to say, so the element the input's
 * `aria-describedby` points at exists exactly when the input is invalid. The
 * message is a sentence, never colour alone.
 */
export function FieldIssue({
  id,
  message,
}: {
  id: string;
  message: string | undefined;
}) {
  if (!message) return null;

  return (
    <span id={id} className="modal-dialog-field-issue" role="status">
      {message}
    </span>
  );
}
