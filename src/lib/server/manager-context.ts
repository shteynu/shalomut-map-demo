import { connection } from "next/server";
import { headers } from "next/headers";
import { getRepositories } from "@/lib/repositories";
import { ManagerContextService } from "@/lib/services";
import { MANAGER_ORGANIZATION_HEADER } from "@/lib/server/manager-scope";

export async function loadManagerContext() {
  await connection();
  const { orgRepo, roundRepo, surveyRepo } = getRepositories();
  const requestHeaders = await headers();
  const organizationId =
    requestHeaders.get(MANAGER_ORGANIZATION_HEADER)?.trim() || undefined;

  return ManagerContextService.load(
    orgRepo,
    roundRepo,
    surveyRepo,
    organizationId,
  );
}
