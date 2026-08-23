-- A school has one person, and until now only the application said so.
--
-- `inviteSchoolUser` and `setMembershipStatus` both read the school's
-- memberships, look for one that stands — 'active' or 'invited' — and refuse if
-- they find one. That is check-then-write: two requests that read before either
-- writes both pass the check, and the school ends up with two standing
-- memberships. The 2026-08-21 audit named it and named this fix; the schema's
-- own comment on `@@unique([managerId, organizationId])` had already said that
-- only the database can refuse atomically.
--
-- Only standing memberships are constrained. 'suspended' is how a school
-- changes hands — revoke, then invite — so a school may hold any number of
-- revoked rows, and it has to: they are what the audit log's `manager_id`
-- points at when someone asks who had the school last year.

-- Rows the constraint would have prevented are resolved before it exists, so
-- the migration cannot fail halfway on an environment that collected some. The
-- most recently created standing membership wins — it is the one an
-- administrator issued last — and the older ones become 'suspended', which is
-- what revoking them would have done and keeps them readable.
UPDATE "organization_memberships" AS extra
SET "status" = 'suspended'
WHERE extra."status" IN ('active', 'invited')
  AND EXISTS (
    SELECT 1
    FROM "organization_memberships" AS newer
    WHERE newer."organization_id" = extra."organization_id"
      AND newer."status" IN ('active', 'invited')
      AND (newer."created_at", newer."id") > (extra."created_at", extra."id")
  );

-- Prisma cannot express a partial index in `schema.prisma`, so this index has
-- no counterpart in the model and is owned by this migration alone. Renaming or
-- dropping it means writing another migration, not editing the schema. The same
-- arrangement as `survey_rounds_one_active_per_organization`.
CREATE UNIQUE INDEX "organization_memberships_one_standing_per_organization"
  ON "organization_memberships"("organization_id")
  WHERE "status" IN ('active', 'invited');
