import assert from 'node:assert';
import test from 'node:test';
import { findFixtureImports } from './check-runtime-fixtures.mjs';

const IMPORT_FIXTURE =
  "import { DEMO_ROUND } from '@/lib/repositories/__fixtures__/demo-records';";

test('a runtime module importing a fixture is a violation', () => {
  const errors = findFixtureImports(
    IMPORT_FIXTURE,
    'src/lib/services/round.service.ts',
  );

  assert.strictEqual(errors.length, 1);
  assert.match(errors[0], /test fixture/);
});

test('a page or route is a runtime module like any other', () => {
  for (const file of ['src/app/dashboard/page.tsx', 'src/app/api/rounds/route.ts']) {
    assert.strictEqual(findFixtureImports(IMPORT_FIXTURE, file).length, 1, file);
  }
});

test('tests and the fixtures themselves may import them', () => {
  for (const file of [
    'src/app/api/__tests__/api.test.ts',
    'src/lib/repositories/__dbtests__/postgres-one-active-round.test.ts',
    'src/lib/repositories/__fixtures__/demo-records.ts',
  ]) {
    assert.deepStrictEqual(findFixtureImports(IMPORT_FIXTURE, file), [], file);
  }
});

test('a dynamic import hides nothing', () => {
  const errors = findFixtureImports(
    "const { DEMO_ROUND } = await import('../repositories/__fixtures__/demo-records');",
    'src/lib/server/manager-context.ts',
  );

  assert.strictEqual(errors.length, 1);
});

test('an ordinary import is left alone', () => {
  assert.deepStrictEqual(
    findFixtureImports(
      "import { InMemoryRoundRepository } from '@/lib/repositories';",
      'src/lib/composition-root.ts',
    ),
    [],
  );
});
