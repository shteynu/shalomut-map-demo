import { NextResponse } from 'next/server';
import { resolveCoreRepositories } from '@/lib/composition-root';
import {
  AI_ANALYSIS_JOB_LEASE_MS,
  AI_ANALYSIS_JOB_MAX_ATTEMPTS,
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
   * A run that names dimensions is amending a map, so it needs the map.
   *
   * Sent with the lease rather than fetched by the worker afterwards: the two
   * belong together — a previous result read a second later could belong to a
   * different run — and the worker has no other way to ask. `/api/rounds/…/
   * ai-insights` is manager-scoped by design, and widening it so a service
   * could read through it would trade a manager boundary for a convenience.
   *
   * Nothing extra travels on an ordinary run. A whole-round run rebuilds every
   * stone and has no use for the old ones, and this response is not the place
   * to send a payload nobody reads.
   */
  const previousResult =
    lease.run.regenerateDimensionIds.length > 0
      ? await aiAnalysisRunRepo.findLatestResultByRoundId(lease.run.roundId)
      : null;

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
  });
}
