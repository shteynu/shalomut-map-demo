"use client";

import { X } from "lucide-react";
import { useEffect, useId, useRef, type ReactNode, type RefObject } from "react";

type ModalDialogProps = {
  isOpen: boolean;
  /** The heading, and what a screen reader announces the dialog as. */
  title: string;
  onClose: () => void;
  children: ReactNode;
  /** One sentence under the heading, announced with it. */
  description?: ReactNode;
  /** For a dialog that needs a width other than the default. */
  panelClassName?: string;
  /**
   * Focused when the dialog opens. Without it the first focusable element in
   * the panel takes focus, which for a form is its first field.
   */
  initialFocusRef?: RefObject<HTMLElement | null>;
};

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

/**
 * The one dialog in this product.
 *
 * The question editor grew a backdrop, a focus trap, an Escape handler and a
 * focus-restore of its own, and every screen that wanted a dialog afterwards
 * would have grown its own copy — four traps, four Escape handlers, and four
 * chances for one of them to let keyboard focus walk out into the page behind
 * the overlay. The behaviour lives here once; each dialog supplies only its
 * own contents.
 */
export function ModalDialog({
  isOpen,
  title,
  onClose,
  children,
  description,
  panelClassName,
  initialFocusRef,
}: ModalDialogProps) {
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    previousActiveElement.current = document.activeElement as HTMLElement | null;

    // After paint, so the element being focused is the one the browser has
    // actually laid out rather than whatever was there when the effect ran.
    const timer = setTimeout(() => {
      if (initialFocusRef?.current) {
        initialFocusRef.current.focus();
        return;
      }
      dialogRef.current
        ?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR)
        ?.focus();
    }, 50);

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
        return;
      }

      if (event.key !== "Tab") return;

      // Keyboard focus stays inside the dialog while it is open, so Tab cannot
      // walk into the page behind the overlay.
      const focusable = Array.from(
        dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR) ??
          [],
      ).filter((element) => element.offsetParent !== null);

      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;

      if (
        event.shiftKey &&
        (active === first || !dialogRef.current?.contains(active))
      ) {
        event.preventDefault();
        last.focus();
        return;
      }

      if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("keydown", handleKeyDown);
      previousActiveElement.current?.focus();
    };
  }, [isOpen, onClose, initialFocusRef]);

  if (!isOpen) return null;

  return (
    <div
      className="modal-dialog-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      ref={dialogRef}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className={`modal-dialog-panel${panelClassName ? ` ${panelClassName}` : ""}`}
        dir="rtl"
      >
        <div className="modal-dialog-header">
          <h2 id={titleId}>{title}</h2>
          <button
            type="button"
            className="icon-button"
            onClick={onClose}
            aria-label="סגירה"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        {description ? (
          <p id={descriptionId} className="modal-dialog-description">
            {description}
          </p>
        ) : null}

        {children}
      </div>
    </div>
  );
}
