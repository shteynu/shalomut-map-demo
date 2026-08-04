-- A recommendation a manager decided to work on becomes a row here.
--
-- The recommendation text is copied, not referenced. Recommendations belong to
-- an analysis run and are rewritten wholesale by the next one; a goal belongs
-- to the school and has to survive that, or "tracked" means nothing. The copy
-- is also why this table has no foreign key into the AI result.
--
-- Nothing about a respondent reaches this table: a goal names a dimension and
-- carries manager-facing copy that already passed the privacy gate before it
-- could be shown at all.
CREATE TABLE "round_goals" (
    "id" TEXT NOT NULL,
    "round_id" TEXT NOT NULL,
    "dimension_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "round_goals_pkey" PRIMARY KEY ("id")
);

-- One recommendation becomes one goal. The service checks first, which a
-- double-tapped button passes twice; only the database can refuse atomically.
-- The title is the recommendation's identity because the AI payload carries no
-- id of its own.
CREATE UNIQUE INDEX "round_goals_round_id_dimension_id_title_key"
  ON "round_goals"("round_id", "dimension_id", "title");

-- The list is read per round, newest decision last.
CREATE INDEX "round_goals_round_id_created_at_idx"
  ON "round_goals"("round_id", "created_at");

-- A deleted round takes its goals with it, the same way it takes its responses
-- and its analysis runs.
ALTER TABLE "round_goals"
  ADD CONSTRAINT "round_goals_round_id_fkey"
  FOREIGN KEY ("round_id") REFERENCES "survey_rounds"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
