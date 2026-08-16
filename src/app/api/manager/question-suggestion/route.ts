import { NextResponse } from 'next/server';
import { requestQuestionSuggestion } from '@/lib/server/request-question-suggestion';
import { surveyInstrument } from '@/lib/shalomut-source';

/**
 * A manager asks for one more questionnaire item for one dimension.
 *
 * Manager-only, like every route under `/api/manager`: the middleware answers
 * `401` before this handler runs. Nothing here reads or writes a round — the
 * request is about a draft in the browser, so it needs no round id, no
 * repository and no durable-write guard.
 *
 * The response says where the text came from. A suggestion may only be labelled
 * `ai` when the model actually wrote it; when the service cannot answer, this
 * route says so and the builder falls back to its template library under the
 * template's own label. That is the same rule the analysis follows: a fallback
 * never wears the label of the model.
 */

const MAX_EXISTING_TEXTS = 40;

const dimensionIds = new Set(
  surveyInstrument.dimensions.map((dimension) => dimension.id as string),
);

/** Both text lists are bounded the same way; only their meaning differs. */
function parseTexts(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((text): text is string => typeof text === 'string')
    .map((text) => text.trim())
    .filter(Boolean)
    .slice(0, MAX_EXISTING_TEXTS);
}

export async function POST(request: Request) {
  const payload: unknown = await request.json().catch(() => null);

  if (!payload || typeof payload !== 'object') {
    return NextResponse.json(
      { error: 'Invalid question suggestion payload.' },
      { status: 400 },
    );
  }

  const { dimensionId, existingTexts, styleTexts } = payload as Record<
    string,
    unknown
  >;

  if (typeof dimensionId !== 'string' || !dimensionIds.has(dimensionId)) {
    return NextResponse.json(
      { error: 'A question suggestion needs one of the eight dimensions.' },
      { status: 400 },
    );
  }

  const result = await requestQuestionSuggestion({
    dimensionId,
    existingTexts: parseTexts(existingTexts),
    // The draft's items in this dimension, shown to the model as the style to
    // match. An absent list is honest — the AI service shows no examples rather
    // than substituting a frozen contract's.
    styleTexts: parseTexts(styleTexts),
  });

  if (!result.ok) {
    // One status for the manager and one for the log: the screen says the
    // suggestion service is unavailable in Hebrew and offers the template,
    // while `reason` keeps the distinction between a timeout, a refusal and a
    // service that is down.
    return NextResponse.json(
      {
        error: 'הצעת שאלה מהבינה המלאכותית אינה זמינה כרגע.',
        reason: result.status,
        upstreamStatus: result.upstreamStatus,
      },
      { status: 503 },
    );
  }

  return NextResponse.json(result.suggestion);
}
