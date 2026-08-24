import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Architecture fitness check for the two tenant chokepoints.
 *
 * A manager path reaches one school's data through exactly one of two
 * functions, and each of them records that a platform administrator was there.
 * Until 2026-08-21 that was a convention and nothing more: `loadManagerContext`
 * recorded from the request rather than from the answer, so an administrator's
 * reading of the only school left no row at all, and no test failed. The fix
 * made the recording right; this check makes it hard to lose again.
 *
 * Three rules:
 *
 * 1. A page that reads persistence directly is a page that is not going through
 *    `loadManagerContext`, so it must be one of the pages that is deliberately
 *    not about one school. `check-composition-root.mjs` permits any page to
 *    resolve the wiring — it is asking a different question — which is exactly
 *    the door this closes.
 * 2. Every route under `src/app/api/rounds/` reaches a round, and a round
 *    belongs to a school, so every one of them authorizes through
 *    `authorizeManagerRound`.
 * 3. Each chokepoint records the visit. A chokepoint that stopped recording
 *    would still route every path through itself and still pass rules 1 and 2,
 *    which is the shape the original defect had.
 */
export const SCREEN_CHOKEPOINT = 'src/lib/server/manager-context.ts';
export const ROUND_CHOKEPOINT = 'src/lib/server/manager-scope.ts';

/**
 * Pages allowed to read persistence without entering through
 * `loadManagerContext`, each because it is not a screen about one school.
 *
 * Adding a page here is a claim that it shows nothing belonging to a single
 * school, or that it is not a manager's screen at all. Make the claim
 * deliberately: a page that shows one school's data and is listed here reads it
 * with nobody recorded.
 */
const PAGES_ABOUT_NO_SINGLE_SCHOOL = {
  // The respondent's own questionnaire. It is reached by share code, has no
  // manager session behind it, and the middleware scopes it to no school.
  'src/app/answer/[shareCode]/page.tsx':
    'the respondent path, scoped to no school by the middleware',
  // The administrator area. It is the one part of the product that is about
  // every school rather than one, so there is no school to be inside and
  // nothing for a per-school visit to name.
  'src/app/admin/page.tsx':
    'the administrator area, which is about every school rather than one',
  // The platform's own log. Every row in it is filed under `PLATFORM_SCOPE`,
  // which is the scope an event has when there is no school to file it under —
  // so there is no school being opened here and no visit for a chokepoint to
  // record. A school's log is the opposite and is a manager screen: `/activity`
  // enters through `loadManagerContext` and is recorded like every other one.
  'src/app/admin/activity/page.tsx':
    'the platform log, whose every row is scoped above all schools',
};

const ROUND_ROUTE_DIRECTORY = 'src/app/api/rounds';

const RESOLVE_CALL = /\bresolveCoreRepositories\s*\(/;
const AUTHORIZE_CALL = /\bauthorizeManagerRound\s*\(/;

const CHOKEPOINT_RECORDS = [
  {
    file: SCREEN_CHOKEPOINT,
    call: /\brecordManagerScreenVisit\s*\(/,
    name: 'recordManagerScreenVisit',
    what: 'the manager screens',
  },
  {
    file: ROUND_CHOKEPOINT,
    call: /\brecordAdministratorSchoolVisit\s*\(/,
    name: 'recordAdministratorSchoolVisit',
    what: 'the round routes',
  },
];

function toPosix(filePath) {
  return filePath.split(path.sep).join('/');
}

function isTestFile(filePath) {
  return (
    filePath.includes('__tests__') ||
    filePath.includes('__dbtests__') ||
    filePath.endsWith('.test.ts') ||
    filePath.endsWith('.test.tsx')
  );
}

/** Rule 1, for one page. */
export function findPageViolations(source, filePath) {
  const normalized = toPosix(filePath);
  if (isTestFile(normalized) || !normalized.endsWith('/page.tsx')) return [];
  if (normalized in PAGES_ABOUT_NO_SINGLE_SCHOOL) return [];

  const lines = source.split('\n');
  const errors = [];

  lines.forEach((line, index) => {
    if (!RESOLVE_CALL.test(line)) return;
    errors.push(
      `${normalized}:${index + 1}: a manager page reads its school through ` +
        `loadManagerContext (${SCREEN_CHOKEPOINT}), which is what records an ` +
        'administrator opening a school they are not a member of. If this page ' +
        'is about no single school, name it in PAGES_ABOUT_NO_SINGLE_SCHOOL ' +
        'and say why.',
    );
  });

  return errors;
}

/** Rule 2, for one route file. */
export function findRoundRouteViolations(source, filePath) {
  const normalized = toPosix(filePath);
  if (isTestFile(normalized)) return [];
  if (!normalized.startsWith(`${ROUND_ROUTE_DIRECTORY}/`)) return [];
  if (!normalized.endsWith('/route.ts')) return [];
  if (AUTHORIZE_CALL.test(source)) return [];

  return [
    `${normalized}: a round belongs to a school, so this route authorizes ` +
      `through authorizeManagerRound (${ROUND_CHOKEPOINT}). Without it the ` +
      "round's own school is never compared with the caller's.",
  ];
}

/** Rule 3, for one chokepoint. */
export function findRecordingViolations(source, filePath) {
  const normalized = toPosix(filePath);
  const chokepoint = CHOKEPOINT_RECORDS.find(
    (candidate) => candidate.file === normalized,
  );
  if (!chokepoint || chokepoint.call.test(source)) return [];

  return [
    `${normalized}: the chokepoint for ${chokepoint.what} no longer calls ` +
      `${chokepoint.name}, so a platform administrator can read a school ` +
      'without the visit being recorded.',
  ];
}

export function findChokepointViolations(source, filePath) {
  return [
    ...findPageViolations(source, filePath),
    ...findRoundRouteViolations(source, filePath),
    ...findRecordingViolations(source, filePath),
  ];
}

function scanDir(dir, errors) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      scanDir(fullPath, errors);
    } else if (fullPath.endsWith('.ts') || fullPath.endsWith('.tsx')) {
      errors.push(
        ...findChokepointViolations(fs.readFileSync(fullPath, 'utf-8'), fullPath),
      );
    }
  }
}

function main() {
  const errors = [];
  scanDir('src', errors);

  for (const { file } of CHOKEPOINT_RECORDS) {
    if (!fs.existsSync(file)) {
      errors.push(`${file} is missing; a tenant chokepoint has no home.`);
    }
  }

  // An allowlist entry for a page that no longer exists is a permission nobody
  // asked for, waiting for a new file to land on the same path.
  for (const page of Object.keys(PAGES_ABOUT_NO_SINGLE_SCHOOL)) {
    if (!fs.existsSync(page)) {
      errors.push(
        `${page} is listed as a page about no single school and does not ` +
          'exist; remove the entry.',
      );
    }
  }

  if (errors.length > 0) {
    console.error('Tenant chokepoint fitness check failed:');
    errors.forEach((error) => console.error(error));
    process.exit(1);
  }

  console.log(
    `Tenant chokepoint fitness check passed: two chokepoints, ` +
      `${Object.keys(PAGES_ABOUT_NO_SINGLE_SCHOOL).length} pages about no ` +
      'single school.',
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
