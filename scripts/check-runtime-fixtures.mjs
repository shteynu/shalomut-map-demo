import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Architecture fitness check for test fixtures.
 *
 * `DEMO_ORGANIZATION` and `DEMO_ROUND` — a school with an active round and the
 * share code `SHALOM-DEMO` — used to be exported from
 * `src/lib/repositories/index.ts`, the barrel every route handler imports its
 * adapters from. Nothing in production used them, and the comment beside them
 * said "for tests", but the location said otherwise: a ready-made school sat
 * one import away from any runtime module, which is the shape backlog §7 calls
 * a demo record masquerading as data.
 *
 * The rule is therefore about reachability, not about intent: a fixture may be
 * imported by a test and by nothing else. An empty database has to read as
 * empty.
 */
const FIXTURE_SEGMENT = '__fixtures__';

function isTestFile(filePath) {
  return (
    filePath.includes('__tests__') ||
    filePath.includes('__dbtests__') ||
    filePath.includes(FIXTURE_SEGMENT) ||
    filePath.endsWith('.test.ts') ||
    filePath.endsWith('.test.tsx')
  );
}

const IMPORT_FROM = /\bfrom\s+['"]([^'"]+)['"]/;
const DYNAMIC_IMPORT = /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/;

export function findFixtureImports(source, filePath) {
  const normalized = filePath.split(path.sep).join('/');
  if (isTestFile(normalized)) return [];

  const errors = [];

  source.split('\n').forEach((line, index) => {
    const specifier = line.match(IMPORT_FROM)?.[1] ?? line.match(DYNAMIC_IMPORT)?.[1];
    if (!specifier || !specifier.includes(FIXTURE_SEGMENT)) return;

    errors.push(
      `${normalized}:${index + 1}: ${specifier} is a test fixture. ` +
        'Runtime modules must not import one; an empty database reads as empty.',
    );
  });

  return errors;
}

function scanDir(dir, errors) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      scanDir(fullPath, errors);
    } else if (fullPath.endsWith('.ts') || fullPath.endsWith('.tsx')) {
      errors.push(
        ...findFixtureImports(fs.readFileSync(fullPath, 'utf-8'), fullPath),
      );
    }
  }
}

/**
 * The check fails in both directions. Without this half it would pass just as
 * happily on a repository whose fixtures had been quietly moved back into a
 * runtime module, because then nothing would import a `__fixtures__` path at
 * all.
 */
function findMisplacedFixtures() {
  const errors = [];
  const barrel = 'src/lib/repositories/index.ts';

  if (fs.existsSync(barrel) && /\bDEMO_(?:ORGANIZATION|ROUND)\b/.test(fs.readFileSync(barrel, 'utf-8'))) {
    errors.push(
      `${barrel}: defines or re-exports a DEMO_ fixture. ` +
        `Fixtures belong under ${FIXTURE_SEGMENT}/.`,
    );
  }

  return errors;
}

function main() {
  const errors = [];
  scanDir('src', errors);
  errors.push(...findMisplacedFixtures());

  if (errors.length > 0) {
    console.error('Runtime fixture fitness check failed:');
    errors.forEach((error) => console.error(error));
    process.exit(1);
  }
  console.log('Runtime fixture fitness check passed.');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
