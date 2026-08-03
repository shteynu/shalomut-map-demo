import { connection } from "next/server";
import { headers } from "next/headers";
import { resolveCoreRepositories } from "@/lib/composition-root";
import { ManagerContextService } from "@/lib/services";
import { MANAGER_ORGANIZATION_HEADER } from "@/lib/server/manager-scope";

export async function loadManagerContext(roundId?: string) {
  await connection();
  const { orgRepo, roundRepo, surveyRepo } = resolveCoreRepositories();
  const requestHeaders = await headers();
  const organizationId =
    requestHeaders.get(MANAGER_ORGANIZATION_HEADER)?.trim() || undefined;

  return ManagerContextService.load(
    orgRepo,
    roundRepo,
    surveyRepo,
    organizationId,
    roundId?.trim() || undefined,
  );
}
