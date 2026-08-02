import assert from 'node:assert';
import test from 'node:test';
import callbackCorpus from '../../../contracts/fixtures/callback_corpus.json';
import { validateStoneMapResult } from '../ai-contract';

/**
 * The callback direction of the shared corpus.
 *
 * `golden_corpus.json` has always covered Core -> AI and never AI -> Core, and
 * the gap was not theoretical: the Hebrew-only rule drifted apart between the
 * two runtimes and no test went red, because no shared case ever asked Core to
 * judge a callback payload. `ai-analytics-service/tests/test_callback_corpus.py`
 * runs this same file; a case counts as shared only when both agree.
 */

interface Mutation {
  set?: Record<string, unknown>;
  delete?: string[];
}

/**
 * A refused case is one accepted payload plus what breaks it, so the fixture
 * says what a case is *about* instead of repeating forty kilobytes of valid
 * Hebrew around the one field that matters.
 */
function applyMutation(payload: unknown, mutation: Mutation): unknown {
  const next = JSON.parse(JSON.stringify(payload));

  function parentOf(path: string): [Record<string, unknown>, string] {
    const parts = path.split('.');
    let cursor = next;
    for (const part of parts.slice(0, -1)) cursor = cursor[part];
    return [cursor, parts[parts.length - 1]];
  }

  for (const path of mutation.delete ?? []) {
    const [parent, key] = parentOf(path);
    delete parent[key];
  }
  for (const [path, value] of Object.entries(mutation.set ?? {})) {
    const [parent, key] = parentOf(path);
    parent[key] = value;
  }
  return next;
}

const acceptedByVersion = new Map(
  callbackCorpus.accepted.map((item) => [item.contractVersion, item.payload]),
);

test('Core accepts every callback payload the corpus marks accepted', () => {
  for (const item of callbackCorpus.accepted) {
    const validation = validateStoneMapResult(
      item.payload,
      callbackCorpus.roundId,
    );
    assert.strictEqual(
      validation.ok,
      true,
      `${item.id}: ${validation.ok ? '' : validation.error}`,
    );
  }
});

test('Core refuses every callback payload the corpus marks refused', () => {
  for (const item of callbackCorpus.refused) {
    const source = acceptedByVersion.get(item.from);
    assert.notStrictEqual(source, undefined, `${item.id} names no known base`);

    const payload = applyMutation(source, item.mutation as Mutation);
    // A mutation that changed nothing would leave a valid payload behind and
    // turn this case into a test of the accepted one.
    assert.notDeepStrictEqual(payload, source, `${item.id} changed nothing`);

    const validation = validateStoneMapResult(payload, callbackCorpus.roundId);
    assert.strictEqual(
      validation.ok,
      false,
      `${item.id} should be refused for ${item.rule}, and Core accepted it`,
    );
  }
});

test('the corpus keeps both directions of the boundary covered', () => {
  // A corpus that quietly loses its callback half is the original defect, and
  // an empty array would make both tests above pass while proving nothing.
  const versions = new Set(
    callbackCorpus.accepted.map((item) => item.contractVersion),
  );
  const rules = new Set(callbackCorpus.refused.map((item) => item.rule));

  assert.strictEqual(versions.size >= 6, true);
  assert.strictEqual(callbackCorpus.refused.length >= 10, true);
  assert.strictEqual(rules.size >= 8, true);
});

test('every corpus case names a version Core still supports', () => {
  for (const item of callbackCorpus.accepted) {
    assert.strictEqual(
      item.payload.contractVersion,
      item.contractVersion,
      `${item.id} is filed under a version its payload does not declare`,
    );
  }
});
