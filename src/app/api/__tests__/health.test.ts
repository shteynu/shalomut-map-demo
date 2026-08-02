/**
 * `/api/health` answers "which contract is actually live?" in one request.
 *
 * It must keep answering when the producer version is misconfigured — that is
 * the case worth reporting, and an endpoint that crashes alongside the failure
 * it exists to describe is no use to whoever has to fix it.
 */
import assert from 'node:assert';
import test from 'node:test';

import { GET as healthHandler } from '../health/route';
import { AI_ANALYTICS_SUPPORTED_CONTRACT_VERSIONS } from '../../../lib/ai-contract';
import {
  DEFAULT_PRODUCED_ANALYTICS_CONTRACT_VERSION,
  PRODUCER_CONTRACT_VERSION_ENV,
  PRODUCIBLE_ANALYTICS_CONTRACT_VERSIONS,
} from '../../../lib/ai-contract-version';

async function callHealth(configuredVersion: string | undefined) {
  const previous = process.env[PRODUCER_CONTRACT_VERSION_ENV];

  if (configuredVersion === undefined) {
    delete process.env[PRODUCER_CONTRACT_VERSION_ENV];
  } else {
    process.env[PRODUCER_CONTRACT_VERSION_ENV] = configuredVersion;
  }

  try {
    const response = await healthHandler();
    return { response, body: await response.json() };
  } finally {
    if (previous === undefined) {
      delete process.env[PRODUCER_CONTRACT_VERSION_ENV];
    } else {
      process.env[PRODUCER_CONTRACT_VERSION_ENV] = previous;
    }
  }
}

test('a configured version is reported as configured', async () => {
  const { response, body } = await callHealth('6.0');

  assert.strictEqual(response.status, 200);
  assert.strictEqual(body.status, 'ok');
  assert.strictEqual(body.analytics.producedContractVersion, '6.0');
  assert.strictEqual(body.analytics.producedContractVersionSource, 'configured');
});

test('an unset version is reported as the default, not as a choice', async () => {
  assert.strictEqual(DEFAULT_PRODUCED_ANALYTICS_CONTRACT_VERSION, '5.0');
  const { response, body } = await callHealth(undefined);

  assert.strictEqual(response.status, 200);
  assert.strictEqual(
    body.analytics.producedContractVersion,
    DEFAULT_PRODUCED_ANALYTICS_CONTRACT_VERSION,
  );
  assert.strictEqual(body.analytics.producedContractVersionSource, 'default');
});

test('produced and supported versions are reported separately', async () => {
  // Core still reads historical contracts it no longer emits; collapsing the
  // two lists would publish an incomplete answer to either question.
  const { body } = await callHealth('5.0');

  assert.deepStrictEqual(
    body.analytics.producibleContractVersions,
    [...PRODUCIBLE_ANALYTICS_CONTRACT_VERSIONS],
  );
  assert.deepStrictEqual(
    body.analytics.supportedContractVersions,
    [...AI_ANALYTICS_SUPPORTED_CONTRACT_VERSIONS],
  );
  assert.ok(
    body.analytics.supportedContractVersions.length >
      body.analytics.producibleContractVersions.length,
  );
});

test('a misconfigured version answers 503 and names the problem', async () => {
  const { response, body } = await callHealth('7.0');

  assert.strictEqual(response.status, 503);
  assert.strictEqual(body.status, 'misconfigured');
  assert.match(body.error, new RegExp(PRODUCER_CONTRACT_VERSION_ENV));
  assert.deepStrictEqual(
    body.analytics.producibleContractVersions,
    [...PRODUCIBLE_ANALYTICS_CONTRACT_VERSIONS],
  );
});

test('the response carries no configured value and no secret state', async () => {
  const { body } = await callHealth('totally-not-a-version');
  const serialized = JSON.stringify(body);

  assert.doesNotMatch(serialized, /totally-not-a-version/);
  // Whether a secret is set is itself worth knowing to an attacker.
  for (const forbidden of [
    'DATABASE_URL',
    'SESSION_SECRET',
    'AI_WEBHOOK_SECRET',
    'MANAGER_ADMIN_PASSWORD',
    'LLM_API_KEY',
  ]) {
    assert.doesNotMatch(serialized, new RegExp(forbidden, 'i'));
  }
});
