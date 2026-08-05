import assert from 'node:assert';
import test from 'node:test';
import {
  callsAnyExport,
  exportedFunctionNames,
  findConfigViolations,
} from './check-mutation-config.mjs';

const EXPORTS = ['validateStoneMapResult', 'statusForScore'];

test('exported functions are found and unexported helpers are not', () => {
  const source = [
    'export function validateStoneMapResult(payload) {}',
    'export async function loadBands() {}',
    'function hasExactlyThreeHebrewParagraphs(value) {}',
    'export const SCORING_BANDS = loadScoringBands(manifest);',
    'export interface ScoreBand {}',
  ].join('\n');

  assert.deepStrictEqual(exportedFunctionNames(source), [
    'validateStoneMapResult',
    'loadBands',
  ]);
});

test('a test that calls a mutated export belongs in the list', () => {
  assert.ok(
    callsAnyExport('const result = validateStoneMapResult(payload, id);', EXPORTS),
  );
  assert.ok(callsAnyExport('assert.equal(statusForScore(75), "green");', EXPORTS));
});

test('importing a type or a constant is not calling it', () => {
  const source = [
    'import { AI_ANALYTICS_DIMENSION_IDS } from "../ai-contract";',
    'import type { StoneMapResult } from "../ai-contract";',
    'const ids = [...AI_ANALYTICS_DIMENSION_IDS];',
  ].join('\n');

  assert.strictEqual(callsAnyExport(source, EXPORTS), false);
});

test('a name that merely contains an export name does not count', () => {
  assert.strictEqual(
    callsAnyExport('const x = notStatusForScoreAtAll(75);', EXPORTS),
    false,
  );
});

test('a test file outside the list is the omission this check exists for', () => {
  const errors = findConfigViolations({
    listed: ['a.test.ts'],
    required: ['a.test.ts', 'b.test.ts'],
    existing: ['a.test.ts', 'b.test.ts'],
  });

  assert.strictEqual(errors.length, 1);
  assert.match(errors[0], /b\.test\.ts.*missing from tap\.testFiles/u);
  assert.match(errors[0], /reported as survivors/u);
});

test('a listed file that stopped calling anything is reported too', () => {
  const errors = findConfigViolations({
    listed: ['a.test.ts', 'stale.test.ts'],
    required: ['a.test.ts'],
    existing: ['a.test.ts', 'stale.test.ts'],
  });

  assert.strictEqual(errors.length, 1);
  assert.match(errors[0], /stale\.test\.ts.*no longer calls/u);
});

test('a listed file that was deleted is reported once, not twice', () => {
  const errors = findConfigViolations({
    listed: ['gone.test.ts'],
    required: [],
    existing: [],
  });

  assert.deepStrictEqual(errors, [
    'gone.test.ts is listed in tap.testFiles but does not exist.',
  ]);
});

test('a list that matches the repository passes', () => {
  assert.deepStrictEqual(
    findConfigViolations({
      listed: ['a.test.ts', 'b.test.ts'],
      required: ['a.test.ts', 'b.test.ts'],
      existing: ['a.test.ts', 'b.test.ts', 'unrelated.test.ts'],
    }),
    [],
  );
});
