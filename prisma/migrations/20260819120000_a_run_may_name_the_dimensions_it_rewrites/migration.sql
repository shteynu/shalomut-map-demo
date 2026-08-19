-- A manager who reads that one dimension's paragraphs were composed from the
-- numbers has one move: re-run the analysis, which re-runs all eight. This
-- column is what lets a run say it only has to write some of them.
--
-- Empty rather than NULL, and empty means the whole round. Every row written
-- before this migration gets the default, and "regenerate nothing in
-- particular" is exactly what those runs did — so the existing history keeps
-- its meaning and no backfill has to guess.
--
-- The values are dimension ids, and nothing here constrains them to the eight:
-- the canonical list lives in the contract and in `AI_ANALYTICS_DIMENSION_IDS`,
-- and a CHECK constraint repeating it would be a second copy that a contract
-- change could not update. The API validates against the contract instead.

ALTER TABLE "ai_analysis_runs"
  ADD COLUMN "regenerate_dimension_ids" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
