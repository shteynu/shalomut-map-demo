import { NextResponse } from 'next/server';
import { resolveCoreRepositories } from '@/lib/composition-root';
import {
  ManagerContextService,
  ManagerScopeService,
  RoundService,
} from '@/lib/services';
import { getDurableWriteGuardResponse } from '@/lib/server/durable-write-guard';
import { recordRoundAuditEvent } from '@/lib/server/manager-audit';
import { enqueueAiAnalyticsForSupersededRounds } from '@/lib/server/trigger-ai-analytics';
import {
  authorizeManagerRound,
  getManagerMemberSchools,
  getManagerOrganizationId,
  getManagerScopeErrorResponse,
} from '@/lib/server/manager-scope';
import { CreateRoundInput } from '@/lib/types/backend';

export async function GET(request?: Request) {
  try {
    const { auditLogRepo, orgRepo, roundRepo, surveyRepo } = resolveCoreRepositories();
    const roundId = request
      ? new URL(request.url).searchParams.get('roundId')?.trim()
      : undefined;
    if (roundId && request) {
      const authorization = await authorizeManagerRound(
        request,
        roundId,
        orgRepo,
        roundRepo,
        auditLogRepo,
      );
      if (!authorization.ok) return authorization.response;

      return NextResponse.json({ round: authorization.round });
    }

    const context = await ManagerContextService.load(
      orgRepo,
      roundRepo,
      surveyRepo,
      request ? getManagerOrganizationId(request) : undefined,
      undefined,
      request ? getManagerMemberSchools(request) : undefined,
    );
    if (context.state === 'scope-required') {
      return NextResponse.json(
        { error: 'Manager organization scope is required.' },
        { status: 403 },
      );
    }

    return NextResponse.json({ round: context.selectedRound });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch round' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const unavailable = getDurableWriteGuardResponse();
    if (unavailable) return unavailable;

    const body = (await request.json()) as CreateRoundInput;
    if (!body.organizationId || !body.title) {
      return NextResponse.json(
        { error: 'organizationId and title are required' },
        { status: 400 }
      );
    }

    const { aiAnalysisRunRepo, auditLogRepo, orgRepo, roundRepo, surveyRepo } =
      resolveCoreRepositories();
    const organizationId = await ManagerScopeService.resolveOrganizationId(
      orgRepo,
      getManagerOrganizationId(request),
      getManagerMemberSchools(request),
    );
    const organization = organizationId
      ? await orgRepo.findById(organizationId)
      : null;
    if (
      !organization ||
      body.organizationId !== organization.id
    ) {
      return NextResponse.json(
        { error: 'Organization not found.' },
        { status: 404 },
      );
    }

    const { round, closedRounds } = await RoundService.createAndSaveRound(
      body,
      roundRepo,
    );

    // A round brought in with a complete questionnaire is live the moment it
    // exists, so it closes the round the school was running — and a closed
    // round is what asks for its analysis (owner decision 2026-08-17). The
    // same wiring the builder's activation path has, at the other door.
    await enqueueAiAnalyticsForSupersededRounds(
      closedRounds,
      aiAnalysisRunRepo,
      surveyRepo,
    );

    await recordRoundAuditEvent(
      auditLogRepo,
      request,
      'ROUND_CREATED',
      round.id,
      organization.id,
      { title: round.title },
    );
    return NextResponse.json({ success: true, round }, { status: 201 });
  } catch (error) {
    const scopeResponse = getManagerScopeErrorResponse(error);
    if (scopeResponse) return scopeResponse;

    return NextResponse.json(
      { error: 'Failed to create survey round' },
      { status: 500 }
    );
  }
}
