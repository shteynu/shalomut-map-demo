-- Persist validated AI Stone Map results on their survey round.
ALTER TABLE "survey_rounds"
ADD COLUMN "ai_insights" JSONB,
ADD COLUMN "ai_insights_updated_at" TIMESTAMP(3);
