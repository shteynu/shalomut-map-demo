/**
 * The check itself, on sources written to be caught and to be let through.
 *
 * A fitness check that has never failed on purpose is a check nobody knows the
 * shape of, so every rule it enforces is exercised from both sides here —
 * including the gap it cannot see, which is asserted rather than left for
 * somebody to discover.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  argumentRegions,
  findLeaks,
  stripTextAndComments,
} from './check-error-bodies.mjs';

test('the raw message in a body is caught', () => {
  const source = `
    } catch (error) {
      return NextResponse.json(
        { error: \`Failed to read round goals: \${error.message}\` },
        { status: 500 },
      );
    }
  `;

  const [leak, ...rest] = findLeaks(source, 'route.ts');
  assert.match(leak, /puts the caught error in a response body/);
  assert.match(leak, /reportRouteFailure/, 'the message must say what to do');
  assert.deepEqual(rest, []);
});

test('the ternary spelling is the same leak', () => {
  const source = `
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed." },
      { status: 500 },
    );
  `;
  assert.equal(findLeaks(source, 'route.ts').length, 1);
});

test('String(error) and a stack are caught too', () => {
  // Both are what somebody reaches for once `error.message` is refused, and
  // both carry the same text or more of it.
  assert.equal(
    findLeaks('NextResponse.json({ details: String(error) });', 'route.ts').length,
    1,
  );
  assert.equal(
    findLeaks('NextResponse.json({ at: error.stack }, { status: 500 });', 'route.ts')
      .length,
    1,
  );
});

test('a cast does not launder the message', () => {
  // The regression that killed the first version of this check: it matched
  // `error.message` as a shape, and `(error as Error).message` is not that
  // shape. Refusing the identifier is what makes the spelling irrelevant.
  for (const body of [
    'NextResponse.json({ error: `x: ${(error as Error).message}` });',
    'NextResponse.json({ error: (error as any).message });',
    'NextResponse.json({ error: describe(error) });',
    'NextResponse.json({ error: { ...error } });',
  ]) {
    assert.equal(findLeaks(body, 'route.ts').length, 1, body);
  }
});

test("the response's own `error` field is not a mention of the binding", () => {
  const source = `
    return NextResponse.json(
      { error: 'Internal error', ok: false },
      { status: 500 },
    );
  `;
  assert.deepEqual(findLeaks(source, 'route.ts'), []);
});

test('the word inside a message is not the identifier', () => {
  // `{ error: 'Internal error' }` must survive, or the check refuses the very
  // wording it is asking for.
  assert.deepEqual(
    findLeaks(
      "NextResponse.json({ error: 'an error occurred' }, { status: 500 });",
      'route.ts',
    ),
    [],
  );
  // But a template is only stripped down to its literal parts.
  assert.equal(
    findLeaks('NextResponse.json({ error: `failed: ${error}` });', 'route.ts')
      .length,
    1,
  );
});

test('a comment mentioning the error is not the error', () => {
  const source = `
    NextResponse.json(
      // error.message used to be here
      { error: 'Failed.' },
    );
  `;
  assert.deepEqual(findLeaks(source, 'route.ts'), []);
});

test('a catch that renames the binding is refused', () => {
  // Rule 1 exists only to keep rule 2 complete: with `catch (e)` allowed,
  // `{ error: e.message }` would pass an identifier check that looks for
  // `error`.
  const [leak] = findLeaks('try {} catch (e) { }', 'route.ts');
  assert.match(leak, /binds a caught error as `e`/);
});

test('stripTextAndComments keeps what is interpolated and drops what is quoted', () => {
  const stripped = stripTextAndComments(
    "const a = 'error here'; const b = `x ${error.message} y`; // error\n",
  );
  assert.doesNotMatch(stripped, /error here/);
  assert.match(stripped, /error\.message/);
});

test('a leak in a nested call inside the body is still inside the body', () => {
  // The region has to be found by matching parentheses rather than by reading
  // to the first `)`, or a body containing any call at all would be truncated
  // before the leak.
  const source = `
    return NextResponse.json(
      { error: describe(String(error)) },
      { status: 500 },
    );
  `;
  assert.equal(findLeaks(source, 'route.ts').length, 1);
});

test('the constant plus a report is what the rule asks for', () => {
  const source = `
    } catch (error) {
      reportRouteFailure(error, request);
      return NextResponse.json(
        { error: 'Failed to read round goals' },
        { status: 500 },
      );
    }
  `;
  assert.deepEqual(findLeaks(source, 'route.ts'), []);
});

test('the reporter is not itself a body', () => {
  // `reportRouteFailure(error, request)` sits next to the response, and a check
  // that read the whole `catch` block would refuse the very thing it wants.
  const source = `
    console.error("failed:", error.message);
    return NextResponse.json({ error: 'Failed.' }, { status: 500 });
  `;
  assert.deepEqual(findLeaks(source, 'route.ts'), []);
});

test('every call in a file is examined, not only the first', () => {
  const source = `
    NextResponse.json({ error: 'fine' });
    NextResponse.json({ error: String(error) });
    NextResponse.json({ error: error.message });
  `;
  assert.equal(findLeaks(source, 'route.ts').length, 2);
});

test('the gap this check has is a gap, and is written down', () => {
  // A body assembled before it is passed. The doc comment on the script says
  // so; this pins that the claim is accurate rather than modest.
  const source = `
    const body = { error: error.message };
    return NextResponse.json(body, { status: 500 });
  `;
  assert.deepEqual(
    findLeaks(source, 'route.ts'),
    [],
    'if this ever starts failing, the check grew a parser and the comment on ' +
      'it is out of date',
  );
});

test('argumentRegions reports the line the call starts on', () => {
  const source = 'a\nb\nNextResponse.json({ error: error.message });\n';
  const [region] = argumentRegions(source);
  assert.equal(region.line, 3);
});
