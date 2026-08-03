const config = {
  testRunner: 'tap',
  mutate: ['src/lib/ai-contract.ts'],
  tap: {
    /**
     * Every test file whose subject is the mutated validator — that is, every
     * one that calls `validateStoneMapResult` or `isHebrewOnlyUserText`
     * directly. A file left out here does not lower the score honestly, it
     * reports mutants as survivors that a real test would have killed.
     *
     * The corpus files were missing until 2026-08-03, which made the Hebrew-only
     * rule look untested: six mutants that delete or invert it survived while
     * `hebrew-only-corpus.test.ts` — written for exactly that regression — sat
     * outside the run.
     */
    testFiles: [
      'src/lib/__tests__/ai-contract.test.ts',
      'src/lib/__tests__/ai-contract-semantic-quality.test.ts',
      'src/lib/__tests__/ai-contract-v4.test.ts',
      'src/lib/__tests__/ai-contract-v5.test.ts',
      'src/lib/__tests__/ai-contract-v6.test.ts',
      'src/lib/__tests__/hebrew-only-corpus.test.ts',
      'src/lib/__tests__/callback-corpus-parity.test.ts',
      'src/lib/__tests__/ai-contract-payload-refusals.test.ts',
    ],
    nodeArgs: ['--import', 'tsx'],
    forceBail: true,
  },
  reporters: ['progress', 'clear-text', 'html', 'json'],
  clearTextReporter: {
    reportMutants: false,
    reportTests: false,
  },
  thresholds: {
    high: 80,
    low: 60,
    break: null,
  },
};

export default config;
