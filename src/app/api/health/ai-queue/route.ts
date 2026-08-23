import { NextResponse } from 'next/server';

import { resolveCoreRepositories } from '@/lib/composition-root';
import { resolveDeploymentCommit } from '@/lib/deployment-commit';
import { assessAiAnalysisQueue } from '@/lib/server/ai-analysis-queue-health';
import { isDurableWriteUnavailable } from '@/lib/server/durable-write-guard';

/**
 * Whether the analysis queue is being consumed — as a verdict, for a monitor.
 *
 * A sibling of `/api/health` rather than a field inside it, and the separation
 * is the point twice over. `/api/health` reports configuration and touches no
 * database at all, so it keeps answering when the database is the thing that
 * broke; folding a query into it would take down the endpoint whose job is to
 * report failure. And the two answer different questions — "is this deployment
 * configured?" against "is anybody doing the work?" — which the AI service
 * already splits three ways for the same reason: one shared body is how a
 * change made for one reader quietly breaks another.
 *
 * **Anonymous, and it carries no numbers.** A free uptime monitor cannot send a
 * bearer header, and a detector nobody can watch is the failure this exists to
 * end — the audit of 2026-08-21 found the queue's liveness resting on one
 * external ping with nothing behind it. So the public answer is a verdict and a
 * status code: `503` when the queue has stalled, which any monitor already
 * treats as an alert without being taught anything. How deep the queue is and
 * how long the oldest run has waited say something about a school's activity,
 * so they stay behind `AI_CALLBACK_SECRET` on
 * `/api/ai-analysis-runs/queue` — the same split the AI service makes between
 * `/api/v1/provider-status` and `/api/v1/provider-health`.
 */
export const dynamic = 'force-dynamic';

export async function GET() {
  const commit = resolveDeploymentCommit();

  /*
   * No database, no verdict. Answering `idle` here would be a lie of exactly
   * the kind this endpoint exists to prevent: an empty queue and an unreachable
   * queue look identical from the outside and mean opposite things.
   */
  if (isDurableWriteUnavailable()) {
    return NextResponse.json(
      { status: 'unknown', commit, reason: 'no_durable_storage' },
      { status: 503 },
    );
  }

  try {
    const { aiAnalysisRunRepo } = resolveCoreRepositories();
    const { status } = assessAiAnalysisQueue(
      await aiAnalysisRunRepo.readQueueSnapshot(),
    );

    return NextResponse.json(
      { status, commit },
      { status: status === 'stalled' ? 503 : 200 },
    );
  } catch {
    /*
     * The read itself failed. Reported as `unknown` rather than as a stall:
     * both deserve an alert, and telling them apart is what a person arriving
     * at three in the morning needs first. The error is not echoed — an
     * anonymous caller learning why a database read failed learns where to
     * push.
     */
    return NextResponse.json(
      { status: 'unknown', commit, reason: 'queue_unreadable' },
      { status: 503 },
    );
  }
}
