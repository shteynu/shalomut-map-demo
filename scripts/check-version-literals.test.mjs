import assert from 'node:assert';
import test from 'node:test';
import { findVersionBranching } from './check-version-literals.mjs';

test('fitness gate catches legacy 1.0 and 2.0 contract branches', () => {
  assert.strictEqual(
    findVersionBranching("if (version === '1.0') {}" ).length,
    1,
  );
  assert.strictEqual(
    findVersionBranching("if (payload.contractVersion === '2.0') {}" ).length,
    1,
  );
});

test('fitness gate catches branching through a version constant', () => {
  assert.strictEqual(
    findVersionBranching(
      'if (payload.contractVersion === AI_ANALYTICS_V5_CONTRACT_VERSION) {}',
    ).length,
    1,
  );
  assert.strictEqual(
    findVersionBranching(`if (payload.contractVersion ===
      AI_ANALYTICS_V5_CONTRACT_VERSION) {}` ).length,
    1,
  );
  assert.strictEqual(
    findVersionBranching(`[
      AI_ANALYTICS_V4_CONTRACT_VERSION,
      AI_ANALYTICS_V5_CONTRACT_VERSION,
    ].includes(payload.contractVersion)` ).length,
    1,
  );
});

test('fitness gate ignores JSON-RPC 2.0', () => {
  assert.deepStrictEqual(
    findVersionBranching("if (jsonrpc !== '2.0') {}"),
    [],
  );
});
