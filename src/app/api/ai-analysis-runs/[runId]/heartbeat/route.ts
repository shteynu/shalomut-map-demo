import { NextResponse } from 'next/server';
import { getRepositories } from '@/lib/repositories';
import {
  AI_ANALYSIS_JOB_LEASE_MS,
  isValidLeaseToken,
} from '@/lib/server/ai-analysis-worker';
import { getDurableWriteGuardResponse } from '@/lib/server/durable-write-guard';
import { hasConfiguredSharedSecret } from '@/lib/server/shared-secret';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ runId: string }> },
) {
  if (!hasConfiguredSharedSecret(request, 'AI_CALLBACK_SECRET')) {
    return NextResponse.json({ error: 'Unauthorized worker' }, { status: 401 });
  }
  const unavailable = getDurableWriteGuardResponse();
  if (unavailable) return unavailable;

  const { runId } = await params;
  const body: unknown = await request.json().catch(() => null);
  const leaseToken =
    body && typeof body === 'object' && 'leaseToken' in body
      ? (body as { leaseToken?: unknown }).leaseToken
      : undefined;
  if (!isValidLeaseToken(leaseToken)) {
    return NextResponse.json({ error: 'Invalid lease token' }, { status: 400 });
  }

  const { aiAnalysisRunRepo } = getRepositories();
  const renewed = await aiAnalysisRunRepo.heartbeat(runId, leaseToken, {
    leaseMs: AI_ANALYSIS_JOB_LEASE_MS,
  });
  if (!renewed) {
    return NextResponse.json(
      { error: 'The analysis run lease is stale or no longer active' },
      { status: 409 },
    );
  }
  return NextResponse.json({ status: 'running', runId });
}
