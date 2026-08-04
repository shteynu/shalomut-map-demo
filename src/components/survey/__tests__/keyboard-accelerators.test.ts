import assert from "node:assert";
import test from "node:test";
import {
  builderAcceleratorFor,
  questionAcceleratorFor,
  type KeyChord,
} from "../survey-builder/keyboard-accelerators";

function chord(overrides: Partial<KeyChord> & { code: string }): KeyChord {
  return {
    altKey: false,
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    ...overrides,
  };
}

test("Alt and one key drives every per-question action", () => {
  const expected: Array<[string, string]> = [
    ["ArrowUp", "move-up"],
    ["ArrowDown", "move-down"],
    ["KeyE", "edit"],
    ["KeyD", "duplicate"],
    ["KeyH", "toggle-enabled"],
    ["KeyR", "toggle-required"],
  ];

  for (const [code, accelerator] of expected) {
    assert.strictEqual(
      questionAcceleratorFor(chord({ code, altKey: true })),
      accelerator,
      `Alt+${code}`,
    );
  }
});

test("the chords are read from the physical key, not the character", () => {
  // On a Hebrew layout the D key reports `event.key === "ג"`. These functions
  // never see `key`, which is the whole point: the shortcuts have to work for a
  // manager typing Hebrew, which is every manager.
  assert.strictEqual(
    questionAcceleratorFor(chord({ code: "KeyD", altKey: true })),
    "duplicate",
  );
});

test("a keyboard with no physical key falls back to the character", () => {
  // On-screen and IME keyboards report an empty `code`. There the character is
  // all there is, so it is read rather than dropping the accelerator entirely.
  assert.strictEqual(
    questionAcceleratorFor(chord({ code: "", key: "ArrowDown", altKey: true })),
    "move-down",
  );
  assert.strictEqual(
    questionAcceleratorFor(chord({ code: "", key: "d", altKey: true })),
    "duplicate",
  );
  assert.strictEqual(
    builderAcceleratorFor(chord({ code: "", key: "/" }), false),
    "focus-search",
  );
});

test("a character-only Hebrew key gets no accelerator rather than a wrong one", () => {
  assert.strictEqual(
    questionAcceleratorFor(chord({ code: "", key: "ג", altKey: true })),
    null,
  );
});

test("a bare key does nothing, so typing a question stays typing", () => {
  assert.strictEqual(questionAcceleratorFor(chord({ code: "KeyD" })), null);
  assert.strictEqual(questionAcceleratorFor(chord({ code: "ArrowUp" })), null);
});

test("Alt with a second modifier is somebody else's shortcut", () => {
  for (const extra of ["ctrlKey", "metaKey", "shiftKey"] as const) {
    assert.strictEqual(
      questionAcceleratorFor(chord({ code: "KeyD", altKey: true, [extra]: true })),
      null,
      extra,
    );
  }
});

test("nothing destructive has a chord", () => {
  // Deleting a question stays a deliberate button press with its confirmation.
  const accelerators = ["ArrowUp", "ArrowDown", "KeyE", "KeyD", "KeyH", "KeyR"].map(
    (code) => questionAcceleratorFor(chord({ code, altKey: true })),
  );

  assert.ok(!accelerators.includes(null));
  assert.strictEqual(
    questionAcceleratorFor(chord({ code: "Delete", altKey: true })),
    null,
  );
  assert.strictEqual(
    questionAcceleratorFor(chord({ code: "Backspace", altKey: true })),
    null,
  );
});

test("save is Ctrl or Cmd and S, and stays available while writing", () => {
  assert.strictEqual(
    builderAcceleratorFor(chord({ code: "KeyS", ctrlKey: true }), false),
    "save",
  );
  assert.strictEqual(
    builderAcceleratorFor(chord({ code: "KeyS", metaKey: true }), true),
    "save",
    "a manager mid-sentence is exactly who wants to save",
  );
  assert.strictEqual(
    builderAcceleratorFor(chord({ code: "KeyS" }), false),
    null,
    "a bare S is a letter",
  );
});

test("slash reaches search only where a slash is not a character", () => {
  assert.strictEqual(
    builderAcceleratorFor(chord({ code: "Slash" }), false),
    "focus-search",
  );
  assert.strictEqual(
    builderAcceleratorFor(chord({ code: "Slash" }), true),
    null,
    "inside a field the manager is typing a slash, not asking for search",
  );
  assert.strictEqual(
    builderAcceleratorFor(chord({ code: "Slash", shiftKey: true }), false),
    null,
    "Shift+/ is a question mark",
  );
});

test("an unclaimed chord is left to the browser", () => {
  assert.strictEqual(builderAcceleratorFor(chord({ code: "KeyP", metaKey: true }), false), null);
  assert.strictEqual(builderAcceleratorFor(chord({ code: "KeyF", ctrlKey: true }), false), null);
});
