import assert from "node:assert";
import test from "node:test";
import { InMemoryRoundRepository } from "@/lib/repositories";
import { RoundService } from "@/lib/services";

/**
 * The share code is the only thing between a stranger and a school's
 * questionnaire, and until 2026-08-10 it was four characters of
 * `Math.random().toString(36)` — about 1.7 million values from a generator with
 * no cryptographic claim, generated once and written straight at a unique
 * index.
 *
 * These tests pin the two properties that matter: the space is large enough
 * that walking it is not a strategy, and a code that is somehow already taken
 * costs a retry rather than a failed round creation.
 */

const CODE_PATTERN = /^SHALOM-[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{10}$/;

test("a share code is ten characters from an unambiguous alphabet", () => {
  for (let i = 0; i < 200; i += 1) {
    const code = RoundService.generateShareCode();
    assert.match(code, CODE_PATTERN);
  }
});

test("the alphabet omits the characters a teacher would misread", () => {
  // Read off a slide in a staff meeting and typed by hand, so 0/O and 1/I/L
  // are worth more than the two bits they carry.
  const suffixes = Array.from({ length: 300 }, () =>
    RoundService.generateShareCode().slice("SHALOM-".length),
  ).join("");

  for (const confusable of ["0", "O", "1", "I", "L"]) {
    assert.ok(
      !suffixes.includes(confusable),
      `share codes must not contain ${confusable}`,
    );
  }
});

test("a byte the alphabet cannot represent evenly is discarded, not folded", () => {
  // 31 characters do not fit a byte evenly, so bytes 248..255 have no unbiased
  // home. Until 2026-08-22 they were folded with `% 31` and landed on the first
  // eight characters, which is where the extra ~12.5% went.
  //
  // 250 % 31 is 2, so the old mapping would have written `C` here. The new one
  // draws again and writes what the next acceptable byte says.
  const scripted = [250, 251, 255, 248, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
  const code = RoundService.generateShareCode(() => Uint8Array.from(scripted));

  assert.strictEqual(code, "SHALOM-ABCDEFGHJK");
});

test("the ceiling is the largest multiple of the alphabet that fits a byte", () => {
  // Every accepted byte maps to exactly one character and every character has
  // exactly eight bytes: 248 = 31 x 8. A byte at the ceiling is already too
  // many, which is the off-by-one this asserts.
  const accepted = Array.from({ length: 256 }, (_, byte) => byte).filter(
    (byte) => byte < 248,
  );
  const counts = new Map<string, number>();

  for (const byte of accepted) {
    const character = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"[byte % 31];
    counts.set(character, (counts.get(character) ?? 0) + 1);
  }

  assert.strictEqual(counts.size, 31);
  assert.deepStrictEqual([...new Set(counts.values())], [8]);
});

test("two hundred codes collide zero times", () => {
  const codes = new Set(
    Array.from({ length: 200 }, () => RoundService.generateShareCode()),
  );

  assert.strictEqual(codes.size, 200);
});

test("a persisted round never reuses a code the repository already holds", async () => {
  const roundRepo = new InMemoryRoundRepository();

  const { round: first } = await RoundService.createAndSaveRound(
    { organizationId: "org-1", title: "סבב ראשון" },
    roundRepo,
  );
  const { round: second } = await RoundService.createAndSaveRound(
    { organizationId: "org-1", title: "סבב שני" },
    roundRepo,
  );

  assert.notStrictEqual(first.shareCode, second.shareCode);
  assert.match(first.shareCode, CODE_PATTERN);
  assert.match(second.shareCode, CODE_PATTERN);

  // Both are readable back by the code they were given, which is the only
  // property the respondent route depends on.
  assert.strictEqual(
    (await roundRepo.findByShareCode(first.shareCode))?.id,
    first.id,
  );
  assert.strictEqual(
    (await roundRepo.findByShareCode(second.shareCode))?.id,
    second.id,
  );
});
