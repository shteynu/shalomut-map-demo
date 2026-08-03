import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Architecture fitness check for the Core composition root.
 *
 * Two rules, and both exist because `getRepositories()` used to break them:
 *
 * 1. Only an entrypoint may resolve the composition root. A route handler, a
 *    server component's context loader, a script or a test stands at the edge
 *    of the application and has nowhere to receive dependencies from.
 *    Everything below that edge takes repositories as arguments, which is what
 *    lets a service be tested without installing a global first.
 * 2. Only the composition root constructs a repository. When any module could
 *    reach for a concrete adapter, "which store am I really talking to" stopped
 *    being answerable in one place.
 */
export const COMPOSITION_ROOT = 'src/lib/composition-root.ts';

/**
 * Entrypoints allowed to resolve the wiring. `manager-context.ts` is the
 * composition edge of the server components: the eight manager pages all enter
 * through it, so the alternative is repeating the resolution in each of them.
 */
const ENTRYPOINT_FILES = ['src/lib/server/manager-context.ts'];

const ENTRYPOINT_PATTERNS = [
  /^src\/app\/.*\/route\.ts$/,
  /^src\/app\/.*\/page\.tsx$/,
];

/**
 * The one acknowledged exception. `manager-audit.ts` keeps a process-local
 * `InMemoryAuditLogRepository` because the audit log has no durable table yet;
 * the structured log line next to it is what makes an action traceable in
 * deployment. When that table lands, this entry goes away with it.
 */
const WIRING_EXCEPTIONS = ['src/lib/server/manager-audit.ts'];

const RESOLVE_CALL = /\bresolveCoreRepositories\s*\(/;
const CONSTRUCTS_REPOSITORY = /\bnew\s+(?:Prisma|InMemory)\w*Repository\s*\(/;

function isTestFile(filePath) {
  return (
    filePath.includes('__tests__') ||
    filePath.includes('__dbtests__') ||
    filePath.endsWith('.test.ts') ||
    filePath.endsWith('.test.tsx')
  );
}

export function isEntrypoint(filePath) {
  const normalized = filePath.split(path.sep).join('/');
  return (
    ENTRYPOINT_FILES.includes(normalized) ||
    ENTRYPOINT_PATTERNS.some((pattern) => pattern.test(normalized))
  );
}

export function findBoundaryViolations(source, filePath) {
  const normalized = filePath.split(path.sep).join('/');
  if (isTestFile(normalized) || normalized === COMPOSITION_ROOT) return [];

  const errors = [];
  const lines = source.split('\n');

  lines.forEach((line, index) => {
    const at = `${normalized}:${index + 1}`;

    if (RESOLVE_CALL.test(line) && !isEntrypoint(normalized)) {
      errors.push(
        `${at}: Only an entrypoint may call resolveCoreRepositories(); ` +
          'take the repositories as a parameter instead.',
      );
    }

    if (
      CONSTRUCTS_REPOSITORY.test(line) &&
      !WIRING_EXCEPTIONS.includes(normalized)
    ) {
      errors.push(
        `${at}: Repositories are constructed in ${COMPOSITION_ROOT} only.`,
      );
    }
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
        ...findBoundaryViolations(fs.readFileSync(fullPath, 'utf-8'), fullPath),
      );
    }
  }
}

function main() {
  const errors = [];
  scanDir('src', errors);

  if (!fs.existsSync(COMPOSITION_ROOT)) {
    errors.push(`${COMPOSITION_ROOT} is missing; Core has no composition root.`);
  }

  if (errors.length > 0) {
    console.error('Composition root fitness check failed:');
    errors.forEach((error) => console.error(error));
    process.exit(1);
  }
  console.log('Composition root fitness check passed.');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
