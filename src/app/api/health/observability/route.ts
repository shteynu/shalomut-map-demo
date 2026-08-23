import { NextResponse } from 'next/server';

import { resolveCoreRepositories } from '@/lib/composition-root';
import { resolveDeploymentCommit } from '@/lib/deployment-commit';
import { isDurableWriteUnavailable } from '@/lib/server/durable-write-guard';
import { assessObservability } from '@/lib/server/observability-alerts';
import { scheduleObservabilityWrite } from '@/lib/server/observability-sinks';
import { OPERATIONAL_EVENT_RETENTION_DAYS } from '@/lib/repositories/interfaces';

/**
 * Whether any of the product's counters has crossed the line — as a verdict,
 * for a monitor.
 *
 * A sibling of `/api/health` and `/api/health/ai-queue`, for the reason those
 * two are siblings of each other: `/api/health` touches no database so that it
 * keeps answering when the database is what broke, and each endpoint answers
 * one question. This one answers "is anything wrong that nobody has noticed",
 * which is the whole of the 2026-08-21 audit finding about counters that reach
 * an uncollected stdout.
 *
 * **Anonymous, and it publishes names but no numbers.** A free uptime monitor
 * cannot send a header, and an alert nobody can watch is the failure this
 * exists to end. The breached threshold ids travel in the body because they are
 * what makes the monitor's email actionable — `submission_lost` sends someone
 * to a different place than `contract_rejected` — and an id is a fact about
 * this deployment's health, not about a school. The counts, the ratios and the
 * windows stay behind `AI_CALLBACK_SECRET` on `/api/observability`, the same
 * split the queue makes.
 *
 * It sweeps expired rows on the way past. This is the one endpoint the
 * deployment is called on a schedule, and the project owns no scheduler; the
 * sweep is a single indexed delete, is idempotent, runs after the response and
 * cannot change the verdict it just gave.
 */
export const dynamic = 'force-dynamic';

export async function GET() {
  const commit = resolveDeploymentCommit();

  /*
   * No database, no verdict. `ok` here would be the exact lie this endpoint
   * exists to prevent: a deployment recording nothing and a deployment with
   * nothing to record look identical from outside and mean opposite things.
   */
  if (isDurableWriteUnavailable()) {
    return NextResponse.json(
      { status: 'unknown', commit, reason: 'no_durable_storage' },
      { status: 503 },
    );
  }

  try {
    const { operationalEventRepo } = resolveCoreRepositories();
    const assessment = await assessObservability(operationalEventRepo);

    scheduleObservabilityWrite(async () => {
      const cutoff = new Date(
        Date.now() - OPERATIONAL_EVENT_RETENTION_DAYS * 24 * 60 * 60_000,
      );
      await operationalEventRepo.prune(cutoff);
    });

    return NextResponse.json(
      { status: assessment.status, alerting: assessment.alerting, commit },
      { status: assessment.status === 'alerting' ? 503 : 200 },
    );
  } catch {
    /*
     * The read failed. `unknown` rather than `ok`, and a 503 either way: both
     * deserve someone's attention, and telling them apart is the first thing
     * whoever arrives needs. The error is not echoed — an anonymous caller
     * learning why a database read failed learns where to push.
     */
    return NextResponse.json(
      { status: 'unknown', commit, reason: 'events_unreadable' },
      { status: 503 },
    );
  }
}
