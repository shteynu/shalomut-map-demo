"use client";

import { Loader2, TriangleAlert } from "lucide-react";
import { useRef, type ReactNode } from "react";
import { ModalDialog } from "./modal-dialog";

type ConfirmDialogProps = {
  isOpen: boolean;
  title: string;
  /** What the action will do, in enough detail to answer with. */
  body: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  /**
   * Whether the action removes or overwrites something. A destructive dialog
   * says so with a warning line and an icon as well as with the button, so the
   * difference is never carried by colour alone.
   */
  isDestructive?: boolean;
  /** In flight, so the dialog stays open and says the work is running. */
  isBusy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

/**
 * The replacement for `window.confirm`.
 *
 * Every irreversible action in the manager screens asked its question through
 * the browser's own dialog: an English-chrome box, in the operating system's
 * reading direction, that could say one sentence and offer two buttons named
 * by the browser. This asks in the product's own Hebrew, names the action on
 * the button that performs it, and can say what will happen rather than only
 * what is about to be pressed.
 */
export function ConfirmDialog({
  isOpen,
  title,
  body,
  confirmLabel,
  cancelLabel = "ביטול",
  isDestructive = false,
  isBusy = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  // Focus lands on the way out, not on the button that does the thing.
  const cancelRef = useRef<HTMLButtonElement>(null);

  return (
    <ModalDialog
      isOpen={isOpen}
      title={title}
      onClose={onCancel}
      panelClassName="modal-dialog-panel-narrow"
      initialFocusRef={cancelRef}
    >
      <div className="confirm-dialog-body">
        {isDestructive ? (
          <p className="confirm-dialog-warning">
            <TriangleAlert size={18} aria-hidden="true" />
            <span>הפעולה אינה הפיכה.</span>
          </p>
        ) : null}
        {typeof body === "string" ? <p>{body}</p> : body}
      </div>

      <div className="modal-dialog-footer">
        <button
          type="button"
          className="secondary-button"
          onClick={onCancel}
          ref={cancelRef}
          disabled={isBusy}
        >
          {cancelLabel}
        </button>
        <button
          type="button"
          className={
            isDestructive
              ? "primary-button primary-button-danger"
              : "primary-button"
          }
          onClick={onConfirm}
          disabled={isBusy}
        >
          {isBusy ? (
            <Loader2 size={18} className="animate-spin" aria-hidden="true" />
          ) : null}
          {confirmLabel}
        </button>
      </div>
    </ModalDialog>
  );
}
