/**
 * The counters' store, against a real PostgreSQL.
 *
 * The in-memory repository answers the same interface by iterating an array,
 * which proves the arithmetic and nothing about the query. Everything
 * interesting here is the query: a `GROUP BY name` that has to return both a
 * count and a sum of a nullable column, a window that has to use the
 * `(name, observed_at)` index, and a retention sweep that has to delete by
 * cutoff. None of those exist outside a database.
 *
 * Outside `__tests__` on purpose, like the other PostgreSQL suites: `npm test`
 * stays runnable without a database, and `npm run verify:db` supplies a
 * disposable one and applies the migrations first.
 */
import assert from 'node:assert';
import test, { after, before, beforeEach } from 'node:test';

import { PrismaOperationalEventRepository } from '..';
import { MinimalPrismaClient } from '../prisma/prisma-client';

const connectionString = process.env.TEST_DATABASE_URL;

if (!connectionString) {
  throw new Error(
    'TEST_DATABASE_URL is required for the PostgreSQL suite. ' +
      'Run it through `npm run verify:db`, which supplies one.',
  );
}

let pool: { end: () => Promise<void> };
let prisma: MinimalPrismaClient & { $disconnect?: () => Promise<void> };
let repo: PrismaOperationalEventRepository;

/**
 * The generated delegate, not the minimal one.
 *
 * `MinimalPrismaClient` declares the three operations the repository actually
 * uses, which is the point of it being minimal. Reading rows back and counting
 * them are things only a test does, so they are asked of the real client here
 * rather than added to a contract that production would then over-declare.
 */
const events = () =>
  prisma.operationalEvent as unknown as {
    create: (args: unknown) => Promise<unknown>;
    findMany: (args?: unknown) => Promise<Record<string, unknown>[]>;
    count: (args?: unknown) => Promise<number>;
    deleteMany: (args?: unknown) => Promise<{ count: number }>;
  };

const HOUR_MS = 60 * 60 * 1000;
const NOW = new Date('2026-08-23T12:00:00.000Z');
const hoursAgo = (hours: number) => new Date(NOW.getTime() - hours * HOUR_MS);

/** Places a row at a chosen moment, which is what every window case needs. */
async function recordAt(
  name: string,
  value: number | null,
  observedAt: Date,
): Promise<void> {
  await events().create({
    data: { kind: 'metric', name, value, unit: 'count', observedAt },
  });
}

before(async () => {
  const { PrismaClient } = require('@prisma/client');
  const { PrismaPg } = require('@prisma/adapter-pg');
  const { Pool } = require('pg');

  pool = new Pool({ connectionString });
  prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
  repo = new PrismaOperationalEventRepository(prisma);
});

after(async () => {
  await prisma.$disconnect?.();
  await pool.end();
});

beforeEach(async () => {
  await events().deleteMany({});
});

test('a metric and an error round-trip with the fields each family has', async () => {
  await repo.record({
    kind: 'metric',
    name: 'ai_jobs_queued',
    value: 1,
    unit: 'count',
    labels: { trigger: 'closure' },
    runId: 'run-1',
    roundId: 'round-1',
  });
  await repo.record({
    kind: 'request_error',
    name: 'Error',
    detail: { digest: '1734829384', path: '/dashboard' },
  });

  const rows = await events().findMany({ orderBy: { kind: 'asc' } });

  assert.strictEqual(rows.length, 2);
  const [metric, error] = rows;
  assert.strictEqual(metric.kind, 'metric');
  assert.strictEqual(metric.value, 1);
  assert.deepStrictEqual(metric.labels, { trigger: 'closure' });
  assert.strictEqual(metric.roundId, 'round-1');
  // The error carries no reading and no round, and its fields live in `detail`.
  assert.strictEqual(error.value, null);
  assert.strictEqual(error.roundId, null);
  assert.strictEqual((error.detail as { digest: string }).digest, '1734829384');
});

test('a round id that names no round is stored, not refused', async () => {
  // The point of having no foreign keys: an event about a round has to outlive
  // the round, and a write that could fail on a stale id would let
  // observability break what it observes.
  await repo.record({
    kind: 'metric',
    name: 'ai_jobs_failed',
    value: 1,
    unit: 'count',
    roundId: 'a-round-that-was-deleted',
  });

  assert.strictEqual(await events().count({}), 1);
});

test('the tally counts occurrences and sums values, per name, in one query', async () => {
  await recordAt('survey_submission_lost_after_retries', 1, hoursAgo(1));
  await recordAt('survey_submission_lost_after_retries', 1, hoursAgo(2));
  await recordAt('ai_deterministic_summary_ratio_sample', 0.5, hoursAgo(1));
  await recordAt('ai_deterministic_summary_ratio_sample', 1, hoursAgo(2));

  const tallies = await repo.tally(
    ['survey_submission_lost_after_retries', 'ai_deterministic_summary_ratio_sample'],
    hoursAgo(6),
  );

  assert.deepStrictEqual(tallies.get('survey_submission_lost_after_retries'), {
    name: 'survey_submission_lost_after_retries',
    count: 2,
    sum: 2,
  });
  // The mean the ratio threshold reads is this sum over this count: 0.75.
  assert.deepStrictEqual(tallies.get('ai_deterministic_summary_ratio_sample'), {
    name: 'ai_deterministic_summary_ratio_sample',
    count: 2,
    sum: 1.5,
  });
});

test('a name with nothing in the window is absent, not zero', async () => {
  // Seven hours ago against a six-hour window. Absent is what lets the reading
  // say "this did not happen" without inventing a row that says so.
  await recordAt('ai_contract_validation_failures', 1, hoursAgo(7));

  const tallies = await repo.tally(['ai_contract_validation_failures'], hoursAgo(6));

  assert.strictEqual(tallies.size, 0);
});

test('a null value sums as nothing rather than as an error', async () => {
  // Request errors carry no reading, and a name shared with them must still
  // count. `_sum` over a column of nulls is null in SQL, not zero.
  await recordAt('ai_jobs_queued', null, hoursAgo(1));
  await recordAt('ai_jobs_queued', null, hoursAgo(2));

  const tallies = await repo.tally(['ai_jobs_queued'], hoursAgo(6));

  assert.deepStrictEqual(tallies.get('ai_jobs_queued'), {
    name: 'ai_jobs_queued',
    count: 2,
    sum: 0,
  });
});

test('an empty name list asks the database nothing', async () => {
  await recordAt('ai_jobs_queued', 1, hoursAgo(1));

  assert.strictEqual((await repo.tally([], hoursAgo(6))).size, 0);
});

test('the sweep drops what is older than the cutoff and keeps the rest', async () => {
  await recordAt('ai_jobs_queued', 1, hoursAgo(24 * 31));
  await recordAt('ai_jobs_queued', 1, hoursAgo(24 * 40));
  await recordAt('ai_jobs_queued', 1, hoursAgo(1));

  const removed = await repo.prune(hoursAgo(24 * 30));

  assert.strictEqual(removed, 2);
  assert.strictEqual(await events().count({}), 1);
});

test('the window read uses the index rather than scanning the table', async () => {
  // The alert runs on a monitor's schedule forever, so the cost of it must not
  // grow with the table. Asked of the planner rather than reasoned about — and
  // asked of a table with enough rows for the question to be real: on an empty
  // one the planner picks a sequential scan whatever the indexes are, so an
  // assertion made there passes for the wrong reason and flips the moment
  // anything runs `ANALYZE`. This one was written after watching it do exactly
  // that.
  const raw = prisma as unknown as {
    $executeRawUnsafe: (sql: string) => Promise<number>;
    $queryRawUnsafe: (sql: string) => Promise<{ 'QUERY PLAN': string }[]>;
  };

  await raw.$executeRawUnsafe(
    `INSERT INTO operational_events (id, observed_at, kind, name, value, unit)
     SELECT gen_random_uuid(), now() - (g || ' minutes')::interval, 'metric',
            'name_' || (g % 40), 1, 'count'
     FROM generate_series(1, 20000) g`,
  );
  await raw.$executeRawUnsafe('ANALYZE operational_events');

  const rows = await raw.$queryRawUnsafe(
    `EXPLAIN SELECT name, count(*), sum(value) FROM operational_events
     WHERE name = 'name_7' AND observed_at >= now() - interval '6 hours'
     GROUP BY name`,
  );
  const plan = rows.map((row) => row['QUERY PLAN']).join('\n');

  /*
   * *An* index, not a named one. Which of the two wins depends on which
   * predicate is the selective one, and both answers are correct: with twenty
   * thousand rows spread over a fortnight a six-hour window is the narrow half
   * and `operational_events_observed_at_idx` wins, while on a table whose rows
   * mostly sit inside the window the name is the narrow half and the composite
   * does. What must never happen is the third answer.
   *
   * The shape, not a cost: a cost is a number that moves.
   */
  assert.ok(/Index Scan/.test(plan), `expected an index scan, planner said:\n${plan}`);
  assert.ok(
    !/Seq Scan/.test(plan),
    `the alert must not scan the table, planner said:\n${plan}`,
  );
});
