import assert from "node:assert";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { NewRoundDialog } from "../new-round-dialog";
import { NewSchoolDialog } from "@/components/school/new-school-dialog";

/**
 * Opening a school and opening a round used to be the same forty-field screen
 * the current round is edited in, told apart by the wording of one button below
 * the fold — so neither the fact that this was a creation nor what it would do
 * to the round already running was anywhere on the screen. Both are now dialogs
 * that say what the save will do before it is pressed.
 *
 * These are server renders, so they cover what the dialog states rather than
 * what typing into it does; the rules the fields are judged by are unit-tested
 * in `src/lib/__tests__/setup-draft.test.ts`.
 */

const LATIN_OUTSIDE_MARKUP = /(?<=>)[^<>]*[A-Za-z][^<>]*(?=<)/u;

const ORGANIZATION = {
  id: "org-1",
  name: "בית ספר הדס",
  city: "חיפה",
  schoolType: "יסודי",
  totalStaffCount: 40,
};

function renderNewRound(props: Partial<Parameters<typeof NewRoundDialog>[0]> = {}) {
  return renderToStaticMarkup(
    <NewRoundDialog
      isOpen
      onClose={() => {}}
      onCreated={() => {}}
      organization={ORGANIZATION}
      previousRound={null}
      {...props}
    />,
  );
}

test("a closed dialog renders nothing at all", () => {
  assert.strictEqual(renderNewRound({ isOpen: false }), "");
  assert.strictEqual(
    renderToStaticMarkup(<NewSchoolDialog isOpen={false} onClose={() => {}} onCreated={() => {}} />),
    "",
  );
});

test("the new-round dialog says what the save does to the round already running", () => {
  const markup = renderNewRound();

  // The three facts a manager could not read anywhere before pressing save.
  assert.match(markup, /כטיוטה/u);
  assert.match(markup, /לכל סבב יש שאלון אחד בלבד/u);
  assert.match(markup, /הסבב הנוכחי ימשיך לאסוף/u);
  // And which school it is about, because a manager with several is one
  // switcher away from the wrong one.
  assert.match(markup, /בית ספר הדס/u);
});

test("the new-round dialog is a dialog, announced as one", () => {
  const markup = renderNewRound();

  assert.match(markup, /role="dialog"/u);
  assert.match(markup, /aria-modal="true"/u);
  assert.match(markup, /aria-labelledby="[^"]+"/u);
  assert.match(markup, /aria-describedby="[^"]+"/u);
});

test("the new-round dialog asks only for what differs between two rounds", () => {
  const markup = renderNewRound();

  assert.match(markup, /תקופת המדידה/u);
  assert.match(markup, /תאריך פתיחה/u);
  assert.match(markup, /סף פרטיות/u);
  // Not the twenty background numbers the setup screen collects — and it says
  // where they went rather than leaving the manager to wonder.
  assert.doesNotMatch(markup, /מספר כיתות בכל שכבה/u);
  assert.match(markup, /נשמרים כפי שהם/u);
});

test("a school too small for the threshold is refused before the round is opened", () => {
  // The rule is the API's, and it is stated on the field that can fix it here:
  // the school is not editable in this dialog, so the threshold is.
  const markup = renderNewRound({
    organization: { ...ORGANIZATION, totalStaffCount: 6 },
  });

  assert.match(markup, /לא ניתן להגיע לסף הפרטיות/u);
  assert.match(markup, /aria-invalid="true"/u);
});

test("a school large enough is not warned about", () => {
  assert.doesNotMatch(renderNewRound(), /לא ניתן להגיע לסף הפרטיות/u);
});

test("the new-school dialog opens a school together with its first round", () => {
  const markup = renderToStaticMarkup(
    <NewSchoolDialog isOpen onClose={() => {}} onCreated={() => {}} />,
  );

  assert.match(markup, /הוספת בית ספר/u);
  assert.match(markup, /פרטי בית הספר/u);
  assert.match(markup, /סבב האבחון הראשון/u);
  assert.match(markup, /בית ספר נפתח יחד עם סבב האבחון הראשון שלו/u);
});

test("nothing is refused before the manager has asked to save", () => {
  // Every field of a new school starts empty. A dialog that opens already red
  // reads as a rejection of work that has not been done yet.
  const markup = renderToStaticMarkup(
    <NewSchoolDialog isOpen onClose={() => {}} onCreated={() => {}} />,
  );

  assert.doesNotMatch(markup, /כדי לפתוח את בית הספר/u);
  assert.doesNotMatch(markup, /aria-invalid="true"/u);
});

test("a destructive confirmation names the action on the button that performs it", () => {
  const markup = renderToStaticMarkup(
    <ConfirmDialog
      isOpen
      title="איפוס נתוני הסבב"
      body="כל התשובות יימחקו."
      confirmLabel="מחיקת התשובות ואיפוס"
      isDestructive
      onConfirm={() => {}}
      onCancel={() => {}}
    />,
  );

  assert.match(markup, /מחיקת התשובות ואיפוס/u);
  // Never colour alone: the irreversibility is a sentence.
  assert.match(markup, /הפעולה אינה הפיכה/u);
  assert.match(markup, /role="dialog"/u);
  // `window.confirm` could only say OK and Cancel, in the browser's language.
  assert.doesNotMatch(markup, LATIN_OUTSIDE_MARKUP);
});

test("an ordinary confirmation does not claim to be irreversible", () => {
  const markup = renderToStaticMarkup(
    <ConfirmDialog
      isOpen
      title="שאלה"
      body="גוף"
      confirmLabel="אישור"
      onConfirm={() => {}}
      onCancel={() => {}}
    />,
  );

  assert.doesNotMatch(markup, /הפעולה אינה הפיכה/u);
});
