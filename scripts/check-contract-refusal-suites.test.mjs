import assert from 'node:assert';
import test from 'node:test';
import {
  dispatchFlagsInSource,
  findUncoveredPaths,
  groupVersionsByPath,
  importedFixtures,
  stripComments,
  validationPathSignature,
  versionsMentionedIn,
} from './check-contract-refusal-suites.mjs';

const SEMANTIC_DYNAMIC = {
  isSemanticContract: true,
  supportsDynamicQuestions: true,
  supportsScoreDistribution: false,
  usesStructuredDimensionSummary: false,
};

test('only the flags the validator dispatches on shape a path', () => {
  const withBackgroundContext = {
    ...SEMANTIC_DYNAMIC,
    supportsBackgroundContext: true,
  };

  assert.strictEqual(
    validationPathSignature(SEMANTIC_DYNAMIC),
    validationPathSignature(withBackgroundContext),
    'a capability the stone validator never reads split the path in two',
  );
});

test('versions validated by the same code are one group', () => {
  const groups = groupVersionsByPath({
    '3.0': SEMANTIC_DYNAMIC,
    '4.0': { ...SEMANTIC_DYNAMIC, supportsBackgroundContext: true },
    '5.0': { ...SEMANTIC_DYNAMIC, supportsScoreDistribution: true },
  });

  assert.strictEqual(groups.length, 2);
  assert.deepStrictEqual(groups[0].versions, ['3.0', '4.0']);
  assert.deepStrictEqual(groups[1].versions, ['5.0']);
});

test('a version is recognised as a literal or as its exported constant', () => {
  const versions = ['1.0', '5.0', '6.0'];

  assert.deepStrictEqual(
    versionsMentionedIn("contractVersion: '5.0',", versions),
    ['5.0'],
  );
  assert.deepStrictEqual(
    versionsMentionedIn(
      'contractVersion: AI_ANALYTICS_V1_CONTRACT_VERSION,',
      versions,
    ),
    ['1.0'],
  );
  assert.deepStrictEqual(versionsMentionedIn('const x = 5;', versions), []);
});

test('a bare number in prose is not a version claim', () => {
  assert.deepStrictEqual(
    versionsMentionedIn('the score moved 60.00 to 69.34', ['6.0']),
    [],
  );
});

/**
 * The regression that made this check worth writing carefully: the first draft
 * read comments, so the 6.0 suite's header — which mentions 5.0 while
 * explaining its own history — covered 5.0 by accident, and deleting the 5.0
 * suite still passed.
 */
test('a version named only in a comment does not cover it', () => {
  const source = [
    '/**',
    ' * Written after the `1.0` and `5.0` suites landed.',
    ' */',
    "// see '3.0' for the dynamic path",
    "const payload = { contractVersion: '6.0' };",
  ].join('\n');

  assert.deepStrictEqual(versionsMentionedIn(source, ['1.0', '3.0', '5.0', '6.0']), [
    '6.0',
  ]);
});

test('stripping comments leaves the code that surrounds them', () => {
  assert.match(
    stripComments("const a = 1; // '5.0'\nconst b = '6.0';"),
    /const b = '6\.0';/u,
  );
});

test('the fixtures a suite imports are read with it', () => {
  const source = [
    "import { createValidV5Payload } from './fixtures/v5-payload';",
    "import { validateStoneMapResult } from '../ai-contract';",
  ].join('\n');

  assert.deepStrictEqual(
    importedFixtures(source, 'src/lib/__tests__/a-refusals.test.ts'),
    ['src/lib/__tests__/fixtures/v5-payload.ts'],
  );
});

test('an unguarded validation path is the omission this check exists for', () => {
  const errors = findUncoveredPaths({
    groups: [
      { signature: 'a', versions: ['1.0'] },
      { signature: 'b', versions: ['5.0'] },
    ],
    suites: [{ file: 'legacy-refusals.test.ts', versions: ['1.0'] }],
  });

  assert.strictEqual(errors.length, 1);
  assert.match(errors[0], /contract 5\.0/u);
  assert.match(errors[0], /breaks one rule per case/u);
});

test('one suite covers every version validated by the same code', () => {
  const errors = findUncoveredPaths({
    groups: [{ signature: 'a', versions: ['3.0', '4.0'] }],
    suites: [{ file: 'legacy-refusals.test.ts', versions: ['3.0'] }],
  });

  assert.deepStrictEqual(errors, []);
});

test('no refusal suite at all fails loudly rather than vacuously passing', () => {
  const errors = findUncoveredPaths({
    groups: [{ signature: 'a', versions: ['1.0'] }],
    suites: [],
  });

  assert.strictEqual(errors.length, 1);
  assert.match(errors[0], /No refusal suite was found/u);
});

test('the dispatch flags are read from the validator, not trusted', () => {
  const source = [
    'for (const dimensionId of AI_ANALYTICS_DIMENSION_IDS) {',
    '  const isValidStone = !caps.isSemanticContract',
    '    ? isValidLegacyStone(payload.stones[dimensionId], dimensionId)',
    '    : caps.usesStructuredDimensionSummary',
    '      ? isValidV6Stone(a, b, c)',
    '      : caps.supportsScoreDistribution',
    '        ? isValidV5Stone(a, b, c)',
    '        : isValidV2Stone(a, b);',
    '  if (!isValidStone) {',
  ].join('\n');

  assert.deepStrictEqual(dispatchFlagsInSource(source), [
    'isSemanticContract',
    'supportsScoreDistribution',
    'usesStructuredDimensionSummary',
  ]);
});

test('a validator whose selection block moved is a failure, not a pass', () => {
  assert.strictEqual(dispatchFlagsInSource('export function nothing() {}'), null);
});
