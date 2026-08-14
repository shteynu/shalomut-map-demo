-- A background question — age band, role, commute time — is answered like any
-- other and belongs to no wellbeing dimension, so it has neither a dimension
-- nor a score. Both columns become nullable.
--
-- Widening only. Every row already written carries a dimension and a score and
-- is untouched; nothing here can fail on existing data, and rolling the code
-- back leaves those rows readable exactly as before.
ALTER TABLE "question_answers" ALTER COLUMN "dimension_id" DROP NOT NULL;
ALTER TABLE "question_answers" ALTER COLUMN "score" DROP NOT NULL;
