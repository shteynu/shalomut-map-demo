import { NextResponse } from 'next/server';

import { resolveCoreRepositories } from '@/lib/composition-root';
import { assessAiAnalysisQueue } from '@/lib/server/ai-analysis-queue-health';
import { AI_ANALYSIS_QUEUE_STALL_AFTER_MS } from '@/lib/server/ai-analysis-worker';
import { getDurableWriteGuardResponse } from '@/lib/server/durable-write-guard';
import { hasConfiguredSharedSecret } from '@/lib/server/shared-secret';

/**
 * How deep the queue is and how long its oldest work has waited.
 *
 * The numbers behind the public verdict on `/api/health/ai-queue`, and they are
 * behind a secret for the reason the counts on the AI service's
 * `/api/v1/provider-health` are: a depth is a statement about how many schools
 * are measuring right now, which is nobody's business anonymously even though
 * it names none of them. Nothing here identifies a round, a school or a
 * respondent — the answer is four numbers and a word.
 *
 * `GET`, and it writes nothing. The sweep that marks exhausted leases belongs
 * to `claimNext`, where a worker is doing something about them; a reader that
 * repaired what it found would be a second claimer racing the first, and this
 * is built to be safe to call once a minute forever.
 */
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  if (!hasConfiguredSharedSecret(request, 'AI_CALLBACK_SECRET')) {
    return NextResponse.json({ error: 'Unauthorized worker' }, { status: 401 });
  }

  const unavailable = getDurableWriteGuardResponse();
  if (unavailable) return unavailable;

  const { aiAnalysisRunRepo } = resolveCoreRepositories();
  const snapshot = await aiAnalysisRunRepo.readQueueSnapshot();
  const assessment = assessAiAnalysisQueue(snapshot);

  return NextResponse.json({
    status: assessment.status,
    /** Runs a worker could take right now: queued, plus abandoned running ones. */
    waitingCount: assessment.waitingCount,
    /** Runs under a live lease — the proof a consumer is alive. */
    leasedCount: assessment.leasedCount,
    /** Null when nothing is waiting, which is not the same as zero. */
    oldestWaitSeconds: assessment.oldestWaitSeconds,
    /*
     * Published so the verdict can be checked rather than trusted. A reader who
     * sees `draining` at nine minutes and wants to know why can subtract.
     */
    stallAfterSeconds: Math.floor(AI_ANALYSIS_QUEUE_STALL_AFTER_MS / 1000),
    observedAt: snapshot.observedAt.toISOString(),
  });
}
