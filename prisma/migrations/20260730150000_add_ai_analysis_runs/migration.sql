-- Durable queue and lifecycle for Core-owned AI analysis work. The legacy
-- survey_rounds.ai_insights_updated_at column remains the result timestamp;
-- it is no longer used as a dispatch lease after the application rollout.
CREATE TABLE "ai_analysis_runs" (
    "id" TEXT NOT NULL,
    "sequence" SERIAL NOT NULL,
    "round_id" TEXT NOT NULL,
    "request_key" TEXT NOT NULL,
    "trigger" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "attempt_count" INTEGER NOT NULL DEFAULT 0,
    "queued_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "started_at" TIMESTAMP(3),
    "heartbeat_at" TIMESTAMP(3),
    "lease_expires_at" TIMESTAMP(3),
    "lease_token" TEXT,
    "worker_id" TEXT,
    "completed_at" TIMESTAMP(3),
    "callback_received_at" TIMESTAMP(3),
    "failure_code" TEXT,
    "result" JSONB,

    CONSTRAINT "ai_analysis_runs_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ai_analysis_runs_state_check"
      CHECK ("state" IN ('queued', 'running', 'succeeded', 'failed')),
    CONSTRAINT "ai_analysis_runs_trigger_check"
      CHECK ("trigger" IN ('automatic', 'manual')),
    CONSTRAINT "ai_analysis_runs_attempt_count_check"
      CHECK ("attempt_count" >= 0)
);

CREATE UNIQUE INDEX "ai_analysis_runs_round_id_request_key_key"
ON "ai_analysis_runs"("round_id", "request_key");

CREATE UNIQUE INDEX "ai_analysis_runs_sequence_key"
ON "ai_analysis_runs"("sequence");

-- PostgreSQL enforces the cross-process invariant that only one job for a
-- round may be queued or running. Prisma cannot express a partial unique index
-- in schema.prisma, so this constraint intentionally lives in SQL.
CREATE UNIQUE INDEX "ai_analysis_runs_one_active_per_round_key"
ON "ai_analysis_runs"("round_id")
WHERE "state" IN ('queued', 'running');

CREATE INDEX "ai_analysis_runs_state_lease_expires_at_queued_at_idx"
ON "ai_analysis_runs"("state", "lease_expires_at", "queued_at");

CREATE INDEX "ai_analysis_runs_round_id_queued_at_idx"
ON "ai_analysis_runs"("round_id", "queued_at");

ALTER TABLE "ai_analysis_runs"
ADD CONSTRAINT "ai_analysis_runs_round_id_fkey"
FOREIGN KEY ("round_id") REFERENCES "survey_rounds"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
