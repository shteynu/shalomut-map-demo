import assert from 'node:assert';
import test, { afterEach } from 'node:test';
import { POST as suggestQuestion } from '../manager/question-suggestion/route';
import { resolveAiServiceEndpoint } from '@/lib/server/request-question-suggestion';
import { surveyInstrument } from '@/lib/shalomut-source';

/**
 * The builder's question library covers three dimensions of eight, so a manager
 * writing a round about the other five has to compose every line alone. This
 * route asks the AI service for a draft.
 *
 * What matters more than the happy path: the label. The builder shows a manager
 * whether the text in front of them was written by a model or came from the
 * template library, and it may only say the former when the model answered.
 */

const SUGGESTED_ITEM = 'אני מרגישה שיש לי מסגרת ברורה לתכנון השבוע הקרוב.';

const realFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = realFetch;
  delete process.env.AI_SERVICE_URL;
  delete process.env.AI_WEBHOOK_SECRET;
});

function stubFetch(
  handler: (url: string, init: RequestInit) => Response | Promise<Response>,
) {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  globalThis.fetch = (async (input: string | URL, init: RequestInit = {}) => {
    const url = typeof input === 'string' ? input : input.toString();
    calls.push({ url, init });
    return handler(url, init);
  }) as typeof fetch;
  return calls;
}

function suggestionRequest(body: unknown) {
  return new Request('http://localhost/api/manager/question-suggestion', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

test('a model-written item comes back labelled as AI', async () => {
  process.env.AI_SERVICE_URL = 'https://ai.example/api/v1/webhook/events';
  process.env.AI_WEBHOOK_SECRET = 'webhook-secret';
  const calls = stubFetch(
    () =>
      new Response(
        JSON.stringify({
          dimensionId: 'certainty',
          dimensionNameHebrew: 'ודאות',
          questionText: SUGGESTED_ITEM,
          attempts: 1,
          source: 'llm',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
  );

  const response = await suggestQuestion(
    suggestionRequest({
      dimensionId: 'certainty',
      existingTexts: ['אני יודעת מה מצפים ממני.'],
    }),
  );
  const body = await response.json();

  assert.strictEqual(response.status, 200);
  assert.deepStrictEqual(body, {
    dimensionId: 'certainty',
    questionText: SUGGESTED_ITEM,
    source: 'ai',
    attempts: 1,
  });

  // The suggestion endpoint of the AI service, not its webhook, and carrying
  // the shared secret the service expects.
  assert.strictEqual(calls.length, 1);
  assert.strictEqual(calls[0].url, 'https://ai.example/api/v1/questions/suggest');
  assert.strictEqual(
    (calls[0].init.headers as Record<string, string>).Authorization,
    'Bearer webhook-secret',
  );
  assert.deepStrictEqual(JSON.parse(calls[0].init.body as string), {
    dimensionId: 'certainty',
    existingTexts: ['אני יודעת מה מצפים ממני.'],
  });
});

test('the endpoint is derived from the webhook URL, so no second variable can go missing', () => {
  process.env.AI_SERVICE_URL = 'https://ai.example/api/v1/webhook/events';
  assert.strictEqual(
    resolveAiServiceEndpoint('/api/v1/questions/suggest'),
    'https://ai.example/api/v1/questions/suggest',
  );

  delete process.env.AI_SERVICE_URL;
  assert.strictEqual(
    resolveAiServiceEndpoint('/api/v1/questions/suggest'),
    'http://localhost:8000/api/v1/questions/suggest',
  );

  process.env.AI_SERVICE_URL = 'not-a-url';
  assert.strictEqual(
    resolveAiServiceEndpoint('/api/v1/questions/suggest'),
    'http://localhost:8000/api/v1/questions/suggest',
  );
});

test('an unavailable service is reported, never dressed as a suggestion', async () => {
  stubFetch(
    () =>
      new Response(JSON.stringify({ detail: 'unavailable: http_429' }), {
        status: 503,
      }),
  );

  const response = await suggestQuestion(
    suggestionRequest({ dimensionId: 'certainty' }),
  );
  const body = await response.json();

  assert.strictEqual(response.status, 503);
  assert.strictEqual(body.reason, 'upstream_error');
  assert.strictEqual(body.upstreamStatus, 503);
  assert.ok(/[֐-׿]/u.test(body.error), 'the manager reads Hebrew');
  assert.strictEqual(body.questionText, undefined);
});

test('a 200 that carries no model-written item is not a suggestion', async () => {
  // The one case worth guarding: a service that answers, but with copy it wrote
  // itself. Accepting it would put the AI label on text no model produced.
  stubFetch(
    () =>
      new Response(
        JSON.stringify({
          questionText: SUGGESTED_ITEM,
          source: 'deterministic_fallback',
        }),
        { status: 200 },
      ),
  );

  const response = await suggestQuestion(
    suggestionRequest({ dimensionId: 'certainty' }),
  );
  const body = await response.json();

  assert.strictEqual(response.status, 503);
  assert.strictEqual(body.reason, 'invalid_response');
});

test('an empty item is refused even with the right label', async () => {
  stubFetch(
    () =>
      new Response(JSON.stringify({ questionText: '   ', source: 'llm' }), {
        status: 200,
      }),
  );

  const response = await suggestQuestion(
    suggestionRequest({ dimensionId: 'certainty' }),
  );

  assert.strictEqual(response.status, 503);
});

test('a network failure is reported as unavailable rather than thrown', async () => {
  stubFetch(() => {
    throw new Error('connect ECONNREFUSED');
  });

  const response = await suggestQuestion(
    suggestionRequest({ dimensionId: 'certainty' }),
  );
  const body = await response.json();

  assert.strictEqual(response.status, 503);
  assert.strictEqual(body.reason, 'unavailable');
});

test('a suggestion belongs to one of the eight dimensions', async () => {
  const calls = stubFetch(
    () => new Response(JSON.stringify({}), { status: 200 }),
  );

  for (const payload of [
    { dimensionId: 'not-a-dimension' },
    { dimensionId: '' },
    {},
    { dimensionId: 42 },
  ]) {
    const response = await suggestQuestion(suggestionRequest(payload));
    assert.strictEqual(response.status, 400, JSON.stringify(payload));
  }

  // A rejected dimension never reaches the provider.
  assert.strictEqual(calls.length, 0);
  assert.strictEqual(surveyInstrument.dimensions.length, 8);
});

test('every canonical dimension is accepted', async () => {
  stubFetch(
    () =>
      new Response(
        JSON.stringify({ questionText: SUGGESTED_ITEM, source: 'llm' }),
        { status: 200 },
      ),
  );

  for (const dimension of surveyInstrument.dimensions) {
    const response = await suggestQuestion(
      suggestionRequest({ dimensionId: dimension.id }),
    );
    assert.strictEqual(response.status, 200, dimension.id);
    const body = await response.json();
    assert.strictEqual(body.dimensionId, dimension.id);
    assert.strictEqual(body.source, 'ai');
  }
});

test('the draft sent with the request is bounded and cleaned', async () => {
  const calls = stubFetch(
    () =>
      new Response(
        JSON.stringify({ questionText: SUGGESTED_ITEM, source: 'llm' }),
        { status: 200 },
      ),
  );

  await suggestQuestion(
    suggestionRequest({
      dimensionId: 'balance',
      existingTexts: [
        ...Array.from({ length: 60 }, (_, index) => `היגד ${index}.`),
        '   ',
        7,
        null,
      ],
    }),
  );

  const sent = JSON.parse(calls[0].init.body as string);
  assert.strictEqual(sent.existingTexts.length, 40);
  assert.ok(sent.existingTexts.every((text: string) => text.trim().length > 0));
});
