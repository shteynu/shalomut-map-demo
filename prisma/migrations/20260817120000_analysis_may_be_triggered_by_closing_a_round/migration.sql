-- Analysis now runs when a manager closes a round, not after every answer
-- (owner decision 2026-08-17). The run that closing dispatches is neither of
-- the two triggers this table knew: it is not 'automatic', because no
-- respondent caused it, and calling it 'manual' would merge it with the
-- re-analysis button and make `ai_jobs_queued{trigger}` stop distinguishing the
-- one entrance from the other.
--
-- 'automatic' stays permitted. Rows written before this migration carry it, and
-- a constraint that refused its own history would fail on any environment that
-- ever collected a response. Nothing writes it after this change; it is a value
-- the table can still read, not one it can still receive.
--
-- The check has no counterpart in `schema.prisma` — Prisma cannot express a
-- CHECK constraint — so it is owned by migrations alone, and changing it again
-- means writing another one rather than editing the model.

ALTER TABLE "ai_analysis_runs"
  DROP CONSTRAINT "ai_analysis_runs_trigger_check";

ALTER TABLE "ai_analysis_runs"
  ADD CONSTRAINT "ai_analysis_runs_trigger_check"
  CHECK ("trigger" IN ('automatic', 'manual', 'closure'));
