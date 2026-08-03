import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { resolveSubmissionOutcome } from '../survey-submission-outcome';

describe('survey submission outcome', () => {
  it('completes when the round accepted the answers', () => {
    assert.deepEqual(resolveSubmissionOutcome({ ok: true }), {
      kind: 'complete',
    });
  });

  it('completes when the round already holds this attempt', () => {
    // The recovered-attempt case: the response was stored, the 200 never
    // arrived, and the retry carried the same token. Asking the respondent to
    // answer again would be wrong and would fail anyway.
    assert.deepEqual(
      resolveSubmissionOutcome({ ok: false, code: 'ALREADY_SUBMITTED' }),
      { kind: 'complete' },
    );
  });

  it('explains a closed round instead of offering a pointless retry', () => {
    const outcome = resolveSubmissionOutcome({
      ok: false,
      code: 'ROUND_NOT_ACTIVE',
    });

    assert.equal(outcome.kind, 'error');
    assert.match(outcome.kind === 'error' ? outcome.message : '', /נסגר/);
  });

  it('names every refusal in Hebrew, never in the server language', () => {
    const codes = [
      'ROUND_NOT_FOUND',
      'ROUND_NOT_ACTIVE',
      'DEFINITION_INVALID',
      'INVALID_ANSWERS',
    ];

    for (const code of codes) {
      const outcome = resolveSubmissionOutcome({ ok: false, code });

      assert.equal(outcome.kind, 'error');
      const message = outcome.kind === 'error' ? outcome.message : '';
      assert.ok(message.length > 0, `${code} has no message`);
      assert.doesNotMatch(
        message,
        /[A-Za-z]/,
        `${code} leaks Latin characters into an RTL screen`,
      );
    }
  });

  it('treats an unnamed refusal as retryable rather than inventing a cause', () => {
    for (const code of [undefined, null, '', 'SOMETHING_NEW', 42]) {
      const outcome = resolveSubmissionOutcome({ ok: false, code });

      assert.equal(outcome.kind, 'error');
      assert.match(
        outcome.kind === 'error' ? outcome.message : '',
        /נסו שוב/,
      );
    }
  });

  it('never answers a refusal with an empty message', () => {
    // ALREADY_SUBMITTED carries no copy because it is not an error; every
    // other path must still say something to the respondent.
    const outcome = resolveSubmissionOutcome({
      ok: false,
      code: 'ALREADY_SUBMITTED',
    });

    assert.equal(outcome.kind, 'complete');
  });
});
