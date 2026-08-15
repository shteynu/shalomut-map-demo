import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { reportSubmissionDelivery } from '../survey-delivery-report';

/**
 * The client half. Its whole contract is negative: never disturb the
 * respondent, never report the ordinary case, and never let a failure of the
 * report become a failure of anything else.
 */

describe('survey delivery report', () => {
  it('says how many attempts a recovered submission took', async () => {
    const calls: { url: string; body: unknown }[] = [];

    await reportSubmissionDelivery({
      shareCode: 'SHALOM-7K2M9QT4',
      outcome: 'recovered',
      attempts: 2,
      send: (async (url: string, init: RequestInit) => {
        calls.push({ url, body: JSON.parse(String(init.body)) });
        return new Response(null, { status: 204 });
      }) as unknown as typeof fetch,
    });

    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, '/api/survey/SHALOM-7K2M9QT4/delivery');
    assert.deepEqual(calls[0].body, { outcome: 'recovered', attempts: 2 });
  });

  it('sends nothing when the first attempt delivered', async () => {
    let called = false;

    await reportSubmissionDelivery({
      shareCode: 'SHALOM-7K2M9QT4',
      outcome: 'recovered',
      attempts: 1,
      send: (async () => {
        called = true;
        return new Response(null, { status: 204 });
      }) as unknown as typeof fetch,
    });

    assert.equal(called, false, 'the ordinary submission paid for a beacon');
  });

  it('escapes the share code it is given', async () => {
    const urls: string[] = [];

    await reportSubmissionDelivery({
      shareCode: 'A B/../delivery',
      outcome: 'lost',
      attempts: 3,
      send: (async (url: string) => {
        urls.push(url);
        return new Response(null, { status: 204 });
      }) as unknown as typeof fetch,
    });

    assert.equal(urls[0], '/api/survey/A%20B%2F..%2Fdelivery/delivery');
  });

  it('swallows its own failure', async () => {
    // The report is about a failure the respondent has already survived. If
    // this ever rejects, the caller's `catch` would show a network error on a
    // submission that was stored.
    await reportSubmissionDelivery({
      shareCode: 'SHALOM-7K2M9QT4',
      outcome: 'lost',
      attempts: 3,
      send: (async () => {
        throw new TypeError('Failed to fetch');
      }) as unknown as typeof fetch,
    });
  });
});
