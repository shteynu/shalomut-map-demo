-- `question_answers` is the largest table this product writes: one row per
-- respondent per question, so a 300-person round on the 126-item instrument is
-- ~38 000 rows of it. It carried two indexes over the same leading column.
--
-- `question_answers_response_id_question_id_key` exists because a response
-- answers each question once, and a btree on (response_id, question_id) already
-- answers every lookup by response_id alone — which is the only shape anything
-- here asks for, including the ON DELETE CASCADE from `survey_responses`.
-- `question_answers_response_id_idx` therefore served no read and cost every
-- write: one more index to maintain per inserted answer, on the insert path a
-- whole staff meeting travels through at once.
--
-- Dropped rather than replaced. The unique index is not an optimisation that
-- could later be tuned away; it is the constraint that keeps a duplicate answer
-- from silently reweighting a dimension, so it cannot disappear without the
-- rule disappearing with it.

DROP INDEX IF EXISTS "question_answers_response_id_idx";
