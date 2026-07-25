import { NextResponse } from "next/server";
import type {
  IOrganizationRepository,
  IRoundRepository,
} from "@/lib/repositories";
import {
  ManagerScopeRequiredError,
  ManagerScopeService,
} from "@/lib/services";

export const MANAGER_ORGANIZATION_HEADER =
  "x-shalomut-manager-organization-id";

export function getManagerOrganizationId(request: Pick<Request, "headers">) {
  return (
    request.headers.get(MANAGER_ORGANIZATION_HEADER)?.trim() || undefined
  );
}

export function createScopedManagerHeaders(
  requestHeaders: Headers,
  organizationId?: string,
) {
  const headers = new Headers(requestHeaders);
  headers.delete(MANAGER_ORGANIZATION_HEADER);

  const scopedOrganizationId = organizationId?.trim();
  if (scopedOrganizationId) {
    headers.set(MANAGER_ORGANIZATION_HEADER, scopedOrganizationId);
  }

  return headers;
}

export function getManagerScopeErrorResponse(error: unknown) {
  return error instanceof ManagerScopeRequiredError
    ? NextResponse.json(
        { error: "Manager organization scope is required." },
        { status: 403 },
      )
    : null;
}

export async function authorizeManagerRound(
  request: Pick<Request, "headers">,
  roundId: string,
  orgRepo: IOrganizationRepository,
  roundRepo: IRoundRepository,
) {
  try {
    const round = await ManagerScopeService.findRound(
      roundId,
      orgRepo,
      roundRepo,
      getManagerOrganizationId(request),
    );

    return round
      ? { ok: true as const, round }
      : {
          ok: false as const,
          response: NextResponse.json(
            { error: "Survey round not found." },
            { status: 404 },
          ),
        };
  } catch (error) {
    const response = getManagerScopeErrorResponse(error);
    if (response) return { ok: false as const, response };
    throw error;
  }
}
