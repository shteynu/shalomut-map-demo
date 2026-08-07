const config = {
  testRunner: 'tap',
  /**
   * The pilot's subject is the AI-contract validator. `scoring-bands.ts` is
   * here because one of the validator's own rules moved into it — `8e1906e`
   * took `statusForScore` out of `ai-contract.ts` so Core and Python could
   * read one manifest — and a refactor should not quietly remove a rule from
   * measurement. Every stone's score must agree with its status, and that
   * agreement is now decided here.
   *
   * This is not the widening `ROADMAP.md` holds behind the legacy-fixture
   * precondition. That one asks for a second subject; this one keeps the
   * first subject whole.
   */
  mutate: ['src/lib/ai-contract.ts', 'src/lib/scoring-bands.ts'],
  /**
   * Stryker copies the project into a sandbox before it runs anything, and
   * `ai-analytics-service/.venv` is not something it can copy. On Linux a
   * virtual environment contains `lib64`, a symlink to a directory, and the
   * copy fails with `EISDIR` before the first test runs. macOS venvs have no
   * `lib64`, so this failed only in CI — on the first run of the dry-run step
   * added to catch exactly this kind of thing.
   *
   * The Python service's own sources stay in the sandbox: they are small, and
   * the TypeScript tests that read the shared corpus should keep finding what
   * they expect next to them. Only the environment is excluded.
   */
  ignorePatterns: ['**/.venv'],
  tap: {
    /**
     * Every test file whose subject is a mutated file — that is, every one
     * that calls `validateStoneMapResult`, `isHebrewOnlyUserText`,
     * `statusForScore` or `loadScoringBands` directly. A file left out here
     * does not lower the score honestly, it reports mutants as survivors that
     * a real test would have killed.
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
      // The same negative half for the closed contracts `1.0`–`3.0`, whose
      // validators the payload corpus only ever entered from the accepting
      // side.
      'src/lib/__tests__/ai-contract-legacy-refusals.test.ts',
      // And for `5.0`: the distribution, the adaptation outcome and the
      // partial map, which had accepting tests only.
      'src/lib/__tests__/ai-contract-v5-refusals.test.ts',
      // A validator test does not have to live beside the validator. This one
      // walks a 3.0 payload through the staging dry run and asserts both the
      // accepted and the privacy-locked outcome, so it kills mutants no file
      // in `src/lib/__tests__` reaches.
      'src/lib/services/__tests__/contract-3-staging-dryrun.test.ts',
      // The bands' own tests: the manifest loader's refusals, which no
      // contract test reaches, and the band boundaries every stone is
      // validated against.
      'src/lib/__tests__/scoring-bands.test.ts',
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
