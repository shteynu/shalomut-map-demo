-- How long the questionnaire was visible to the respondent who sent this
-- response, in whole seconds, summed by their own browser.
--
-- Nullable and left null for every row already stored. A backfill is not
-- possible and would not be honest if it were: the round's own clock says how
-- long a session lasted, not how much of it the questionnaire was on screen,
-- and copying one into the other would turn an upper bound into a measurement.
ALTER TABLE "survey_responses" ADD COLUMN "visible_seconds" INTEGER;

-- The column is written by an unauthenticated endpoint, so the range is
-- enforced where it cannot be argued with. The upper bound is twelve hours,
-- which the client caps to as well; the point of the constraint is that the
-- client is not the thing being trusted.
ALTER TABLE "survey_responses"
  ADD CONSTRAINT "survey_responses_visible_seconds_check"
  CHECK ("visible_seconds" IS NULL OR ("visible_seconds" > 0 AND "visible_seconds" <= 43200));
