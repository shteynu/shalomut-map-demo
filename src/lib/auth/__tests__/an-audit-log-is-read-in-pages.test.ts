/**
 * The one read this table has, bounded before a screen exists.
 *
 * `audit_events` takes a row from every mutation of every school and nothing
 * prunes it, and its only reader used to be a `findMany` with no `take`, no
 * cursor and no time bound. Nothing renders that today, which is exactly why
 * the bound goes in now: the alternative is a screen written against an
 * unbounded call, shipped, and then discovered by whoever opens the log of the
 * busiest school two years from now.
 *
 * `postgres-audit-log-pages.test.ts` runs the same walk against PostgreSQL and
 * asserts the two stores hand back the same page, which is the half this suite
 * cannot answer.
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  auditLogPageSize,
  DEFAULT_AUDIT_LOG_PAGE_SIZE,
  InMemoryAuditLogRepository,
  MAXIMUM_AUDIT_LOG_PAGE_SIZE,
  type IAuditLogRepository,
} from '../domain-contract';
import type { AuditEvent } from '../types';

const ORGANIZATION = 'org-school-a';
const EPOCH = new Date('2026-08-01T00:00:00.000Z');

function event(index: number, overrides: Partial<AuditEvent> = {}): AuditEvent {
  return {
    id: `evt-${String(index).padStart(4, '0')}`,
    timestamp: new Date(EPOCH.getTime() + index * 1000),
    action: 'SETUP_SAVED',
    managerId: 'mgr-cohen',
    organizationId: ORGANIZATION,
    ...overrides,
  };
}

async function fill(
  repo: IAuditLogRepository,
  count: number,
): Promise<AuditEvent[]> {
  const written: AuditEvent[] = [];
  for (let index = 0; index < count; index += 1) {
    written.push(await repo.recordEvent(event(index)));
  }
  return written;
}

test('a page nobody sized is bounded anyway', async () => {
  const repo = new InMemoryAuditLogRepository();
  await fill(repo, DEFAULT_AUDIT_LOG_PAGE_SIZE + 10);

  const page = await repo.findByOrganizationId(ORGANIZATION);

  assert.equal(page.length, DEFAULT_AUDIT_LOG_PAGE_SIZE);
  assert.equal(
    page[0].id,
    `evt-${String(DEFAULT_AUDIT_LOG_PAGE_SIZE + 9).padStart(4, '0')}`,
    'and the page a caller gets by default is the newest one',
  );
});

test('a size nobody should get is clamped rather than obeyed', async () => {
  // The clamp lives in one function so the two stores cannot disagree about it,
  // and this is that function rather than either store.
  assert.equal(auditLogPageSize(undefined), DEFAULT_AUDIT_LOG_PAGE_SIZE);
  assert.equal(auditLogPageSize(10), 10);
  assert.equal(auditLogPageSize(10_000), MAXIMUM_AUDIT_LOG_PAGE_SIZE);
  for (const nonsense of [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.equal(
      auditLogPageSize(nonsense),
      DEFAULT_AUDIT_LOG_PAGE_SIZE,
      `a limit of ${nonsense} must fall back rather than return nothing`,
    );
  }
});

test('a cursor walks the whole log without skipping or repeating', async () => {
  const repo = new InMemoryAuditLogRepository();
  const written = await fill(repo, 25);

  const seen: string[] = [];
  let after: { timestamp: Date; id: string } | undefined;
  for (let page = 0; page < 10; page += 1) {
    const events = await repo.findByOrganizationId(ORGANIZATION, {
      limit: 7,
      after,
    });
    if (events.length === 0) break;
    seen.push(...events.map((entry) => entry.id));
    const last = events[events.length - 1];
    after = { timestamp: last.timestamp, id: last.id };
  }

  assert.deepEqual(
    seen,
    [...written].reverse().map((entry) => entry.id),
    'every event exactly once, newest first',
  );
});

test('two events written in the same millisecond are both on the walk', async () => {
  // The reason the cursor carries an id as well as a timestamp. A cursor of
  // `timestamp < last` steps over whatever shares that timestamp, and two
  // events share one whenever two administrators act at the same moment — the
  // busiest instant in the log is the one it would drop.
  const repo = new InMemoryAuditLogRepository();
  const sameMoment = new Date(EPOCH.getTime() + 5000);
  for (const id of ['evt-a', 'evt-b', 'evt-c']) {
    await repo.recordEvent(event(0, { id, timestamp: sameMoment }));
  }

  const first = await repo.findByOrganizationId(ORGANIZATION, { limit: 2 });
  const rest = await repo.findByOrganizationId(ORGANIZATION, {
    limit: 2,
    after: { timestamp: first[1].timestamp, id: first[1].id },
  });

  assert.deepEqual(
    [...first, ...rest].map((entry) => entry.id),
    ['evt-c', 'evt-b', 'evt-a'],
  );
});

test('paging does not become a way past the school boundary', async () => {
  // The cursor added a clause to the same `where` the tenant filter lives in.
  const repo = new InMemoryAuditLogRepository();
  await repo.recordEvent(event(1));
  await repo.recordEvent(event(2, { organizationId: 'org-school-b' }));
  await repo.recordEvent(event(3));

  const page = await repo.findByOrganizationId(ORGANIZATION, {
    limit: MAXIMUM_AUDIT_LOG_PAGE_SIZE,
    after: { timestamp: new Date(EPOCH.getTime() + 4000), id: 'evt-9999' },
  });

  assert.deepEqual(
    page.map((entry) => entry.organizationId),
    [ORGANIZATION, ORGANIZATION],
  );
});
