-- CreateTable
CREATE TABLE "survey_attempts" (
    "id" TEXT NOT NULL,
    "round_id" TEXT NOT NULL,
    "anonymous_token_hash" TEXT NOT NULL,
    "opened_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "consent_accepted_at" TIMESTAMP(3),
    "last_question_reached" INTEGER,
    "completed_at" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "survey_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "survey_attempts_round_id_opened_at_idx" ON "survey_attempts"("round_id", "opened_at");

-- CreateIndex
CREATE UNIQUE INDEX "survey_attempts_round_id_anonymous_token_hash_key" ON "survey_attempts"("round_id", "anonymous_token_hash");

-- AddForeignKey
ALTER TABLE "survey_attempts" ADD CONSTRAINT "survey_attempts_round_id_fkey" FOREIGN KEY ("round_id") REFERENCES "survey_rounds"("id") ON DELETE CASCADE ON UPDATE CASCADE;
