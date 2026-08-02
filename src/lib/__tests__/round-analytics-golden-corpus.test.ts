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

test('published 6.0 capabilities describe the new narrative output', () => {
  assert.strictEqual('6.0' in capabilitiesManifest.versions, true);

  const registry = loadContractRegistry({
    versions: {
      ...capabilitiesManifest.versions,
      '6.0': capabilitiesManifest.versions['6.0'],
    },
  });

  assert.strictEqual(registry['6.0'].supportsDynamicQuestions, true);
  assert.strictEqual(registry['6.0'].usesStructuredDimensionSummary, true);
  assert.strictEqual(registry['6.0'].usesNarrativeMetrics, true);
});
