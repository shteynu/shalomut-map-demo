import { NextResponse } from 'next/server';
import { resolveCoreRepositories } from '@/lib/composition-root';
import {
  AI_ANALYSIS_JOB_LEASE_MS,
  AI_ANALYSIS_JOB_MAX_ATTEMPTS,
  AI_ANALYSIS_LIVE_WORKER_ID_LIMIT,
  isValidWorkerId,
} from '@/lib/server/ai-analysis-worker';
import { getDurableWriteGuardResponse } from '@/lib/server/durable-write-guard';
import { hasConfiguredSharedSecret } from '@/lib/server/shared-secret';
import { recordAiJobClaimed } from '@/lib/server/ai-operational-metrics';

export async function POST(request: Request) {
  if (!hasConfiguredSharedSecret(request, 'AI_CALLBACK_SECRET')) {
    return NextResponse.json({ error: 'Unauthorized worker' }, { status: 401 });
  }

  const unavailable = getDurableWriteGuardResponse();
  if (unavailable) return unavailable;

  const body: unknown = await request.json().catch(() => null);
  const workerId =
    body && typeof body === 'object' && 'workerId' in body
      ? (body as { workerId?: unknown }).workerId
      : undefined;
  if (!isValidWorkerId(workerId)) {
    return NextResponse.json(
      { error: 'workerId must be a non-empty safe identifier' },
      { status: 400 },
    );
  }

  const { aiAnalysisRunRepo } = resolveCoreRepositories();
  const lease = await aiAnalysisRunRepo.claimNext({
    workerId,
    leaseMs: AI_ANALYSIS_JOB_LEASE_MS,
    maxAttempts: AI_ANALYSIS_JOB_MAX_ATTEMPTS,
  });
  if (!lease) return new Response(null, { status: 204 });
  recordAiJobClaimed(lease.run);

  /*
   * Two independent reads the lease travels with, in one round-trip to a
   * database on another continent.
   *
   * **The map a partial run is amending.** A run that names dimensions needs
   * the map it is amending, and it is sent with the lease rather than fetched
   * by the worker afterwards: the two belong together — a previous result read
   * a second later could belong to a different run — and the worker has no
   * other way to ask. `/api/rounds/…/ai-insights` is manager-scoped by design,
   * and widening it so a service could read through it would trade a manager
   * boundary for a convenience. Nothing extra travels on an ordinary run: a
   * whole-round run rebuilds every stone and has no use for the old ones.
   *
   * **Who else is sending.** The worker has just become one of the processes
   * that may reach the paid provider, and the provider counts its quota per
   * key rather than per process. This is how it learns whether the pace is its
   * own or a share of one, and it has to arrive with the lease rather than a
   * heartbeat later, because the first provider call of a round follows within
   * seconds.
   */
  const [previousResult, liveWorkerIds] = await Promise.all([
    lease.run.regenerateDimensionIds.length > 0
      ? aiAnalysisRunRepo.findLatestResultByRoundId(lease.run.roundId)
      : Promise.resolve(null),
    aiAnalysisRunRepo.readLiveWorkerIds(AI_ANALYSIS_LIVE_WORKER_ID_LIMIT),
  ]);

  return NextResponse.json({
    run: {
      id: lease.run.id,
      roundId: lease.run.roundId,
      state: lease.run.state,
      attemptCount: lease.run.attemptCount,
      queuedAt: lease.run.queuedAt.toISOString(),
      startedAt: lease.run.startedAt?.toISOString() ?? null,
      leaseExpiresAt: lease.run.leaseExpiresAt?.toISOString() ?? null,
      // Empty on every ordinary run, which is what a worker that has never
      // heard of this field also sees.
      regenerateDimensionIds: lease.run.regenerateDimensionIds,
    },
    previousResult,
    leaseToken: lease.leaseToken,
    // This worker's own id is among them: it holds a live lease as of the line
    // above. A worker that has never heard of this field paces itself alone,
    // which is what every worker did before the field existed.
    liveWorkerIds,
  });
}
