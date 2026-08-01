import assert from 'node:assert';
import test from 'node:test';
import goldenCorpus from '../../../contracts/fixtures/golden_corpus.json';
import capabilitiesManifest from '../../../contracts/capabilities.json';
import { loadContractRegistry } from '../contract-registry';
import { validateRoundAnalyticsPayload } from '../round-analytics-payload';

test('TypeScript and Python share every round analytics golden-corpus case', () => {
  for (const [version, cases] of Object.entries(goldenCorpus)) {
    for (const payload of cases.positive) {
      const validation = validateRoundAnalyticsPayload(payload);
      assert.strictEqual(
        validation.ok,
        true,
        `${version} positive payload should pass: ${validation.ok ? '' : validation.error}`,
      );
    }
    for (const payload of cases.negative) {
      const validation = validateRoundAnalyticsPayload(payload);
      assert.strictEqual(
        validation.ok,
        false,
        `${version} negative payload should fail`,
      );
    }
  }
});

test('dummy 6.0 is validated by an injected registry, not shipped as supported', () => {
  assert.strictEqual('6.0' in capabilitiesManifest.versions, false);

  const registry = loadContractRegistry({
    versions: {
      ...capabilitiesManifest.versions,
      '6.0': {
        ...capabilitiesManifest.versions['5.0'],
        supportsBackgroundContext: false,
      },
    },
  });

  assert.strictEqual(registry['6.0'].supportsDynamicQuestions, true);
  assert.strictEqual(registry['6.0'].supportsBackgroundContext, false);
});
