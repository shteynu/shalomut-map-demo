-- A round that has stopped collecting has exactly one basis of calculation
-- (ADR-030), so its analytics stop being an answer that has to be recomputed
-- for every manager screen and become a fact about the round.
--
-- Nullable, with no backfill: the column fills itself the first time each
-- closed round is read, and a row that is missing or unreadable costs one
-- recomputation rather than a wrong answer.
ALTER TABLE "survey_rounds" ADD COLUMN "published_analytics" JSONB;
