import assert from 'node:assert/strict';
import test from 'node:test';
import {
  describeRequestError,
  reportRequestError,
  reportRouteFailure,
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

test('a failure a handler caught itself still reaches the report', () => {
  // `onRequestError` only fires for what escapes a handler, so before
  // `reportRouteFailure` existed every `catch` in a route was invisible here —
  // the only trace was whatever the handler put in the response body, which is
  // the thing the 2026-08-21 audit asked to stop doing. Taking the message out
  // of the body without this would have left no trace at all.
  const written: RequestErrorRecord[] = [];
  setRequestErrorSinkForTests((record) => written.push(record));

  try {
    reportRouteFailure(
      new Error('duplicate key value violates unique constraint'),
      new Request('http://localhost/api/rounds/r-1/goals?round=r-1', {
        method: 'POST',
      }),
    );
  } finally {
    setRequestErrorSinkForTests(null);
  }

  assert.equal(written.length, 1);
  const [record] = written;
  // The detail the body no longer carries, in the one place that should have it.
  assert.match(record.message, /unique constraint/);
  // The path without the query: a share code or a round id is enough to find
  // the route, and a query string is where identifiers travel.
  assert.equal(record.path, '/api/rounds/r-1/goals');
  assert.equal(record.method, 'POST');
  assert.equal(record.routeType, 'route');
});

test('a report is still made when there is no request to describe', () => {
  // Some handlers take an optional `Request`. A report that threw while
  // describing a failure would replace the failure with itself.
  const written: RequestErrorRecord[] = [];
  setRequestErrorSinkForTests((record) => written.push(record));

  try {
    reportRouteFailure('a thrown string', undefined);
    reportRouteFailure(new Error('bad url'), { url: 'not a url', method: 'GET' } as Request);
  } finally {
    setRequestErrorSinkForTests(null);
  }

  assert.equal(written.length, 2);
  assert.equal(written[0].message, 'a thrown string');
  assert.equal(written[0].path, undefined);
  // The unparseable URL costs the path and nothing else.
  assert.equal(written[1].path, undefined);
  assert.equal(written[1].method, 'GET');
});
