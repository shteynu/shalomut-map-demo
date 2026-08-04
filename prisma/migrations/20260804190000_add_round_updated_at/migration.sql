-- When a round last reached the database.
--
-- The setup screen and the survey builder tell the manager when their work was
-- saved. Until now that answer lived only in the browser tab that performed the
-- save, so a reload erased it; this column is what makes the answer outlive the
-- session.
--
-- Nullable and not backfilled on purpose. Rounds written before this column
-- existed have no recorded save time: `created_at` is when the row appeared,
-- not when its questionnaire or its background data was last edited. Copying it
-- here would turn a guess into a claim on the manager's screen, and those
-- rounds show no time until their next save instead.
ALTER TABLE "survey_rounds"
  ADD COLUMN "updated_at" TIMESTAMP(3);
