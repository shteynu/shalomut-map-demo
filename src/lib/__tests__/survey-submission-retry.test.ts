import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { sendWithRetry } from '../survey-submission-retry';

/** No real waiting: the point under test is the policy, not the clock. */
const noSleep = async () => {};

describe('survey submission retry', () => {
  it('sends once when the first attempt answers', async () => {
    let calls = 0;
    const result = await sendWithRetry({
      send: async () => {
        calls += 1;
        return 'ok';
      },
      sleep: noSleep,
    });

    assert.equal(result, 'ok');
    assert.equal(calls, 1);
  });

  it('recovers the deployed failure: the first send is lost, the second lands', async () => {
    // This is the shape reproduced on 2026-08-15 — the request returns nothing
    // and no invocation reaches the function, so the retry is the first one the
    // server ever sees.
    let calls = 0;
    const result = await sendWithRetry({
      send: async () => {
        calls += 1;
        if (calls === 1) throw new TypeError('Failed to fetch');
        return 'stored';
      },
      sleep: noSleep,
    });

    assert.equal(result, 'stored');
    assert.equal(calls, 2);
  });

  it('gives up after the configured number of attempts', async () => {
    let calls = 0;
    await assert.rejects(
      sendWithRetry({
        send: async () => {
          calls += 1;
          throw new Error(`attempt ${calls}`);
        },
        sleep: noSleep,
      }),
      /attempt 3/,
    );

    // Three, not more: a respondent is waiting, and the last error is the one
    // that describes where they actually are.
    assert.equal(calls, 3);
  });

  it('does not retry a server that answered, whatever it answered', async () => {
    // A refusal is not a lost request. `resolveSubmissionOutcome` names every
    // one of these, and re-sending would turn one refusal into three.
    let calls = 0;
    const response = await sendWithRetry({
      send: async () => {
        calls += 1;
        return { ok: false, status: 400 };
      },
      sleep: noSleep,
    });

    assert.deepEqual(response, { ok: false, status: 400 });
    assert.equal(calls, 1);
  });

  it('announces each retry and never announces the first attempt', async () => {
    const announced: number[] = [];
    let calls = 0;

    await sendWithRetry({
      send: async () => {
        calls += 1;
        if (calls < 3) throw new Error('lost');
        return 'stored';
      },
      sleep: noSleep,
      onRetry: (attempt) => announced.push(attempt),
    });

    assert.deepEqual(announced, [2, 3]);
  });

  it('waits between attempts, and waits longer the second time', async () => {
    const waited: number[] = [];
    let calls = 0;

    await sendWithRetry({
      send: async () => {
        calls += 1;
        if (calls < 3) throw new Error('lost');
        return 'stored';
      },
      sleep: async (ms) => {
        waited.push(ms);
      },
    });

    assert.deepEqual(waited, [1_000, 3_000]);
  });

  it('repeats the last wait rather than looping tightly on a longer policy', async () => {
    // Raising `attempts` without extending the table must not silently turn the
    // tail of the policy into no wait at all.
    const waited: number[] = [];

    await assert.rejects(
      sendWithRetry({
        attempts: 5,
        send: async () => {
          throw new Error('lost');
        },
        sleep: async (ms) => {
          waited.push(ms);
        },
      }),
    );

    assert.deepEqual(waited, [1_000, 3_000, 3_000, 3_000]);
  });
});
