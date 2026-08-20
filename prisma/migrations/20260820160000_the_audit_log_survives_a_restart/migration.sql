-- The audit log stops being process-local. Until now `getAuditLogRepository()`
-- returned an in-memory store, so every recorded action died with the container
-- and the `console.info` line beside it landed in a window nothing collects.
--
-- It lands before the administrators do, not after: once about four people can
-- open every school, this table is the only thing separating a legitimate
-- support visit from an unaccountable one.
--
-- Nothing is backfilled, because there is nothing to backfill — no row of this
-- kind has ever been written.

-- CreateTable
CREATE TABLE "audit_events" (
    "id" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "action" TEXT NOT NULL,
    "manager_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "round_id" TEXT,
    "details" JSONB,

    CONSTRAINT "audit_events_pkey" PRIMARY KEY ("id")
);

-- No foreign keys, deliberately. An audit row has to outlive what it describes:
-- a deleted school and a removed manager are precisely the cases somebody would
-- later want to reconstruct, and a cascade would delete the record of the
-- deletion. `manager_id` may also read 'unknown', for an action that reached the
-- server without a manager session.

-- Reading one school's log, newest first.
-- CreateIndex
CREATE INDEX "audit_events_organization_id_timestamp_idx" ON "audit_events"("organization_id", "timestamp");

-- What one person did, which is the question an administrator's visit raises.
-- CreateIndex
CREATE INDEX "audit_events_manager_id_timestamp_idx" ON "audit_events"("manager_id", "timestamp");
