import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import yaml from 'js-yaml';

/**
 * The OpenAPI specification has one editable source, `docs/openapi.yaml`, and
 * one generated mirror, `public/openapi.json`.
 *
 * Both files used to be edited by hand, and the integrity test only compared a
 * hand-maintained list of AI schema names — so anything outside that list could
 * drift silently, and did: the description of `/api/rounds/{roundId}/reset`
 * disagreed between the two artifacts.
 *
 * YAML is the source because it is the one a person reads and reviews: it
 * carries comments and folded prose, and its diffs are legible. JSON stays
 * committed because `/api-docs` fetches `/openapi.json`, which Next serves as a
 * static file out of `public/` — it is a build output that has to exist in the
 * repository, not a second draft.
 */

const repositoryRoot = path.resolve(fileURLToPath(new URL('..', import.meta.url)));

export const SOURCE_PATH = path.join(repositoryRoot, 'docs', 'openapi.yaml');
export const GENERATED_PATH = path.join(repositoryRoot, 'public', 'openapi.json');

export const GENERATE_COMMAND = 'npm run openapi:generate';

/**
 * The canonical serialization. Two spaces and a trailing newline, so a
 * regenerated file is byte-comparable and the check below can be exact.
 */
export function renderOpenApiJson(source = fs.readFileSync(SOURCE_PATH, 'utf8')) {
  const spec = yaml.load(source);

  if (!spec || typeof spec !== 'object') {
    throw new Error(`${SOURCE_PATH} did not parse into an OpenAPI document.`);
  }
  if (typeof spec.openapi !== 'string' || !spec.openapi.startsWith('3.0')) {
    throw new Error(`${SOURCE_PATH} must declare an OpenAPI 3.0.x document.`);
  }
  if (!spec.paths || typeof spec.paths !== 'object') {
    throw new Error(`${SOURCE_PATH} must declare at least one path.`);
  }

  return `${JSON.stringify(spec, null, 2)}\n`;
}

export function generate() {
  fs.writeFileSync(GENERATED_PATH, renderOpenApiJson(), 'utf8');
}

/**
 * Returns the reason the generated file is stale, or `null` when it matches.
 */
export function findStaleReason() {
  const expected = renderOpenApiJson();

  if (!fs.existsSync(GENERATED_PATH)) {
    return 'public/openapi.json is missing.';
  }

  const actual = fs.readFileSync(GENERATED_PATH, 'utf8');
  if (actual === expected) return null;

  return (
    'public/openapi.json does not match docs/openapi.yaml. ' +
    'Edit the YAML source, never the JSON mirror.'
  );
}

function main() {
  const checkOnly = process.argv.includes('--check');

  if (checkOnly) {
    const staleReason = findStaleReason();
    if (staleReason) {
      console.error(`OpenAPI mirror check failed: ${staleReason}`);
      console.error(`Run \`${GENERATE_COMMAND}\` and commit the result.`);
      process.exit(1);
    }
    console.log('OpenAPI mirror check passed.');
    return;
  }

  generate();
  console.log('Generated public/openapi.json from docs/openapi.yaml.');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
