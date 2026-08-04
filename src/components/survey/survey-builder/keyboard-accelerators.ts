/**
 * Keyboard accelerators for the builder.
 *
 * Every action already has a native button and is reachable by Tab, so this is
 * speed, not access: a manager reviewing a 24-question instrument should not
 * have to walk the focus ring between each edit.
 *
 * Two rules shape the set:
 *
 * - **Chords are read from `event.code`, the physical key**, never from
 *   `event.key`. The product is Hebrew-first, and on a Hebrew layout `event.key`
 *   for the D key is `ג`. Matching the character would mean the shortcuts work
 *   only for managers typing in English.
 * - **Nothing destructive gets a chord.** Deleting a question stays a
 *   deliberate button press with its confirmation; a mistyped chord must not be
 *   able to remove a question's wording.
 */

/** What a chord means inside one question card. */
export type QuestionAccelerator =
  | "move-up"
  | "move-down"
  | "edit"
  | "duplicate"
  | "toggle-enabled"
  | "toggle-required";

/** What a chord means anywhere on the builder screen. */
export type BuilderAccelerator = "save" | "focus-search";

/** The parts of a keyboard event these functions read. */
export type KeyChord = {
  code: string;
  /** Only read when `code` is empty; see `physicalKeyOf`. */
  key?: string;
  altKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
};

/**
 * The physical key this chord names.
 *
 * `code` is the answer whenever there is one. It is empty on the keyboards that
 * have no physical keys to report — on-screen and IME keyboards, and some
 * automation — and there the character is all there is, so it is read as a last
 * resort. A Hebrew character will not match any of the letters below, which is
 * the honest outcome: that keyboard has no accelerator, rather than a wrong one.
 */
function physicalKeyOf(chord: KeyChord): string {
  if (chord.code) return chord.code;

  const key = chord.key ?? "";
  if (/^[a-zA-Z]$/.test(key)) return `Key${key.toUpperCase()}`;
  if (key === "/") return "Slash";
  return key;
}

const QUESTION_ACCELERATORS: Record<string, QuestionAccelerator> = {
  ArrowUp: "move-up",
  ArrowDown: "move-down",
  KeyE: "edit",
  KeyD: "duplicate",
  KeyH: "toggle-enabled",
  KeyR: "toggle-required",
};

/**
 * The per-question chord, or null.
 *
 * All of them are Alt and one key: Alt is the modifier browsers and the two
 * desktop platforms leave alone for a page's own use, unlike Ctrl/Cmd. Arrow
 * keys carry the move because up and down mean the same thing in an RTL layout
 * as in an LTR one — a left/right chord would have to flip with direction, and
 * a reorder shortcut that reverses itself is worse than none.
 */
export function questionAcceleratorFor(chord: KeyChord): QuestionAccelerator | null {
  if (!chord.altKey || chord.ctrlKey || chord.metaKey || chord.shiftKey) {
    return null;
  }

  return QUESTION_ACCELERATORS[physicalKeyOf(chord)] ?? null;
}

/**
 * The screen-wide chord, or null.
 *
 * `isTextEntry` says whether the caret is in a field the manager is typing
 * into. Search is a bare `/`, which is a character, so it may only take over
 * when it is not being typed as one; save is Ctrl/Cmd+S, which is a chord
 * everywhere and stays available while writing a question.
 */
export function builderAcceleratorFor(
  chord: KeyChord,
  isTextEntry: boolean,
): BuilderAccelerator | null {
  const physicalKey = physicalKeyOf(chord);

  if (physicalKey === "KeyS" && (chord.metaKey || chord.ctrlKey) && !chord.altKey) {
    return "save";
  }

  if (
    physicalKey === "Slash" &&
    !isTextEntry &&
    !chord.altKey &&
    !chord.ctrlKey &&
    !chord.metaKey &&
    !chord.shiftKey
  ) {
    return "focus-search";
  }

  return null;
}

/** Whether this element is one the manager types into. */
export function isTextEntryElement(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;

  const tagName = target.tagName;
  return tagName === "INPUT" || tagName === "TEXTAREA" || tagName === "SELECT";
}
