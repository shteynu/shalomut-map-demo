import { NextResponse } from 'next/server';
import { recordSurveySubmissionDelivery } from '@/lib/server/ai-operational-metrics';
import { consumeRateLimit, RATE_LIMITS } from '@/lib/server/rate-limit';

/**
 * How hard it was to deliver one submission.
 *
 * The endpoint loses the first submit after an idle period, upstream of the
 * function — the deployment's logs hold no invocation for the request that
 * died — and `sendWithRetry` now repairs it without the respondent seeing
 * anything. That is right for the respondent and it removed the only witness
 * there was. This route is the witness put back: the client, which is the one
 * process that knows the first attempt threw, says so afterwards.
 *
 * Three properties this must keep, in order of how much they cost if lost:
 *
 * - **It touches no repository.** The report is about the transport, and a
 *   database round-trip here would make it fail in the conditions it exists to
 *   measure. That is also why the metric carries no round.
 * - **It never blocks a respondent.** The client fires it after the outcome is
 *   already decided and does not wait; everything here is swallowed into the
 *   same `204`.
 * - **It is not an oracle.** A share code that does not exist and one that does
 *   are indistinguishable in the reply, exactly as the attempt beacon beside it
 *   is — the code is not even read, because nothing here needs it.
 */
function accepted() {
  return new NextResponse(null, { status: 204 });
}

/**
 * Attempts above this are not a delivery report, they are a caller inventing
 * numbers: `sendWithRetry` runs three attempts, and a label of `"9000"` would
 * make the counter unusable while looking like data.
 */
const MAX_REPORTABLE_ATTEMPTS = 10;

export async function POST(request: Request) {
  try {
    const decision = await consumeRateLimit(
      request.headers,
      RATE_LIMITS.surveyDeliveryReport,
    );
    // Refused the same way as everything else this route refuses. A 429 would
    // be honest and pointless: the client does not read the reply, and a
    // refusal that says nothing keeps every answer from here identical.
    if (!decision.allowed) return accepted();

    const body = (await request.json().catch(() => null)) as {
      outcome?: unknown;
      attempts?: unknown;
    } | null;

    if (!body) return accepted();

    const { outcome, attempts } = body;

    if (outcome !== 'recovered' && outcome !== 'lost') return accepted();

    // A first-attempt delivery is not reportable: it is already counted as a
    // stored response, and accepting one here would let a caller inflate the
    // one number this exists to produce.
    if (
      typeof attempts !== 'number' ||
      !Number.isInteger(attempts) ||
      attempts < 2 ||
      attempts > MAX_REPORTABLE_ATTEMPTS
    ) {
      return accepted();
    }

    recordSurveySubmissionDelivery({ outcome, attempts });

    return accepted();
  } catch (error) {
    console.error(
      'Recording a survey submission delivery failed:',
      error instanceof Error ? error.message : 'unknown error',
    );
    return accepted();
  }
}
