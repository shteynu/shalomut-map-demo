-- Share codes are compared for equality now, not with ILIKE, so the stored form
-- has to be the generated form.
--
-- `RoundService.SHARE_CODE_ALPHABET` is uppercase and the prefix is `SHALOM-`,
-- so every code this product ever generated is already uppercase and this
-- statement is expected to touch nothing. It exists for the rows nobody
-- generated: fixtures, seeds, and anything typed straight into the database
-- while the lookup was case-insensitive and forgave it.
--
-- Uppercasing a stored code does not break a link somebody holds. The lookup
-- normalizes what it is given before comparing, exactly as it did when the
-- database was doing the folding.
--
-- A row is skipped when uppercasing it would collide with a code another round
-- already holds — `share_code` is unique, and a migration that can fail halfway
-- is worse than one that leaves a row alone and says so. Two rounds whose codes
-- differ only in case were already broken before this: the old lookup was
-- `findFirst` over an ILIKE, so it returned whichever of them came back first.
UPDATE "survey_rounds" AS lowercased
SET "share_code" = upper(lowercased."share_code")
WHERE lowercased."share_code" <> upper(lowercased."share_code")
  AND NOT EXISTS (
    SELECT 1
    FROM "survey_rounds" AS taken
    WHERE taken."id" <> lowercased."id"
      AND taken."share_code" = upper(lowercased."share_code")
  );
