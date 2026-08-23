import { NextResponse } from 'next/server';
import { resolveCoreRepositories } from '@/lib/composition-root';
import {
  AI_ANALYSIS_JOB_LEASE_MS,
  AI_ANALYSIS_LIVE_WORKER_ID_LIMIT,
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

  const { aiAnalysisRunRepo } = resolveCoreRepositories();
  const renewed = await aiAnalysisRunRepo.heartbeat(runId, leaseToken, {
    leaseMs: AI_ANALYSIS_JOB_LEASE_MS,
  });
  if (!renewed) {
    return NextResponse.json(
      { error: 'The analysis run lease is stale or no longer active' },
      { status: 409 },
    );
  }
  /*
   * The renewal is also where a worker finds out it stopped being alone.
   *
   * A zero-downtime deploy overlaps an old container with a new one, and the
   * old one is mid-round: it never claims again, so the claim response cannot
   * reach it and this is the only place left to tell it. Once every heartbeat
   * interval is soon enough — the pace it should be taking is a share, and the
   * overshoot until it hears is bounded by that interval.
   */
  const liveWorkerIds = await aiAnalysisRunRepo.readLiveWorkerIds(
    AI_ANALYSIS_LIVE_WORKER_ID_LIMIT,
  );
  return NextResponse.json({ status: 'running', runId, liveWorkerIds });
}
