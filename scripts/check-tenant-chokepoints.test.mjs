import assert from 'node:assert';
import test from 'node:test';
import {
  ROUND_CHOKEPOINT,
  SCREEN_CHOKEPOINT,
  findPageViolations,
  findRecordingViolations,
  findRoundRouteViolations,
} from './check-tenant-chokepoints.mjs';

const RESOLVE = 'const { orgRepo } = resolveCoreRepositories();';

test('a manager page reading persistence itself is a violation', () => {
  const errors = findPageViolations(RESOLVE, 'src/app/dashboard/page.tsx');
  assert.strictEqual(errors.length, 1);
  assert.match(errors[0], /loadManagerContext/);
});

test('a page entering through the chokepoint is not', () => {
  const errors = findPageViolations(
    'const context = await loadManagerContext();',
    'src/app/dashboard/page.tsx',
  );
  assert.deepStrictEqual(errors, []);
});

test('the pages about no single school may read persistence', () => {
  for (const page of [
    'src/app/answer/[shareCode]/page.tsx',
    'src/app/admin/page.tsx',
  ]) {
    assert.deepStrictEqual(findPageViolations(RESOLVE, page), [], page);
  }
});

test('a nested component beside a page is not a page', () => {
  assert.deepStrictEqual(
    findPageViolations(RESOLVE, 'src/app/dashboard/school-card.tsx'),
    [],
  );
});

test('a round route that does not authorize is a violation', () => {
  const errors = findRoundRouteViolations(
    'export async function GET() { return Response.json({}); }',
    'src/app/api/rounds/[roundId]/exports/route.ts',
  );
  assert.strictEqual(errors.length, 1);
  assert.match(errors[0], /authorizeManagerRound/);
});

test('a round route that authorizes is not', () => {
  assert.deepStrictEqual(
    findRoundRouteViolations(
      'const authorization = await authorizeManagerRound(request, roundId);',
      'src/app/api/rounds/[roundId]/route.ts',
    ),
    [],
  );
});

test('routes outside the round tree are somebody else’s rule', () => {
  for (const route of [
    'src/app/api/survey/[shareCode]/route.ts',
    'src/app/api/admin/schools/route.ts',
    'src/app/api/mcp/route.ts',
  ]) {
    assert.deepStrictEqual(findRoundRouteViolations('', route), [], route);
  }
});

test('a chokepoint that stopped recording is a violation', () => {
  const screens = findRecordingViolations(
    'return ManagerContextService.load(orgRepo);',
    SCREEN_CHOKEPOINT,
  );
  assert.strictEqual(screens.length, 1);
  assert.match(screens[0], /recordManagerScreenVisit/);

  const rounds = findRecordingViolations(
    'const round = await ManagerScopeService.findRound(roundId);',
    ROUND_CHOKEPOINT,
  );
  assert.strictEqual(rounds.length, 1);
  assert.match(rounds[0], /recordAdministratorSchoolVisit/);
});

test('a chokepoint that records is not', () => {
  assert.deepStrictEqual(
    findRecordingViolations(
      'const recorded = await recordManagerScreenVisit(auditLogRepo, request, context);',
      SCREEN_CHOKEPOINT,
    ),
    [],
  );
});

test('a test file is exempt from every rule', () => {
  assert.deepStrictEqual(
    findPageViolations(RESOLVE, 'src/app/__tests__/page.tsx'),
    [],
  );
  assert.deepStrictEqual(
    findRoundRouteViolations('', 'src/app/api/rounds/__tests__/route.ts'),
    [],
  );
});
