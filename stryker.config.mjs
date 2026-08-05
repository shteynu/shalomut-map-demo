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
     *
     * The list drifts by omission, not by error, so it is re-derived rather
     * than trusted: `grep -rl 'validateStoneMapResult\|isHebrewOnlyUserText'`
     * over `src` names every file that belongs here. Two had accumulated by
     * 2026-08-05.
     */
    testFiles: [
      'src/lib/__tests__/ai-contract.test.ts',
      'src/lib/__tests__/ai-contract-semantic-quality.test.ts',
      'src/lib/__tests__/ai-contract-v4.test.ts',
      'src/lib/__tests__/ai-contract-v5.test.ts',
      'src/lib/__tests__/ai-contract-v5-smoke.test.ts',
      'src/lib/__tests__/ai-contract-v6.test.ts',
      'src/lib/__tests__/hebrew-only-corpus.test.ts',
      'src/lib/__tests__/callback-corpus-parity.test.ts',
      'src/lib/__tests__/ai-contract-payload-refusals.test.ts',
      // A validator test does not have to live beside the validator. This one
      // walks a 3.0 payload through the staging dry run and asserts both the
      // accepted and the privacy-locked outcome, so it kills mutants no file
      // in `src/lib/__tests__` reaches.
      'src/lib/services/__tests__/contract-3-staging-dryrun.test.ts',
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
