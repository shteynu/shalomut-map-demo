-- Operational counters and caught errors stop being `console` lines only.
--
-- The audit of 2026-08-21 found every counter in this product emitting to
-- stdout with no collector, no retention and no alert: a lost submission, a
-- silently dead paid model and a rejected contract payload all landed in a
-- window nobody reads and Vercel discards. `ai-operational-metrics.ts` said so
-- itself, in as many words, and called the receiver an open decision.
--
-- Nothing is backfilled. Every line written before this migration is gone
-- already, which is the finding.

-- CreateTable
CREATE TABLE "operational_events" (
    "id" TEXT NOT NULL,
    "observed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "kind" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "value" DOUBLE PRECISION,
    "unit" TEXT,
    "labels" JSONB,
    "run_id" TEXT,
    "round_id" TEXT,
    "detail" JSONB,

    CONSTRAINT "operational_events_pkey" PRIMARY KEY ("id")
);

-- No foreign keys, deliberately, and for the same reason `audit_events` has
-- none: an event about a round must outlive the round. A cascade would delete
-- exactly the evidence someone came looking for, and a write that could fail on
-- a stale id would let observability break the thing it observes.

-- The alert's query: one metric name over a recent window.
-- CreateIndex
CREATE INDEX "operational_events_name_observed_at_idx" ON "operational_events"("name", "observed_at");

-- The retention sweep, and "what else happened around this moment".
-- CreateIndex
CREATE INDEX "operational_events_observed_at_idx" ON "operational_events"("observed_at");
