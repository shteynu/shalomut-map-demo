-- Ten respondents is the product minimum again, and the stored data now says so
-- too. Reads already raise anything lower (effectivePrivacyThreshold), so a
-- round created under the interim default of 1 was locked on screen while its
-- own row still claimed 1 — and 1 is the number the manager saw on the round
-- page and the number the questionnaire snapshot quoted.

-- A new round starts at the minimum again.
ALTER TABLE "survey_rounds"
ALTER COLUMN "privacy_threshold" SET DEFAULT 10;

-- Existing rounds are raised, never lowered: a manager who asked for a stricter
-- threshold keeps it.
UPDATE "survey_rounds"
SET "privacy_threshold" = 10
WHERE "privacy_threshold" < 10;

-- The questionnaire snapshot carries its own copy of the number, and that copy
-- is what the respondent's anonymity promise is written from. Raise it in place
-- so both agree; rows without a definition, or without that key, are untouched.
UPDATE "survey_rounds"
SET "survey_definition" = jsonb_set(
      "survey_definition",
      '{minimumResponses}',
      to_jsonb(10)
    )
WHERE "survey_definition" IS NOT NULL
  AND jsonb_typeof("survey_definition") = 'object'
  AND jsonb_typeof("survey_definition" -> 'minimumResponses') = 'number'
  AND ("survey_definition" ->> 'minimumResponses')::int < 10;
