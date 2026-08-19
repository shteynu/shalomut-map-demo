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
import {
  DEPLOYMENT_COMMIT_ENV,
  UNKNOWN_DEPLOYMENT_COMMIT,
} from '../../../lib/deployment-commit';

async function callHealth(
  configuredVersion: string | undefined,
  commitSha?: string,
) {
  const previous = process.env[PRODUCER_CONTRACT_VERSION_ENV];
  const previousCommit = process.env[DEPLOYMENT_COMMIT_ENV];

  if (configuredVersion === undefined) {
    delete process.env[PRODUCER_CONTRACT_VERSION_ENV];
  } else {
    process.env[PRODUCER_CONTRACT_VERSION_ENV] = configuredVersion;
  }

  if (commitSha === undefined) {
    delete process.env[DEPLOYMENT_COMMIT_ENV];
  } else {
    process.env[DEPLOYMENT_COMMIT_ENV] = commitSha;
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

    if (previousCommit === undefined) {
      delete process.env[DEPLOYMENT_COMMIT_ENV];
    } else {
      process.env[DEPLOYMENT_COMMIT_ENV] = previousCommit;
    }
  }
}

const SHA = 'a3dd4fedf2a54deded3497456cbdbbb896009ee2';

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
  // The commit variable is loaded with something secret-shaped on purpose: it
  // is the one variable whose value may reach this response, so it is the one
  // that has to be proven not to when it holds anything but a commit.
  const secretShaped = 'f'.repeat(64);
  const { body } = await callHealth('totally-not-a-version', secretShaped);
  const serialized = JSON.stringify(body);

  assert.doesNotMatch(serialized, /totally-not-a-version/);
  assert.doesNotMatch(serialized, new RegExp(secretShaped));
  assert.strictEqual(body.commit, UNKNOWN_DEPLOYMENT_COMMIT);
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

test('the deployment reports which commit it runs', async () => {
  const { response, body } = await callHealth('6.0', SHA);

  assert.strictEqual(response.status, 200);
  assert.strictEqual(body.commit, 'a3dd4fe');
});

test('a deployment with no commit variable says unknown rather than omitting it', async () => {
  // A missing key and an unknown commit read the same to a caller checking
  // `body.commit`, and only one of them is what actually happened.
  const { body } = await callHealth('6.0', undefined);

  assert.strictEqual(body.commit, UNKNOWN_DEPLOYMENT_COMMIT);
  assert.ok('commit' in body);
});

test('a misconfigured deployment still names its commit', async () => {
  // The case where it matters most: the answer to "which revision broke it"
  // must not depend on the deployment being healthy enough to answer.
  const { response, body } = await callHealth('7.0', SHA);

  assert.strictEqual(response.status, 503);
  assert.strictEqual(body.status, 'misconfigured');
  assert.strictEqual(body.commit, 'a3dd4fe');
});
