import { NextResponse } from 'next/server';
import { resolveCoreRepositories } from '@/lib/composition-root';
import { isValidLeaseToken } from '@/lib/server/ai-analysis-worker';
import {
  applyAiInsightsCallback,
  readAiInsights,
  type AiCallbackIdentity,
} from '@/lib/server/ai-insights-service';
import { getDurableWriteGuardResponse } from '@/lib/server/durable-write-guard';
import { hasConfiguredSharedSecret } from '@/lib/server/shared-secret';
import { authorizeManagerRound } from '@/lib/server/manager-scope';
import type { AiAnalysisRun } from '@/lib/types/ai-analysis-run';

interface RouteParams {
  params: Promise<{
    roundId: string;
  }>;
}

/**
 * Headers are the current transport. Query parameters remain accepted only for
 * rollback compatibility with a worker deployed during rollout, so a request
 * carrying both must agree.
 */
function readCallbackIdentity(
  request: Request,
): { ok: true; identity: AiCallbackIdentity } | { ok: false; error: string } {
  const callbackUrl = new URL(request.url);
  const headerRunId = request.headers.get('x-ai-analysis-run-id');
  const headerLeaseToken = request.headers.get('x-ai-analysis-lease-token');
  const queryRunId = callbackUrl.searchParams.get('runId');
  const queryLeaseToken = callbackUrl.searchParams.get('leaseToken');
  if (
    (headerRunId && queryRunId && headerRunId !== queryRunId) ||
    (headerLeaseToken && queryLeaseToken && headerLeaseToken !== queryLeaseToken)
  ) {
    return { ok: false, error: 'Conflicting durable callback identity' };
  }

  const runId = headerRunId ?? queryRunId;
  const leaseToken = headerLeaseToken ?? queryLeaseToken;
  const hasRunIdentity = runId !== null || leaseToken !== null;
  if (
    hasRunIdentity &&
    (!runId || !leaseToken || !isValidLeaseToken(leaseToken))
  ) {
    return {
      ok: false,
      error: 'A durable callback requires a valid runId and leaseToken',
    };
  }

  return { ok: true, identity: { runId, leaseToken } };
}

function runSummary(run: AiAnalysisRun) {
  return {
    id: run.id,
    state: run.state,
    attemptCount: run.attemptCount,
    queuedAt: run.queuedAt.toISOString(),
    startedAt: run.startedAt?.toISOString() ?? null,
    completedAt: run.completedAt?.toISOString() ?? null,
    failureCode: run.failureCode ?? null,
  };
}

export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { roundId } = await params;
    const repositories = resolveCoreRepositories();
    const authorization = await authorizeManagerRound(
      request,
      roundId,
      repositories.orgRepo,
      repositories.roundRepo,
      repositories.auditLogRepo,
    );
    if (!authorization.ok) return authorization.response;

    const result = await readAiInsights(roundId, repositories);
    if (result.outcome === 'found') {
      return NextResponse.json(result.insights);
    }

    return NextResponse.json(
      {
        error: 'AI insights not found for this round',
        roundId,
        run: result.run ? runSummary(result.run) : null,
      },
      { status: 404 },
    );
  } catch (error: any) {
    return NextResponse.json(
      { error: `Failed to fetch AI insights: ${error.message}` },
      { status: 500 }
    );
  }
}

export async function POST(request: Request, { params }: RouteParams) {
  try {
    if (!hasConfiguredSharedSecret(request, 'AI_CALLBACK_SECRET')) {
      return NextResponse.json(
        { error: 'Unauthorized callback' },
        { status: 401 },
      );
    }

    const unavailable = getDurableWriteGuardResponse();
    if (unavailable) return unavailable;

    const { roundId } = await params;
    const identity = readCallbackIdentity(request);
    if (!identity.ok) {
      return NextResponse.json({ error: identity.error }, { status: 400 });
    }

    const payload: unknown = await request.json();
    const result = await applyAiInsightsCallback(
      roundId,
      identity.identity,
      payload,
      resolveCoreRepositories(),
    );

    switch (result.outcome) {
      case 'round_not_found':
        return NextResponse.json(
          { error: 'Survey round not found', roundId },
          { status: 404 },
        );
      case 'run_not_found':
        return NextResponse.json(
          { error: 'Analysis run not found', runId: result.runId },
          { status: 404 },
        );
      case 'run_round_mismatch':
        return NextResponse.json(
          {
            error: 'Analysis run does not belong to this round',
            runId: result.runId,
            roundId,
          },
          { status: 409 },
        );
      case 'contract_invalid':
      case 'round_mismatch':
        return NextResponse.json({ error: result.error }, { status: 400 });
      case 'lease_stale':
        return NextResponse.json(
          {
            error: 'The analysis callback lease is stale or superseded',
            runId: result.runId,
          },
          { status: 409 },
        );
      case 'persisted':
        return NextResponse.json({
          status: 'success',
          message: `AI insights successfully persisted for round ${roundId}`,
          roundId,
          saved: true,
          duplicate: result.duplicate,
        });
    }
  } catch (error: any) {
    return NextResponse.json(
      { error: `Failed to save AI insights: ${error.message}` },
      { status: 500 }
    );
  }
}
