import { connection } from "next/server";
import { getRepositories } from "@/lib/repositories";
import { ManagerContextService } from "@/lib/services";

export async function loadManagerContext() {
  await connection();
  const { orgRepo, roundRepo, surveyRepo } = getRepositories();

  return ManagerContextService.load(orgRepo, roundRepo, surveyRepo);
}
