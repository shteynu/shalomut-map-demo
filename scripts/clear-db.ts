import 'dotenv/config';
import { resolvePoolConfig } from '@/lib/repositories/prisma/pool-options';
import {
  managedTableNames,
  truncateAllStatement,
} from '@/lib/repositories/prisma/managed-tables';

/**
 * Empty every table this schema has, and prove it.
 *
 * Until 2026-08-22 this script named five tables by hand — organizations,
 * rounds, responses, attempts, answers — and printed "Database successfully
 * cleared" with counts for exactly those five. It was older than half the
 * schema: `managers`, `organization_memberships`, `audit_events`,
 * `round_goals`, `survey_definition_versions` and `ai_analysis_runs` all
 * survived it, and `audit_events` has no foreign key by design, so no cascade
 * was ever going to reach it. A "cleared" database kept its identity rows and
 * its whole audit log while reporting otherwise.
 *
 * The list now comes from Prisma's model metadata, and the verification counts
 * every table on it rather than the ones the script tried to empty — which is
 * the half that made the old message believable.
 */

interface CountingPool {
  query: (text: string) => Promise<{ rows: { count: string }[] }>;
}

async function countRows(
  pool: CountingPool,
  tables: string[],
): Promise<Map<string, number>> {
  const counts = new Map<string, number>();

  for (const table of tables) {
    const result = await pool.query(`SELECT count(*)::text AS count FROM "${table}"`);
    counts.set(table, Number(result.rows[0]?.count ?? 0));
  }

  return counts;
}

async function clearDatabase() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is missing.');
  }

  // Which database is about to lose its rows is the only thing worth printing
  // here: the local container and the deployed Supabase are both plausible
  // targets, and the command reads the same either way.
  console.log(
    `🔄 Connecting to ${new URL(connectionString).hostname}...`,
  );

  const { Prisma } = require('@prisma/client');
  const pg = require('pg');

  const pool = new pg.Pool(resolvePoolConfig(connectionString));

  try {
    const tables = managedTableNames(Prisma.dmmf);
    console.log(`🗑️  Clearing ${tables.length} tables...`);

    const before = await countRows(pool, tables);
    for (const [table, count] of before) {
      console.log(` - ${table}: ${count} rows`);
    }

    await pool.query(truncateAllStatement(tables));

    const remaining = [...(await countRows(pool, tables))].filter(
      ([, count]) => count > 0,
    );

    if (remaining.length > 0) {
      // The old script could not report this: it counted only the five tables
      // it had tried to empty, so a table it never touched read as absent
      // rather than as full.
      console.error('❌ Tables still hold rows:', Object.fromEntries(remaining));
      process.exit(1);
    }

    console.log(
      `✅ Database successfully cleared — ${tables.length} tables, all empty.`,
    );
  } catch (error) {
    console.error('❌ Error clearing database:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

clearDatabase();
