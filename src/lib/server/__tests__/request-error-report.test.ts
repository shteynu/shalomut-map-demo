import assert from 'node:assert/strict';
import test from 'node:test';
import {
  describeRequestError,
  reportRequestError,
  setRequestErrorSinkForTests,
  type RequestErrorRecord,
} from '../request-error-report';

/**
 * The error screen offers a manager a digest and asks them to pass it to
 * support. These tests are about the other end of that sentence being real:
 * the digest has to reach the log, and the log has to survive the throws that
 * are not `Error` at all, because those are the failures worth reading.
 */

test('the digest a manager reads is the digest in the log', () => {
  const error = Object.assign(new Error('connect ECONNREFUSED'), {
    digest: '3820149178',
  });

  const record = describeRequestError(error, {
    path: '/round',
    method: 'GET',
    routerKind: 'App Router',
    routeType: 'render',
  });

  assert.strictEqual(record.digest, '3820149178');
  assert.strictEqual(record.name, 'Error');
  assert.strictEqual(record.message, 'connect ECONNREFUSED');
  assert.strictEqual(record.path, '/round');
  assert.ok(record.stack, 'the stack belongs in the log, never on the screen');
});

test('a throw that is not an Error still produces a report', () => {
  for (const thrown of ['just a string', 42, null, undefined, { code: 'X' }]) {
    const record = describeRequestError(thrown);

    assert.strictEqual(record.digest, undefined);
    assert.strictEqual(record.stack, undefined);
    assert.ok(
      record.message.length > 0,
      `a ${typeof thrown} throw must not report an empty failure`,
    );
  }
});

test('every line carries the marker a sink selects on', () => {
  const written: RequestErrorRecord[] = [];
  setRequestErrorSinkForTests((record) => written.push(record));

  try {
    reportRequestError(new Error('boom'), { path: '/api/rounds' });
  } finally {
    setRequestErrorSinkForTests(null);
  }

  assert.strictEqual(written.length, 1);
  assert.strictEqual(written[0].observability, 'shalomut_request_error');
});

test('the default sink writes one parseable line', () => {
  const lines: string[] = [];
  const original = console.error;
  console.error = (line: unknown) => {
    lines.push(String(line));
  };

  try {
    reportRequestError(new Error('boom'), { path: '/api/rounds' });
  } finally {
    console.error = original;
  }

  assert.strictEqual(lines.length, 1);
  // A log a human greps and a sink parses are the same line, or one of them is
  // being maintained by nobody.
  const parsed = JSON.parse(lines[0]) as RequestErrorRecord;
  assert.strictEqual(parsed.observability, 'shalomut_request_error');
  assert.strictEqual(parsed.path, '/api/rounds');
});
