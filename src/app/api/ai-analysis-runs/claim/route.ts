import { NextResponse } from 'next/server';
import { getRepositories } from '@/lib/repositories';
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

  const { aiAnalysisRunRepo } = getRepositories();
  const lease = await aiAnalysisRunRepo.claimNext({
    workerId,
    leaseMs: AI_ANALYSIS_JOB_LEASE_MS,
    maxAttempts: AI_ANALYSIS_JOB_MAX_ATTEMPTS,
  });
  if (!lease) return new Response(null, { status: 204 });
  recordAiJobClaimed(lease.run);

  return NextResponse.json({
    run: {
      id: lease.run.id,
      roundId: lease.run.roundId,
      state: lease.run.state,
      attemptCount: lease.run.attemptCount,
      queuedAt: lease.run.queuedAt.toISOString(),
      startedAt: lease.run.startedAt?.toISOString() ?? null,
      leaseExpiresAt: lease.run.leaseExpiresAt?.toISOString() ?? null,
    },
    leaseToken: lease.leaseToken,
  });
}
