import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {
  managedTableNames,
  truncateAllStatement,
} from '@/lib/repositories/prisma/managed-tables';

/**
 * The regression this file exists for is an omission, so the test that matters
 * compares the derived list against the schema itself rather than against a
 * list written here — a list written here would go stale the same way
 * `scripts/clear-db.ts` did.
 */

function tablesDeclaredInSchema(): string[] {
  const schema = readFileSync(
    path.join(process.cwd(), 'prisma', 'schema.prisma'),
    'utf-8',
  );

  return [...schema.matchAll(/@@map\("([^"]+)"\)/g)].map((match) => match[1]).sort();
}

test('every table the schema declares is on the list', async () => {
  const { Prisma } = await import('@prisma/client');
  const derived = managedTableNames(Prisma.dmmf as never).sort();

  // Every `@@map` in the schema, including the six the old script never named:
  // managers, organization_memberships, audit_events, round_goals,
  // survey_definition_versions and ai_analysis_runs.
  assert.deepStrictEqual(derived, tablesDeclaredInSchema());

  for (const forgotten of [
    'managers',
    'organization_memberships',
    'audit_events',
    'round_goals',
    'survey_definition_versions',
    'ai_analysis_runs',
  ]) {
    assert.ok(derived.includes(forgotten), `${forgotten} is not cleared`);
  }
});

test('the migration table is never on it', () => {
  // Truncating `_prisma_migrations` would make the next deploy replay the whole
  // history against a schema that already has it. It is not a Prisma model, so
  // the derivation excludes it — this pins that it stays excluded.
  const tables = managedTableNames({
    datamodel: { models: [{ name: 'Organization', dbName: 'organizations' }] },
  });

  assert.deepStrictEqual(tables, ['organizations']);
  assert.ok(!tables.includes('_prisma_migrations'));
});

test('a model without @@map contributes its own name', () => {
  assert.deepStrictEqual(
    managedTableNames({
      datamodel: { models: [{ name: 'Widget', dbName: null }] },
    }),
    ['Widget'],
  );
});

test('an empty model list throws rather than clearing nothing quietly', () => {
  assert.throws(
    () => managedTableNames({ datamodel: { models: [] } }),
    /prisma generate/,
  );
});

test('the statement truncates every table in one cascade', () => {
  assert.strictEqual(
    truncateAllStatement(['organizations', 'audit_events']),
    'TRUNCATE TABLE "organizations", "audit_events" RESTART IDENTITY CASCADE',
  );
});

test('a table name that is not an identifier is refused, not quoted around', () => {
  assert.throws(
    () => truncateAllStatement(['organizations"; DROP TABLE managers; --']),
    /unexpected table name/,
  );
  assert.throws(() => truncateAllStatement([]), /no tables/);
});
