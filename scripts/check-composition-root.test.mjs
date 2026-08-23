import assert from 'node:assert';
import test from 'node:test';
import {
  COMPOSITION_ROOT,
  findBoundaryViolations,
  isEntrypoint,
} from './check-composition-root.mjs';

const RESOLVE = 'const repositories = resolveCoreRepositories();';

test('a service reaching for the wiring is a violation', () => {
  const errors = findBoundaryViolations(RESOLVE, 'src/lib/services/round.service.ts');
  assert.strictEqual(errors.length, 1);
  assert.match(errors[0], /Only an entrypoint/);
});

test('a transaction is a resolution, and the same rule applies to it', () => {
  // `runInTransaction` hands `work` a full repository set. A service allowed to
  // call it would be resolving its own dependencies through the back door, and
  // the message has to name the call the author actually wrote.
  const inTransaction = 'return runInTransaction(async (repositories) => {';

  const errors = findBoundaryViolations(
    inTransaction,
    'src/lib/services/round.service.ts',
  );
  assert.strictEqual(errors.length, 1);
  assert.match(errors[0], /Only an entrypoint may call runInTransaction\(\)/);

  assert.deepStrictEqual(
    findBoundaryViolations(
      inTransaction,
      'src/app/api/rounds/[roundId]/reset/route.ts',
    ),
    [],
  );
});

test('route handlers, pages and the server-component loader may resolve', () => {
  for (const file of [
    'src/app/api/rounds/route.ts',
    'src/app/answer/[shareCode]/page.tsx',
    'src/lib/server/manager-context.ts',
  ]) {
    assert.ok(isEntrypoint(file), file);
    assert.deepStrictEqual(findBoundaryViolations(RESOLVE, file), []);
  }
});

test('a nested helper next to a route is not an entrypoint', () => {
  assert.strictEqual(isEntrypoint('src/app/api/rounds/helpers.ts'), false);
  assert.strictEqual(
    findBoundaryViolations(RESOLVE, 'src/app/api/rounds/helpers.ts').length,
    1,
  );
});

test('constructing a repository outside the composition root is a violation', () => {
  const durable = findBoundaryViolations(
    'const roundRepo = new PrismaRoundRepository(prisma);',
    'src/lib/server/ai-insights-service.ts',
  );
  assert.strictEqual(durable.length, 1);
  assert.match(durable[0], new RegExp(COMPOSITION_ROOT.replace(/\//g, '\\/')));

  // The local adapters are wiring too: seeding them elsewhere is how an empty
  // database used to be able to look populated.
  assert.strictEqual(
    findBoundaryViolations(
      'const roundRepo = new InMemoryRoundRepository([DEMO_ROUND]);',
      'src/app/api/rounds/route.ts',
    ).length,
    1,
  );
});

test('the composition root and tests are exempt', () => {
  const wiring = `${RESOLVE}\nnew PrismaRoundRepository(prisma);`;
  assert.deepStrictEqual(findBoundaryViolations(wiring, COMPOSITION_ROOT), []);
  assert.deepStrictEqual(
    findBoundaryViolations(wiring, 'src/app/api/__tests__/api.test.ts'),
    [],
  );
  assert.deepStrictEqual(
    findBoundaryViolations(wiring, 'src/lib/__tests__/composition-root.test.ts'),
    [],
  );
});
