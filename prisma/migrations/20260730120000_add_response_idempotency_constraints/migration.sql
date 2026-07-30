-- Double submission was refused by the service and not by the database:
-- `hasTokenSubmitted()` ran before `create()`, and two parallel requests both
-- pass that check before either writes. The guard belongs here, where it can
-- refuse atomically.
--
-- The token is a random UUID per filling session, not a device or respondent
-- identity, so this deduplicates one filling session and nothing wider.
-- PostgreSQL treats NULLs as distinct, so a submission carrying no token is
-- unaffected by the unique index — it has no session to deduplicate. That is
-- the behaviour the service already had, now stated by the schema.

-- Rows that the constraint would have prevented are removed before it exists,
-- so the migration cannot fail halfway on an environment that collected some.
-- The earliest row wins: it is the submission that would have been accepted,
-- and the later ones are the duplicates the check-then-create race let in.
DELETE FROM "question_answers" a
USING "question_answers" b
WHERE a."response_id" = b."response_id"
  AND a."question_id" = b."question_id"
  AND a."id" > b."id";

DELETE FROM "survey_responses" a
USING "survey_responses" b
WHERE a."round_id" = b."round_id"
  AND a."anonymous_token_hash" IS NOT NULL
  AND b."anonymous_token_hash" IS NOT NULL
  AND a."anonymous_token_hash" = b."anonymous_token_hash"
  AND (
    a."submitted_at" > b."submitted_at"
    OR (a."submitted_at" = b."submitted_at" AND a."id" > b."id")
  );

-- A response answers each question once. Aggregates average over these rows, so
-- a duplicate would silently reweight a dimension rather than fail visibly.
CREATE UNIQUE INDEX "question_answers_response_id_question_id_key"
  ON "question_answers"("response_id", "question_id");

-- Answers are always read by response; the foreign key had no index of its own.
CREATE INDEX "question_answers_response_id_idx"
  ON "question_answers"("response_id");

-- One filling session, one response.
CREATE UNIQUE INDEX "survey_responses_round_id_anonymous_token_hash_key"
  ON "survey_responses"("round_id", "anonymous_token_hash");

-- Analytics reads a round's responses in submission order.
CREATE INDEX "survey_responses_round_id_submitted_at_idx"
  ON "survey_responses"("round_id", "submitted_at");
