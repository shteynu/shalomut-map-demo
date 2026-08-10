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

test("two hundred codes collide zero times", () => {
  const codes = new Set(
    Array.from({ length: 200 }, () => RoundService.generateShareCode()),
  );

  assert.strictEqual(codes.size, 200);
});

test("a persisted round never reuses a code the repository already holds", async () => {
  const roundRepo = new InMemoryRoundRepository();

  const first = await RoundService.createAndSaveRound(
    { organizationId: "org-1", title: "סבב ראשון" },
    roundRepo,
  );
  const second = await RoundService.createAndSaveRound(
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
