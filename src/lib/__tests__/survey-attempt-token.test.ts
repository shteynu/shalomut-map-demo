import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { describe, it } from 'node:test';
import {
  createAttemptTokenSource,
  hashAnonymousToken,
} from '../survey-attempt-token';

describe('survey attempt token', () => {
  it('keeps one token for the whole attempt so a retry is de-duplicated', () => {
    const source = createAttemptTokenSource();

    assert.equal(source.current(), source.current());
  });

  it('issues a new token after a reset so another response is accepted', () => {
    const source = createAttemptTokenSource();
    const first = source.current();

    source.reset();

    assert.notEqual(source.current(), first);
  });

  it('does not carry a token across attempts on the same device', () => {
    // Regression: the token used to be persisted in localStorage per share
    // code, so a second visit reused it and the submit endpoint answered
    // "You have already submitted a response for this survey round."
    const first = createAttemptTokenSource().current();
    const second = createAttemptTokenSource().current();

    assert.notEqual(first, second);
  });

  it('creates the token lazily, only when the attempt submits', () => {
    let created = 0;
    const source = createAttemptTokenSource(() => `token-${++created}`);

    assert.equal(created, 0);
    assert.equal(source.current(), 'token-1');
    assert.equal(created, 1);
  });

  it('adopts a token recovered from a draft so a retry is still one attempt', () => {
    const source = createAttemptTokenSource();
    const recovered = 'a2f0a5f4-0a5a-4a41-9a0f-4f4f8f4a1a11';

    assert.equal(source.restore(recovered), true);
    assert.equal(source.current(), recovered);
  });

  it('refuses a token that could not have been issued', () => {
    for (const candidate of [undefined, null, '', '   ', 42, {}]) {
      const source = createAttemptTokenSource(() => 'fresh');

      assert.equal(source.restore(candidate), false);
      assert.equal(source.current(), 'fresh');
    }
  });

  it('issues a new token after a reset even if one was restored', () => {
    const source = createAttemptTokenSource();
    source.restore('a2f0a5f4-0a5a-4a41-9a0f-4f4f8f4a1a11');

    source.reset();

    assert.notEqual(
      source.current(),
      'a2f0a5f4-0a5a-4a41-9a0f-4f4f8f4a1a11',
    );
  });

  it('hashes the token with SHA-256 and never sends it raw', async () => {
    const token = 'a2f0a5f4-0a5a-4a41-9a0f-4f4f8f4a1a11';

    assert.equal(
      await hashAnonymousToken(token),
      createHash('sha256').update(token).digest('hex'),
    );
  });

  /**
   * Both write endpoints require `^[0-9a-f]{64}$` — the attempt endpoint always
   * did, the submit endpoint since 2026-08-22. Neither of them can see this
   * function, so this is the test that says the shape the client produces is
   * the shape the server accepts. Without it, tightening the server is a change
   * whose only witness is a test fixture nobody generates.
   */
  it('produces the shape both write endpoints require', async () => {
    for (const token of [
      'a2f0a5f4-0a5a-4a41-9a0f-4f4f8f4a1a11',
      '',
      ' ',
      'שלום',
      'x'.repeat(200),
    ]) {
      assert.match(await hashAnonymousToken(token), /^[0-9a-f]{64}$/, token);
    }
  });
});
