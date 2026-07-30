import { NextResponse } from 'next/server';
import { getRepositories } from '@/lib/repositories';
import {
  isValidFailureCode,
  isValidLeaseToken,
} from '@/lib/server/ai-analysis-worker';
import { getDurableWriteGuardResponse } from '@/lib/server/durable-write-guard';
import { hasConfiguredSharedSecret } from '@/lib/server/shared-secret';
import { recordAiJobCompleted } from '@/lib/server/ai-operational-metrics';

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
  const failureCode =
    body && typeof body === 'object' && 'failureCode' in body
      ? (body as { failureCode?: unknown }).failureCode
      : undefined;
  if (!isValidLeaseToken(leaseToken) || !isValidFailureCode(failureCode)) {
    return NextResponse.json(
      { error: 'Invalid lease token or failure code' },
      { status: 400 },
    );
  }

  const { aiAnalysisRunRepo } = getRepositories();
  const outcome = await aiAnalysisRunRepo.finish(runId, {
    state: 'failed',
    failureCode,
    leaseToken,
  });
  if (outcome === 'not_found') {
    return NextResponse.json({ error: 'Analysis run not found' }, { status: 404 });
  }
  if (outcome === 'stale') {
    return NextResponse.json(
      { error: 'The analysis run lease is stale or already superseded' },
      { status: 409 },
    );
  }
  if (outcome === 'transitioned') {
    const completed = await aiAnalysisRunRepo.findById(runId);
    if (completed) recordAiJobCompleted(completed);
  }
  return NextResponse.json({ status: 'failed', runId, duplicate: outcome === 'duplicate' });
}
