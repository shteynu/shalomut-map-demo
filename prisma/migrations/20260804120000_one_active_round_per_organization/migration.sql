-- A school runs one round at a time (owner decision 2026-08-03, ADR-014). Until
-- now that rule lived only in `RoundService`, which closes the previous round
-- with a second write: nothing in the database refused two active rounds, so a
-- crash between the two writes, a direct SQL edit or a future second writer
-- could leave a school with two live share links and no answer to which round a
-- respondent is answering.
--
-- Only 'active' is constrained. Drafts, closed and archived rounds are the
-- history the product is built on, so a school may hold any number of them.

-- Rows the constraint would have prevented are resolved before it exists, so
-- the migration cannot fail halfway on an environment that collected some. The
-- most recently created active round wins — it is the one the school started
-- last, and the older ones are what the rule would have closed.
UPDATE "survey_rounds" AS extra
SET "status" = 'closed'
WHERE extra."status" = 'active'
  AND EXISTS (
    SELECT 1
    FROM "survey_rounds" AS newer
    WHERE newer."organization_id" = extra."organization_id"
      AND newer."status" = 'active'
      AND (newer."created_at", newer."id") > (extra."created_at", extra."id")
  );

-- Prisma cannot express a partial index in `schema.prisma`, so this index has
-- no counterpart in the model and is owned by this migration alone. Renaming or
-- dropping it means writing another migration, not editing the schema.
CREATE UNIQUE INDEX "survey_rounds_one_active_per_organization"
  ON "survey_rounds"("organization_id")
  WHERE "status" = 'active';
