-- What the questionnaire looked like after each save that changed it.
--
-- The builder can rearrange, disable and bulk-edit questions, and until now the
-- only recoverable state was the latest one written: a manager who bulk-edited
-- and saved had no way back (backlog §1). A row here is one earlier state,
-- copied whole rather than as a diff — the document is small, and the point of
-- the feature is to hand back an exact earlier questionnaire rather than a
-- replayable history.
--
-- Only the questionnaire is versioned. Responses are not, and cannot be: after
-- the first accepted response the question snapshot is frozen anyway, so this
-- table is a safety net for the drafting phase.
--
-- Nothing about a respondent reaches this table. A definition is question text,
-- dimensions, order and enabled state, all of it manager-authored.
CREATE TABLE "survey_definition_versions" (
    "id" TEXT NOT NULL,
    "round_id" TEXT NOT NULL,
    "definition" JSONB NOT NULL,
    "saved_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "survey_definition_versions_pkey" PRIMARY KEY ("id")
);

-- The list is read per round, newest first, and pruning to the retention limit
-- reads the same order.
CREATE INDEX "survey_definition_versions_round_id_saved_at_idx"
  ON "survey_definition_versions"("round_id", "saved_at");

-- A deleted round takes its history with it, the same way it takes its
-- responses, its analysis runs and its goals.
ALTER TABLE "survey_definition_versions"
  ADD CONSTRAINT "survey_definition_versions_round_id_fkey"
  FOREIGN KEY ("round_id") REFERENCES "survey_rounds"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
