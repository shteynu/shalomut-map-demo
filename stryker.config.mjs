const config = {
  testRunner: 'tap',
  mutate: ['src/lib/ai-contract.ts'],
  tap: {
    testFiles: [
      'src/lib/__tests__/ai-contract.test.ts',
      'src/lib/__tests__/ai-contract-semantic-quality.test.ts',
      'src/lib/__tests__/ai-contract-v4.test.ts',
      'src/lib/__tests__/ai-contract-v5.test.ts',
      'src/lib/__tests__/ai-contract-v6.test.ts',
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
