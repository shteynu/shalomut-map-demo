import { NextResponse } from 'next/server';

import { resolveCoreRepositories } from '@/lib/composition-root';
import { getDurableWriteGuardResponse } from '@/lib/server/durable-write-guard';
import { assessObservability } from '@/lib/server/observability-alerts';
import { hasConfiguredSharedSecret } from '@/lib/server/shared-secret';

/**
 * The numbers behind the verdict on `/api/health/observability`.
 *
 * Behind the shared secret for the reason the queue's depth is: a count of
 * failed analyses or lost submissions is a statement about how much measuring
 * is happening and how badly it is going, which is nobody's business
 * anonymously even though it names no school. Each reading carries its own
 * window and limit so the verdict can be checked rather than trusted — a reader
 * who sees `ok` at four failures and a limit of three can subtract and find
 * that three of them fell outside the window.
 *
 * What this deliberately does not return is any event's contents. The stored
 * request errors carry messages and stacks, and in a development build a
 * message can hold query text or row contents — which is why the error screen
 * shows a digest instead. Those rows are reachable with the database and
 * through no endpoint.
 *
 * `GET`, and it writes nothing. The retention sweep belongs to the public
 * sibling, which is the endpoint something actually calls on a schedule.
 */
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  if (!hasConfiguredSharedSecret(request, 'AI_CALLBACK_SECRET')) {
    return NextResponse.json({ error: 'Unauthorized worker' }, { status: 401 });
  }

  const unavailable = getDurableWriteGuardResponse();
  if (unavailable) return unavailable;

  const { operationalEventRepo } = resolveCoreRepositories();
  const assessment = await assessObservability(operationalEventRepo);

  return NextResponse.json({
    status: assessment.status,
    alerting: assessment.alerting,
    readings: assessment.readings,
    observedAt: assessment.observedAt.toISOString(),
  });
}
