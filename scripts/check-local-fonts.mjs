import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Architecture fitness check for web fonts: the build must not fetch them.
 *
 * Until 2026-08-12 the root layout called `next/font/google`, which downloads
 * the stylesheet and every `.woff2` during `next build`. That made every build
 * — local, CI and the Vercel deployment — depend on `fonts.gstatic.com` being
 * both reachable and consistent with itself. It was not: a runner received a
 * stylesheet still naming five files Google had replaced, all of them 404ed,
 * and Turbopack recorded the failed download as a warning before failing on
 * `Module not found: Can't resolve
 * '@vercel/turbopack-next/internal/font/google/font'`. The same commit built
 * cleanly in the neighbouring job, so the gate had become a coin toss.
 *
 * A font can come back over the network three ways, and this looks for all
 * three: the `next/font/google` loader, a Google font host named in code, and
 * a `next/font/local` source that does not exist — the last one because a
 * missing file is what a half-finished move back to the CDN looks like.
 *
 * Prose is not a violation. This file, `src/app/layout.tsx` and
 * `src/app/fonts/README.md` all have to name `next/font/google` and
 * `fonts.gstatic.com` to explain why they are gone.
 */

const SCANNED_DIRECTORIES = ['src', 'scripts', 'e2e'];
const CODE_EXTENSIONS = ['.mjs', '.js', '.ts', '.tsx'];
const STYLE_EXTENSIONS = ['.css'];

/**
 * The gate and its tests are written out of the violations they look for — the
 * failure message has to quote the loader it is banning, and every fixture is a
 * violation on purpose — so scanning them would fail the check on its own
 * evidence. Named exactly rather than as a `check-local-fonts*` pattern: any
 * other file reaching for a Google font is a finding like any other.
 */
const OWN_FILES = [
  'scripts/check-local-fonts.mjs',
  'scripts/check-local-fonts.test.mjs',
];

/** Where the answer lives, quoted in every failure so nobody has to guess. */
const ADVICE =
  'Fonts ship in the repository and load through `next/font/local`; see ' +
  'src/app/fonts/README.md.';

const GOOGLE_LOADER = /next\/font\/google/;
const GOOGLE_FONT_HOST = /fonts\.(?:googleapis|gstatic)\.com/;

/** `src:` on a `localFont()` call, and `path:` on an entry of its array form. */
const FONT_SOURCE = /\b(?:src|path):\s*(['"])([^'"]+)\1/g;

const STRING_LITERAL =
  /'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"|`(?:[^`\\]|\\.)*`/g;

/**
 * Comments replaced by blanks of the same width, so a reported line number
 * still matches the file the reader opens. Every file that explains this rule
 * has to spell the thing the rule forbids.
 */
function blankComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:])\/\/[^\n]*/g, (comment, prefix) =>
      prefix.padEnd(comment.length, ' '),
    );
}

function lineOf(source, index) {
  return source.slice(0, index).split('\n').length;
}

/**
 * A stylesheet has no comment syntax worth stripping here and no strings worth
 * separating: an `@import url(…)` or a `src: url(…)` pointing at a Google host
 * is a fetch wherever it appears.
 */
export function findInStylesheet(source, filePath) {
  const normalized = filePath.split(path.sep).join('/');

  return source
    .split('\n')
    .map((line, index) => ({ line: line.replace(/\/\*.*?\*\//g, ''), index }))
    .filter(({ line }) => GOOGLE_FONT_HOST.test(line))
    .map(
      ({ index }) =>
        `${normalized}:${index + 1}: a Google font host is fetched from CSS. ` +
        ADVICE,
    );
}

/**
 * Violations in one source file. `resolveSource` reports a `next/font/local`
 * source that does not exist; it takes the file's own directory because that is
 * what the loader resolves against.
 */
export function findRemoteFonts(source, filePath, sourceExists = fs.existsSync) {
  const normalized = filePath.split(path.sep).join('/');

  if (OWN_FILES.some((own) => normalized.endsWith(own))) return [];

  if (STYLE_EXTENSIONS.some((extension) => normalized.endsWith(extension))) {
    return findInStylesheet(source, normalized);
  }

  const code = blankComments(source);
  const errors = [];

  STRING_LITERAL.lastIndex = 0;
  let literal;
  while ((literal = STRING_LITERAL.exec(code)) !== null) {
    const value = literal[0].slice(1, -1);
    const where = `${normalized}:${lineOf(code, literal.index)}`;

    if (GOOGLE_LOADER.test(value)) {
      errors.push(`${where}: \`next/font/google\` downloads at build time. ${ADVICE}`);
    } else if (GOOGLE_FONT_HOST.test(value)) {
      errors.push(`${where}: a Google font host is named in code. ${ADVICE}`);
    }
  }

  FONT_SOURCE.lastIndex = 0;
  let fontSource;
  while ((fontSource = FONT_SOURCE.exec(code)) !== null) {
    const reference = fontSource[2];
    if (!reference.startsWith('.')) continue;

    const resolved = path.join(path.dirname(filePath), reference);
    if (sourceExists(resolved)) continue;

    errors.push(
      `${normalized}:${lineOf(code, fontSource.index)}: the font file ` +
        `\`${reference}\` does not exist. ${ADVICE}`,
    );
  }

  return errors;
}

function scanDir(dir, errors) {
  if (!fs.existsSync(dir)) return;

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      scanDir(fullPath, errors);
      continue;
    }

    const scanned = [...CODE_EXTENSIONS, ...STYLE_EXTENSIONS].some((extension) =>
      fullPath.endsWith(extension),
    );

    if (scanned) {
      errors.push(...findRemoteFonts(fs.readFileSync(fullPath, 'utf-8'), fullPath));
    }
  }
}

/**
 * The check fails in both directions. Without this half it would pass on a
 * repository whose font had simply been deleted, because then there is no
 * loader left to find and nothing rendering Hebrew either.
 */
function findMissingLocalFont() {
  const layout = path.join('src', 'app', 'layout.tsx');

  if (!fs.existsSync(layout)) {
    return [`${layout}: the root layout is missing.`];
  }

  if (!/next\/font\/local/.test(blankComments(fs.readFileSync(layout, 'utf-8')))) {
    return [`${layout}: no longer loads a font through \`next/font/local\`.`];
  }

  return [];
}

function main() {
  const errors = [];

  for (const directory of SCANNED_DIRECTORIES) scanDir(directory, errors);
  errors.push(...findMissingLocalFont());

  if (errors.length > 0) {
    console.error('Local font fitness check failed:');
    errors.forEach((error) => console.error(error));
    process.exit(1);
  }

  console.log('Local font fitness check passed.');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
