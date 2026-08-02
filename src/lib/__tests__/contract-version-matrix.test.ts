import assert from 'node:assert/strict';
import test from 'node:test';

import capabilitiesManifest from '../../../contracts/capabilities.json';
import { AI_ANALYTICS_SUPPORTED_CONTRACT_VERSIONS } from '../ai-contract';
import {
  DEFAULT_PRODUCED_ANALYTICS_CONTRACT_VERSION,
  PRODUCIBLE_ANALYTICS_CONTRACT_VERSIONS,
} from '../ai-contract-version';

test('shared capabilities, Core support and producer choices stay aligned', () => {
  const manifestVersions = Object.keys(capabilitiesManifest.versions);

  assert.deepStrictEqual(
    manifestVersions,
    [...AI_ANALYTICS_SUPPORTED_CONTRACT_VERSIONS],
  );
  assert.deepStrictEqual(
    PRODUCIBLE_ANALYTICS_CONTRACT_VERSIONS,
    manifestVersions.filter((version) => !['1.0', '2.0'].includes(version)),
  );
  assert.strictEqual(
    DEFAULT_PRODUCED_ANALYTICS_CONTRACT_VERSION,
    PRODUCIBLE_ANALYTICS_CONTRACT_VERSIONS.at(-1),
  );
});

test('6.0 stays reserved until a production manifest publishes it', () => {
  assert.strictEqual('6.0' in capabilitiesManifest.versions, false);
  assert.strictEqual(
    AI_ANALYTICS_SUPPORTED_CONTRACT_VERSIONS.includes('6.0'),
    false,
  );
  assert.strictEqual(
    (PRODUCIBLE_ANALYTICS_CONTRACT_VERSIONS as readonly string[]).includes(
      '6.0',
    ),
    false,
  );
});
