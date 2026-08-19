/**
 * What `/api/health` is allowed to say about the revision it runs.
 *
 * These assert the rule rather than the endpoint: the value reaches an
 * anonymous caller, so what matters is which inputs produce a published string
 * and which produce `unknown`. Going through the route instead would test the
 * same rule once, through an environment variable, with the interesting cases
 * hidden behind a JSON body.
 */
import assert from 'node:assert';
import test from 'node:test';

import {
  DEPLOYMENT_COMMIT_ENV,
  UNKNOWN_DEPLOYMENT_COMMIT,
  resolveDeploymentCommit,
} from '../deployment-commit';

const SHA = 'a3dd4fedf2a54deded3497456cbdbbb896009ee2';

function resolve(value: string | undefined): string {
  return resolveDeploymentCommit(
    value === undefined ? {} : { [DEPLOYMENT_COMMIT_ENV]: value },
  );
}

test('a real commit SHA is published, shortened the way git prints it', () => {
  assert.strictEqual(resolve(SHA), 'a3dd4fe');
  assert.strictEqual(resolve(SHA).length, 7);
});

test('an uppercase SHA is still a SHA, and is published in one case', () => {
  // Nothing sets it uppercase today. If something did, two deployments of the
  // same commit must not read as two different commits.
  assert.strictEqual(resolve(SHA.toUpperCase()), 'a3dd4fe');
});

test('surrounding whitespace does not make a commit unreadable', () => {
  assert.strictEqual(resolve(`  ${SHA}\n`), 'a3dd4fe');
});

test('a deployment that cannot name its commit says so instead of guessing', () => {
  // Running locally: the variable does not exist at all.
  assert.strictEqual(resolve(undefined), UNKNOWN_DEPLOYMENT_COMMIT);
  assert.strictEqual(resolve(''), UNKNOWN_DEPLOYMENT_COMMIT);
  assert.strictEqual(resolve('   '), UNKNOWN_DEPLOYMENT_COMMIT);
});

test('only a full forty-character SHA is published', () => {
  // A short SHA is a real thing to hold and still refused: publishing it would
  // mean the endpoint sometimes reports seven characters of a value it never
  // verified the length of.
  assert.strictEqual(resolve(SHA.slice(0, 7)), UNKNOWN_DEPLOYMENT_COMMIT);
  assert.strictEqual(resolve(SHA.slice(0, 39)), UNKNOWN_DEPLOYMENT_COMMIT);
  assert.strictEqual(resolve(`${SHA}0`), UNKNOWN_DEPLOYMENT_COMMIT);
});

test('a value that is not a commit is never published, not even in part', () => {
  // The rule that makes this field safe on an anonymous endpoint. A secret in
  // this variable would be a misconfiguration; the endpoint must not be what
  // turns it into a disclosure.
  const notCommits = [
    // `openssl rand -hex 32`, which is how this repository makes its secrets:
    // hex, and sixty-four characters rather than forty.
    'f'.repeat(64),
    'postgresql://shalomut:shalomut@127.0.0.1:5433/shalomut_test',
    'refs/heads/main',
    'v1.2.3',
    'unknown',
  ];

  for (const value of notCommits) {
    assert.strictEqual(
      resolve(value),
      UNKNOWN_DEPLOYMENT_COMMIT,
      `${value.slice(0, 24)} was published`,
    );
  }
});

test('the resolver reads process.env when given no environment', () => {
  const previous = process.env[DEPLOYMENT_COMMIT_ENV];
  process.env[DEPLOYMENT_COMMIT_ENV] = SHA;

  try {
    assert.strictEqual(resolveDeploymentCommit(), 'a3dd4fe');
  } finally {
    if (previous === undefined) {
      delete process.env[DEPLOYMENT_COMMIT_ENV];
    } else {
      process.env[DEPLOYMENT_COMMIT_ENV] = previous;
    }
  }
});
