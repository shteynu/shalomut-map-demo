import { createSharedSecretHeaders } from '@/lib/server/shared-secret';

/**
 * One drafted questionnaire item, asked for by a manager building a round.
 *
 * Separate from `trigger-ai-analytics.ts` because it is a different kind of
 * call: that one hands over a round and waits for an acknowledgement, this one
 * waits for the answer itself. Nothing about a round travels here — no
 * aggregates, no responses, no share code — because a questionnaire is written
 * before anyone has answered it.
 */
export interface QuestionSuggestion {
  dimensionId: string;
  questionText: string;
  source: 'ai';
  attempts: number;
}

export type QuestionSuggestionResult =
  | { ok: true; suggestion: QuestionSuggestion }
  | {
      ok: false;
      status: 'upstream_error' | 'timeout' | 'unavailable' | 'invalid_response';
      upstreamStatus?: number;
      error?: string;
    };

const SUGGESTION_PATH = '/api/v1/questions/suggest';

/**
 * The AI service endpoint for a path other than the webhook's.
 *
 * `AI_SERVICE_URL` holds the full webhook URL rather than an origin, and it is
 * already set in both environments. Resolving an absolute path against it takes
 * the origin and drops the webhook path, so a second endpoint needs no second
 * variable — and a variable that exists nowhere in `render.yaml` or a dashboard
 * is exactly how a value gets lost.
 */
export function resolveAiServiceEndpoint(path: string): string {
  const configured =
    process.env.AI_SERVICE_URL || 'http://localhost:8000/api/v1/webhook/events';

  try {
    return new URL(path, configured).toString();
  } catch {
    return `http://localhost:8000${path}`;
  }
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export async function requestQuestionSuggestion(input: {
  dimensionId: string;
  existingTexts?: string[];
  /** The draft's own items in this dimension: the style the model matches. */
  styleTexts?: string[];
}): Promise<QuestionSuggestionResult> {
  const endpoint = resolveAiServiceEndpoint(SUGGESTION_PATH);
  // A manager is watching a button, and one item is one provider request: long
  // enough to survive a paced queue turn and a retry, short enough that a dead
  // service does not hold the screen. It used to be described as shorter than
  // the analytics dispatch timeout; that timeout is gone, because closing a
  // round enqueues a job instead of dispatching a request.
  const timeoutMs = Number(process.env.AI_SUGGESTION_TIMEOUT_MS) || 45_000;

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...createSharedSecretHeaders('AI_WEBHOOK_SECRET'),
      },
      body: JSON.stringify({
        dimensionId: input.dimensionId,
        existingTexts: input.existingTexts ?? [],
        styleTexts: input.styleTexts ?? [],
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!response.ok) {
      return {
        ok: false,
        status: 'upstream_error',
        upstreamStatus: response.status,
      };
    }

    const body: unknown = await response.json().catch(() => null);
    if (
      !body ||
      typeof body !== 'object' ||
      !isNonEmptyString((body as Record<string, unknown>).questionText) ||
      (body as Record<string, unknown>).source !== 'llm'
    ) {
      // A 200 that carries no model-written item is not a suggestion. Failing
      // here keeps the label honest: the UI marks what it shows as AI or as
      // template, and it may only say AI when the model actually answered.
      return { ok: false, status: 'invalid_response' };
    }

    const payload = body as Record<string, unknown>;
    return {
      ok: true,
      suggestion: {
        dimensionId: input.dimensionId,
        questionText: (payload.questionText as string).trim(),
        source: 'ai',
        attempts:
          typeof payload.attempts === 'number' && Number.isFinite(payload.attempts)
            ? payload.attempts
            : 0,
      },
    };
  } catch (error: unknown) {
    if ((error as { name?: string })?.name === 'TimeoutError') {
      return {
        ok: false,
        status: 'timeout',
        error: `AI service did not answer within ${timeoutMs}ms`,
      };
    }

    return {
      ok: false,
      status: 'unavailable',
      error:
        error instanceof Error
          ? `AI service unavailable: ${error.message}`
          : 'AI service unavailable',
    };
  }
}
