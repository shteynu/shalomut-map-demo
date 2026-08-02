import assert from 'node:assert';
import test from 'node:test';
import { findVersionBranching, isAllowedFile } from './check-version-literals.mjs';

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

test('fitness gate catches a version stamped into a payload, not only compared', () => {
  // The exact shape the analytics calculator used to carry while it sat on the
  // allowlist.
  assert.strictEqual(findVersionBranching("contractVersion: '2.0',").length, 1);
});

test('fitness gate exempts the contract package and tests, and nothing else', () => {
  assert.strictEqual(isAllowedFile('src/lib/ai-contract.ts'), true);
  assert.strictEqual(isAllowedFile('src/lib/ai-contract-version.ts'), true);
  assert.strictEqual(isAllowedFile('src/lib/contract-registry.ts'), true);
  assert.strictEqual(isAllowedFile('src/lib/types/backend.ts'), true);
  assert.strictEqual(isAllowedFile('src/lib/__tests__/ai-contract.test.ts'), true);

  // A domain service is where a version literal does the most damage, so it is
  // the last place that should be exempt from the check.
  assert.strictEqual(
    isAllowedFile('src/lib/services/analytics.service.ts'),
    false,
  );
  assert.strictEqual(isAllowedFile('src/app/api/mcp/route.ts'), false);
});

test('fitness gate ignores JSON-RPC 2.0', () => {
  assert.deepStrictEqual(
    findVersionBranching("if (jsonrpc !== '2.0') {}"),
    [],
  );
});
