-- Managers stop being three constants assembled from environment variables per
-- login and become rows. Two tables and no third: there is no credential table,
-- because the owner chose an external identity provider on 2026-08-20 and the
-- product stores no password at all.
--
-- Nothing is backfilled. The one account a deployed runtime has today is
-- derived from `MANAGER_ADMIN_EMAIL` and `MANAGER_ADMIN_PASSWORD` and has no
-- id worth preserving; the first administrator is created on first sign-in
-- from `MANAGER_ADMIN_EMAIL`, which is the bootstrap the plan describes.

-- CreateTable
CREATE TABLE "managers" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "is_platform_administrator" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "managers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organization_memberships" (
    "id" TEXT NOT NULL,
    "manager_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "organization_memberships_pkey" PRIMARY KEY ("id")
);

-- The address is the identity the provider returns, so it is unique across the
-- platform rather than per school. It is lowercased before it is written.
-- CreateIndex
CREATE UNIQUE INDEX "managers_email_key" ON "managers"("email");

-- One person is a member of one school once. The application checks before
-- inserting, which two parallel invitations both pass; only the database can
-- refuse atomically.
-- CreateIndex
CREATE UNIQUE INDEX "organization_memberships_manager_id_organization_id_key" ON "organization_memberships"("manager_id", "organization_id");

-- CreateIndex
CREATE INDEX "organization_memberships_organization_id_idx" ON "organization_memberships"("organization_id");

-- AddForeignKey
ALTER TABLE "organization_memberships" ADD CONSTRAINT "organization_memberships_manager_id_fkey" FOREIGN KEY ("manager_id") REFERENCES "managers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_memberships" ADD CONSTRAINT "organization_memberships_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
