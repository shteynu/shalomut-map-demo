/**
 * The producer version must be chosen, not guessed.
 *
 * A typo used to fall through to the oldest producible contract. A deployment
 * meant to emit `5.0` would emit `3.0` instead — losing the school context and
 * the score distributions — and report nothing at all.
 */
import assert from 'node:assert';
import test from 'node:test';

import {
  DEFAULT_PRODUCED_ANALYTICS_CONTRACT_VERSION,
  PRODUCER_CONTRACT_VERSION_ENV,
  PRODUCIBLE_ANALYTICS_CONTRACT_VERSIONS,
  UnsupportedProducerContractVersionError,
  getProducedAnalyticsContractVersion,
  resolveProducedAnalyticsContractVersion,
} from '../ai-contract-version';

test('an unset variable keeps the documented default', () => {
  assert.strictEqual(DEFAULT_PRODUCED_ANALYTICS_CONTRACT_VERSION, '5.0');
  const resolved = resolveProducedAnalyticsContractVersion(undefined);

  assert.ok(resolved.ok);
  assert.strictEqual(
    resolved.version,
    DEFAULT_PRODUCED_ANALYTICS_CONTRACT_VERSION,
  );
  assert.strictEqual(resolved.source, 'default');
});

test('an empty or blank variable is the same as unset', () => {
  for (const value of ['', '   ']) {
    const resolved = resolveProducedAnalyticsContractVersion(value);
    assert.ok(resolved.ok, `'${value}' should resolve`);
    assert.strictEqual(resolved.source, 'default');
  }
});

test('every producible version resolves to itself', () => {
  for (const version of PRODUCIBLE_ANALYTICS_CONTRACT_VERSIONS) {
    const resolved = resolveProducedAnalyticsContractVersion(version);
    assert.ok(resolved.ok, `${version} should resolve`);
    assert.strictEqual(resolved.version, version);
    assert.strictEqual(resolved.source, 'configured');
  }

  // Surrounding whitespace is a configuration slip, not a different version.
  const padded = resolveProducedAnalyticsContractVersion(' 5.0 ');
  assert.ok(padded.ok);
  assert.strictEqual(padded.version, '5.0');
});

test('an unknown version does not silently become the default', () => {
  for (const value of ['7.0', '5', 'five', '5.0.0', '4,0']) {
    const resolved = resolveProducedAnalyticsContractVersion(value);
    assert.ok(!resolved.ok, `'${value}' must not resolve`);
  }
});

test('a version Core cannot produce is refused even though it is supported', () => {
  // These versions are accepted on a callback, so a permissive check
  // would wave them through here and leave the calculator unable to emit them.
  for (const value of ['1.0', '2.0', '6.0']) {
    const resolved = resolveProducedAnalyticsContractVersion(value);
    assert.ok(!resolved.ok, `'${value}' is readable but not producible`);
  }
});

test('the refusal names the variable and the way out, not the value', () => {
  const resolved = resolveProducedAnalyticsContractVersion('sk-secret-typo');

  assert.ok(!resolved.ok);
  assert.match(resolved.error, new RegExp(PRODUCER_CONTRACT_VERSION_ENV));
  for (const version of PRODUCIBLE_ANALYTICS_CONTRACT_VERSIONS) {
    assert.ok(
      resolved.error.includes(version),
      `the error should offer ${version}`,
    );
  }
  // This message reaches a public endpoint; whatever the variable holds does
  // not travel with it.
  assert.doesNotMatch(resolved.error, /sk-secret-typo/);
});

test('the getter throws on an unknown version instead of returning one', () => {
  assert.throws(
    () =>
      getProducedAnalyticsContractVersion({
        [PRODUCER_CONTRACT_VERSION_ENV]: '6.0',
      }),
    (error: unknown) => {
      assert.ok(error instanceof UnsupportedProducerContractVersionError);
      // The thrown error stays in logs, so here the value is worth having.
      assert.match((error as Error).message, /6\.0/);
      return true;
    },
  );
});

test('the getter returns the configured version when it is producible', () => {
  const version = getProducedAnalyticsContractVersion({
    [PRODUCER_CONTRACT_VERSION_ENV]: '5.0',
  });

  assert.strictEqual(version, '5.0');
});

test('the getter falls back to the default only when nothing is configured', () => {
  const version = getProducedAnalyticsContractVersion({});

  assert.strictEqual(version, DEFAULT_PRODUCED_ANALYTICS_CONTRACT_VERSION);
});
