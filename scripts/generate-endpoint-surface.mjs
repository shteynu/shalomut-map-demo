import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * The table of endpoints between Core and the AI service, generated from the
 * code that defines them.
 *
 * It was written by hand and went stale in a day: `main` gained
 * `GET /api/v1/fallback-status` on 2026-08-18 and the table went on claiming to
 * enumerate the surface without it. A table that promises completeness is worse
 * incomplete than absent, and nothing in the repository could tell.
 *
 * What a machine can know, it derives: which endpoints exist, which methods
 * they answer, and which secret guards each one. What it cannot know is why the
 * endpoint exists and who calls it — so the direction and the answer codes are
 * declared below, and an endpoint that appears in the code without a
 * declaration **fails the check** rather than being guessed at or skipped. The
 * failure mode this is built for is therefore "CI asks you to classify the new
 * endpoint", never "the document quietly stopped being true".
 *
 * The same rule runs backwards: a declaration whose endpoint no longer exists
 * fails too, so deleting a route cannot leave a row behind.
 */

const repositoryRoot = path.resolve(fileURLToPath(new URL('..', import.meta.url)));

export const DOCUMENT_PATH = path.join(
  repositoryRoot,
  'docs',
  'ai-analysis-run-lifecycle.md',
);
const CORE_API_ROOT = path.join(repositoryRoot, 'src', 'app', 'api');
const SERVICE_MAIN = path.join(
  repositoryRoot,
  'ai-analytics-service',
  'src',
  'main.py',
);

export const GENERATE_COMMAND = 'npm run docs:endpoints';

export const BEGIN_MARKER = '<!-- generated:endpoint-surface -->';
export const END_MARKER = '<!-- /generated:endpoint-surface -->';

/**
 * What the code cannot say about an endpoint: who calls it, what it answers, and
 * where it belongs in the reading.
 *
 * Keyed by `METHOD path`. Adding a row here is the deliberate act of saying an
 * endpoint is part of this boundary and describing it; the generator will not
 * invent either field.
 *
 * The table is rendered in this order, because file order is not reading order:
 * routes sort by directory name and FastAPI decorators by position in
 * `main.py`, and neither knows that the three public paths belong together or
 * that a run begins with `claim`. The set of rows is checked against the code;
 * only their sequence is chosen here.
 */
const DECLARATIONS = {
  'POST /api/ai-analysis-runs/claim': {
    direction: 'worker → Core',
    answers: '200 · 204 · 401',
  },
  'POST /api/ai-analysis-runs/:runId/heartbeat': {
    direction: 'worker → Core',
    answers: '200 · 409 · 400',
  },
  'POST /api/ai-analysis-runs/:runId/fail': {
    direction: 'worker → Core',
    answers: '200 · 404 · 409',
  },
  'POST /api/rounds/:roundId/ai-insights': {
    direction: 'worker → Core',
    answers: '200 · 400',
  },
  'POST /api/mcp': {
    direction: 'worker → Core',
    answers: '200',
  },
  'GET /health': {
    direction: 'public',
    answers: '200',
  },
  'GET /api/v1/provider-status': {
    direction: 'public',
    answers: '200',
  },
  'GET /api/v1/fallback-status': {
    direction: 'public',
    answers: '200',
  },
  'GET /api/v1/provider-health': {
    direction: 'operator → worker',
    answers: '200 · 401',
  },
  'POST /api/v1/questions/suggest': {
    direction: 'Core → worker',
    answers: '200',
  },
  'POST /api/v1/rounds/:round_id/analyze': {
    // Closed by environment rather than by a secret: outside `development` the
    // handler raises 404, so it is unreachable on the deployed service and the
    // empty secret column is not a gap. ADR-010 states the rule; this row is
    // where a reader meets it.
    direction: 'development only',
    answers: '200 · 404 outside development',
  },
  'POST /api/v1/webhook/events': {
    direction: 'legacy, dispatched by nothing',
    answers: '202 · 401 · 503',
  },
};

/** `[runId]` and `{round_id}` both become `:name`, so one table reads one way. */
function normalisePathParams(value) {
  return value.replace(/\[([^\]]+)\]/g, ':$1').replace(/\{([^}]+)\}/g, ':$1');
}

function routeFiles(directory) {
  const found = [];

  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      found.push(...routeFiles(entryPath));
      continue;
    }
    if (entry.name === 'route.ts') found.push(entryPath);
  }

  return found;
}

/**
 * Core's machine-authenticated surface.
 *
 * `hasConfiguredSharedSecret` is what makes an endpoint one the worker may call,
 * so the search is for that rather than for a list of paths somebody has to
 * remember to extend. A route that authenticates a manager instead — the `GET`
 * beside the insights callback, for instance — is not part of this boundary and
 * is not collected, because the check lives inside the method that needs it.
 */
export function collectCoreEndpoints() {
  const endpoints = [];

  for (const file of routeFiles(CORE_API_ROOT).sort()) {
    const source = fs.readFileSync(file, 'utf8');
    if (!source.includes('hasConfiguredSharedSecret')) continue;

    const routePath = normalisePathParams(
      `/api/${path.relative(CORE_API_ROOT, path.dirname(file)).split(path.sep).join('/')}`,
    );

    // Each exported handler is read on its own: one file can hold a
    // manager-authenticated GET beside a secret-authenticated POST.
    const handlers = source.split(/export async function /).slice(1);

    for (const handler of handlers) {
      const method = handler.match(/^([A-Z]+)\s*\(/)?.[1];
      if (!method) continue;

      const secret = handler.match(
        /hasConfiguredSharedSecret\(\s*request\s*,\s*'([A-Z_]+)'/,
      )?.[1];
      if (!secret) continue;

      endpoints.push({ method, path: routePath, secret, side: 'core' });
    }
  }

  return endpoints;
}

/**
 * The AI service's own surface, from its FastAPI decorators.
 *
 * A handler that compares `authorization` against `settings.ai_webhook_secret`
 * is guarded by it; anything else is anonymous, which is deliberate for the
 * three a free uptime monitor reads and is stated as such in `main.py`.
 */
export function collectServiceEndpoints() {
  const source = fs.readFileSync(SERVICE_MAIN, 'utf8');
  const decorator = /@app\.(get|post|put|patch|delete)\(\s*"([^"]+)"/g;
  const endpoints = [];

  const matches = [...source.matchAll(decorator)];

  for (const [index, match] of matches.entries()) {
    const bodyStart = match.index + match[0].length;
    const bodyEnd = matches[index + 1]?.index ?? source.length;
    const body = source.slice(bodyStart, bodyEnd);

    endpoints.push({
      method: match[1].toUpperCase(),
      path: normalisePathParams(match[2]),
      secret: body.includes('settings.ai_webhook_secret')
        ? 'AI_WEBHOOK_SECRET'
        : null,
      side: 'service',
    });
  }

  return endpoints;
}

function endpointKey(endpoint) {
  return `${endpoint.method} ${endpoint.path}`;
}

/** Every endpoint on the boundary, from both sides of it. */
export function collectEndpoints() {
  return [...collectCoreEndpoints(), ...collectServiceEndpoints()];
}

export function renderTable(endpoints = collectEndpoints()) {
  const undeclared = endpoints
    .map(endpointKey)
    .filter((key) => !DECLARATIONS[key]);

  if (undeclared.length > 0) {
    throw new Error(
      `These endpoints exist in the code and are not declared in ` +
        `scripts/generate-endpoint-surface.mjs: ${undeclared.join(', ')}. ` +
        `Add each one with the direction it is called in and the codes it ` +
        `answers — the generator will not guess either.`,
    );
  }

  const live = new Set(endpoints.map(endpointKey));
  const stale = Object.keys(DECLARATIONS).filter((key) => !live.has(key));

  if (stale.length > 0) {
    throw new Error(
      `These endpoints are declared but no longer exist in the code: ` +
        `${stale.join(', ')}. Remove the declaration, or restore the route.`,
    );
  }

  const found = new Map(endpoints.map((endpoint) => [endpointKey(endpoint), endpoint]));

  const rows = Object.entries(DECLARATIONS).map(([key, declaration]) => {
    const { secret } = found.get(key);

    return `| ${declaration.direction} | \`${key}\` | ${secret ? `\`${secret}\`` : 'none'} | ${declaration.answers} |`;
  });

  return [
    '| Direction | Endpoint | Secret | Answers |',
    '| --- | --- | --- | --- |',
    ...rows,
  ].join('\n');
}

function sectionBounds(document) {
  const begin = document.indexOf(BEGIN_MARKER);
  const end = document.indexOf(END_MARKER);

  if (begin === -1 || end === -1 || end < begin) {
    throw new Error(
      `${DOCUMENT_PATH} must contain ${BEGIN_MARKER} and ${END_MARKER}, in that order.`,
    );
  }

  return { begin: begin + BEGIN_MARKER.length, end };
}

export function renderDocument(
  document = fs.readFileSync(DOCUMENT_PATH, 'utf8'),
) {
  const { begin, end } = sectionBounds(document);

  return `${document.slice(0, begin)}\n${renderTable()}\n${document.slice(end)}`;
}

export function generate() {
  fs.writeFileSync(DOCUMENT_PATH, renderDocument(), 'utf8');
}

/** Returns the reason the table is stale, or `null` when it matches. */
export function findStaleReason() {
  const actual = fs.readFileSync(DOCUMENT_PATH, 'utf8');
  const expected = renderDocument(actual);

  if (actual === expected) return null;

  return (
    'the endpoint surface table in docs/ai-analysis-run-lifecycle.md does not ' +
    'match the endpoints defined in src/app/api and ai-analytics-service.'
  );
}

function main() {
  const checkOnly = process.argv.includes('--check');

  if (checkOnly) {
    let staleReason;
    try {
      staleReason = findStaleReason();
    } catch (error) {
      console.error(`Endpoint surface check failed: ${error.message}`);
      process.exit(1);
    }

    if (staleReason) {
      console.error(`Endpoint surface check failed: ${staleReason}`);
      console.error(`Run \`${GENERATE_COMMAND}\` and commit the result.`);
      process.exit(1);
    }

    console.log(
      `Endpoint surface check passed: ${collectEndpoints().length} endpoints, ` +
        `each declared and rendered.`,
    );
    return;
  }

  generate();
  console.log(
    `Generated the endpoint surface table in docs/ai-analysis-run-lifecycle.md ` +
      `from ${collectEndpoints().length} endpoints.`,
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
