/**
 * A response body says what happened, never where.
 *
 * The 2026-08-21 audit counted twenty-one places under `src/app/api` where a
 * handler interpolated a raw `error.message` into what it sent back. What
 * surfaces there is a database error, a Prisma constraint name or a
 * configuration string — on `/api/auth/login` to anyone at all, and on
 * `/api/mcp` to whoever holds the shared secret.
 *
 * They accumulated because nothing said not to. Every one was written by
 * somebody being helpful, and the next handler will be written the same way
 * unless a check refuses it. So the rule is stated once, here:
 *
 *   1. a `catch` in a route handler binds the name `error`;
 *   2. the argument of `NextResponse.json(...)` does not mention it.
 *
 * The first rule exists to make the second one complete. Matching
 * `error.message` and its spellings does not work — the first version of this
 * check did that and let `(error as Error).message` straight through, and the
 * audit's own count of twenty-one missed `error?.message` for the same reason.
 * Refusing the whole identifier makes the spelling irrelevant. An identifier
 * rule is only as good as the identifier, so rule 1 stops a handler slipping
 * past by writing `catch (e)`.
 *
 * Together they make one house rule: **inside a route handler, the name
 * `error` means a caught throw and nothing else.** Two places used it for the
 * product's own refusal wording and were renamed rather than exempted, because
 * an exemption is a place the next leak can hide.
 *
 * The detail is not thrown away. `reportRouteFailure` sends it where
 * `onRequestError` sends everything else — which matters precisely here,
 * because `onRequestError` never fires for an error a handler caught itself.
 *
 * **What this cannot see.** It reads the argument region of a literal
 * `NextResponse.json(` call, so a body assembled into a variable first and
 * passed by name goes unnoticed. That gap is real and is accepted: the
 * alternative is parsing TypeScript in a fitness check, and every occurrence
 * the audit found is a literal at the call site. If that stops being true this
 * check needs a parser, not a wider regular expression.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = 'src/app/api';
const CALL = 'NextResponse.json(';

/** The catch binding the body rule is written against. */
const BINDING = 'error';

/**
 * Quoted text and comments, gone; `${...}` inside a template kept.
 *
 * Without this, `{ error: 'Internal error' }` would be refused for the word in
 * its own message — and with a template stripped whole, `` `failed: ${error}` ``
 * would be let through, which is the leak itself.
 */
export function stripTextAndComments(source) {
  let out = '';
  let index = 0;

  while (index < source.length) {
    const character = source[index];

    if (character === '/' && source[index + 1] === '/') {
      while (index < source.length && source[index] !== '\n') index += 1;
      continue;
    }
    if (character === '/' && source[index + 1] === '*') {
      const end = source.indexOf('*/', index + 2);
      index = end === -1 ? source.length : end + 2;
      continue;
    }
    if (character === "'" || character === '"') {
      index += 1;
      while (index < source.length && source[index] !== character) {
        index += source[index] === '\\' ? 2 : 1;
      }
      index += 1;
      continue;
    }
    if (character === '`') {
      index += 1;
      while (index < source.length && source[index] !== '`') {
        if (source[index] === '\\') {
          index += 2;
          continue;
        }
        if (source[index] === '$' && source[index + 1] === '{') {
          let depth = 1;
          index += 2;
          const start = index;
          while (index < source.length && depth > 0) {
            if (source[index] === '{') depth += 1;
            else if (source[index] === '}') depth -= 1;
            index += 1;
          }
          out += ` ${source.slice(start, index - 1)} `;
          continue;
        }
        index += 1;
      }
      index += 1;
      continue;
    }

    out += character;
    index += 1;
  }

  return out;
}

/** The region between a call's opening parenthesis and its match. */
export function argumentRegions(source, call = CALL) {
  const regions = [];
  let from = 0;

  for (;;) {
    const start = source.indexOf(call, from);
    if (start === -1) return regions;

    let depth = 0;
    let index = start + call.length - 1;
    for (; index < source.length; index += 1) {
      if (source[index] === '(') depth += 1;
      else if (source[index] === ')') {
        depth -= 1;
        if (depth === 0) break;
      }
    }

    regions.push({
      text: source.slice(start, index + 1),
      line: source.slice(0, start).split('\n').length,
    });
    from = index >= source.length ? start + call.length : index + 1;
  }
}

export function findLeaks(source, file) {
  const leaks = [];

  // Rule 1. Checked on the whole file, because a rename anywhere in it makes
  // rule 2 unenforceable for every body below.
  for (const match of source.matchAll(/\bcatch\s*\(\s*([A-Za-z_$][\w$]*)/g)) {
    if (match[1] !== BINDING) {
      leaks.push(
        `${file}:${source.slice(0, match.index).split('\n').length} binds a ` +
          `caught error as \`${match[1]}\`. Name it \`${BINDING}\` — the rule ` +
          'about response bodies is written against that name.',
      );
    }
  }

  // Rule 2. The object key `error:` is the response's own field and is not a
  // mention of the binding.
  for (const region of argumentRegions(source)) {
    const readable = stripTextAndComments(region.text).replace(
      new RegExp(`\\b${BINDING}\\s*:`, 'g'),
      '',
    );
    // Not a property access: `produced.error` and `refusal.error` are fields of
    // our own result objects carrying our own wording, and a rule that refused
    // them would be refusing the fix rather than the defect. A *spread* is not
    // a property access, though — `{ ...error }` puts the whole thing in the
    // body — so the dot is only forgiven when it is not itself preceded by one.
    if (
      new RegExp(`(?<![\\w$])(?<!(?<!\\.)\\.)${BINDING}\\b`).test(readable)
    ) {
      leaks.push(
        `${file}:${region.line} puts the caught error in a response body. ` +
          'Return a constant and pass the error to reportRouteFailure instead.',
      );
    }
  }

  return leaks;
}

function routeFiles(directory, found = []) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      // Tests build responses too, and a test asserting on a leak is not one.
      if (entry.name === '__tests__' || entry.name === '__dbtests__') continue;
      routeFiles(full, found);
    } else if (entry.name === 'route.ts') {
      found.push(full);
    }
  }
  return found;
}

function main() {
  const files = routeFiles(ROOT);
  const errors = files.flatMap((file) =>
    findLeaks(fs.readFileSync(file, 'utf8'), file),
  );

  if (errors.length > 0) {
    console.error('Error-body fitness check failed:');
    errors.forEach((error) => console.error(error));
    process.exit(1);
  }

  console.log(
    `Error-body fitness check passed: ${files.length} route handlers, no ` +
      'caught error in a response body.',
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
