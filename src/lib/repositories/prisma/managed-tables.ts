/**
 * Every table this schema owns, read from Prisma's own model metadata rather
 * than typed out.
 *
 * `scripts/clear-db.ts` named five tables by hand until 2026-08-22 and had
 * been wrong since the sixth was added. `managers`,
 * `organization_memberships`, `audit_events`, `round_goals`,
 * `survey_definition_versions` and `ai_analysis_runs` all survived a "database
 * successfully cleared", and `audit_events` has no incoming foreign key by
 * design, so no cascade was ever going to reach it either.
 *
 * A list that is derived cannot fall behind the schema. That is the whole
 * reason this is a module with a test rather than an array in a script.
 */

export interface DatamodelModel {
  name: string;
  dbName?: string | null;
}

export interface Datamodel {
  datamodel: { models: DatamodelModel[] };
}

/**
 * `dbName` is what `@@map` sets; `name` is the Prisma model when there is no
 * mapping. Getting this backwards produces a list of tables that do not exist,
 * which fails loudly — unlike the omission it replaces.
 */
export function managedTableNames(dmmf: Datamodel): string[] {
  const tables = dmmf.datamodel.models.map((model) => model.dbName || model.name);

  if (tables.length === 0) {
    throw new Error(
      'Prisma reports no models. Run `prisma generate` before clearing the database.',
    );
  }

  return tables;
}

/**
 * One statement for the whole schema.
 *
 * `CASCADE` rather than a hand-maintained deletion order, because the order was
 * the other half of the old bug: the script deleted five tables and trusted
 * cascades to reach whatever it had not named. `RESTART IDENTITY` matters for
 * nothing here today — every key is a cuid — and costs nothing if a sequence
 * ever appears.
 *
 * `_prisma_migrations` is not a Prisma model, so it is never in this list.
 * Truncating it would make the next deploy replay the entire migration history
 * against a schema that already has it.
 */
export function truncateAllStatement(tables: string[]): string {
  if (tables.length === 0) {
    throw new Error('Refusing to build a TRUNCATE with no tables.');
  }

  const quoted = tables.map((table) => {
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(table)) {
      throw new Error(`Refusing to truncate an unexpected table name: ${table}`);
    }

    return `"${table}"`;
  });

  return `TRUNCATE TABLE ${quoted.join(', ')} RESTART IDENTITY CASCADE`;
}
