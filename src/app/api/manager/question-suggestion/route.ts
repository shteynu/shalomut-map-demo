import { NextResponse } from 'next/server';
import { recordQuestionSuggestionOutcome } from '@/lib/server/ai-operational-metrics';
import { requireManagerPermission } from '@/lib/server/manager-permission';
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
 * Administrator-only all the same. It writes nothing, and it spends a paid
 * provider call on behalf of somebody who could not save the questionnaire it
 * drafts for — which makes it a cost with no possible outcome rather than a
 * harmless read.
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
  const permission = requireManagerPermission(request, 'write:question-suggestion');
  if (!permission.ok) return permission.response;

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
    //
    // The same distinction is counted as well as answered. Told to one manager
    // it is a button that did not work; counted, it is the difference between a
    // provider having a bad minute and a feature that has been dead for weeks.
    recordQuestionSuggestionOutcome({
      outcome: 'failed',
      reason: result.status,
      upstreamStatus: result.upstreamStatus,
    });

    return NextResponse.json(
      {
        error: 'הצעת שאלה מהבינה המלאכותית אינה זמינה כרגע.',
        reason: result.status,
        upstreamStatus: result.upstreamStatus,
      },
      { status: 503 },
    );
  }

  // The success side is not optional: a failure count on its own cannot tell a
  // dead provider from a button nobody pressed.
  recordQuestionSuggestionOutcome({
    outcome: 'succeeded',
    attempts: result.suggestion.attempts,
  });

  return NextResponse.json(result.suggestion);
}
