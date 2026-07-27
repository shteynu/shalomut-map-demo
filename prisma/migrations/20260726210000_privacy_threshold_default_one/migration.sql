-- Product default for a newly created round drops from 10 to 1.
-- Only rows inserted without an explicit privacy_threshold are affected;
-- existing rounds keep the threshold their manager configured.
ALTER TABLE "survey_rounds"
ALTER COLUMN "privacy_threshold" SET DEFAULT 1;
