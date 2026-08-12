import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Architecture fitness check for the AI service interpreter.
 *
 * Until 2026-08-12 the cross-service test spawned a bare `python3`. On macOS
 * that is usually the 3.9 from the Command Line Tools, below the
 * `requires-python = ">=3.11"` the service declares, so three tests failed with
 * an ImportError from inside `src/agents/state.py` — a missing local
 * environment wearing the costume of a product defect. `verify:core` chains
 * `npm test`, so the whole gate stopped there, and no CI workflow ran the suite
 * to catch it.
 *
 * The rule is about which interpreter runs the service, so this checks command
 * position and nothing else: `python3` as the program being executed. Prose
 * that mentions `python3` — a comment, an error message explaining why a system
 * interpreter will not do — is not a violation, and neither is
 * `python3 -m venv`, which is the one job the system interpreter has.
 *
 * Callers resolve the real interpreter through `scripts/ai-service-python.mjs`.
 */

const RESOLVER = path.join('scripts', 'ai-service-python.mjs');

/**
 * This gate's own unit tests are written out of the violations it looks for, so
 * scanning them would make the check fail on its own evidence. Named exactly,
 * not as a `*.test.mjs` pattern: a test file elsewhere spawning `python3` is a
 * finding like any other.
 */
const OWN_TEST_FILE = 'scripts/check-python-interpreter.test.mjs';

const SCANNED_DIRECTORIES = ['scripts', 'src', 'e2e', '.github/workflows'];
const CODE_EXTENSIONS = ['.mjs', '.js', '.ts', '.tsx'];
const WORKFLOW_EXTENSIONS = ['.yml', '.yaml'];

/**
 * `python3` (or `python`) where a shell would read it as the program to run:
 * at the start of a command, or after a separator that starts a new one. A
 * path-qualified interpreter such as `.venv/bin/python` never matches, because
 * `/` is not one of the anchors.
 */
const COMMAND_POSITION = /(?:^|&&|\|\||[;|]|\$\()[ \t]*(python3?)(?=[ \t]|$)/g;

/** The one legitimate use of the system interpreter: building the virtualenv. */
const CREATES_THE_VIRTUALENV = /^-m[ \t]+venv\b/;

const ADVICE =
  'must run through scripts/ai-service-python.mjs. A system python3 is ' +
  'below the service’s requires-python and has none of its dependencies; ' +
  'only `python3 -m venv` may use it.';

/**
 * Comments replaced by blanks of the same width, so every reported line number
 * still matches the file the reader opens. Stripping them matters: this file
 * and the resolver both spell `python3` inside backticks in prose, and a
 * backtick in a comment is not a template literal.
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

/** Command-position interpreters inside one shell command, venv build aside. */
export function findInCommand(command) {
  const found = [];

  COMMAND_POSITION.lastIndex = 0;
  let match;
  while ((match = COMMAND_POSITION.exec(command)) !== null) {
    const rest = command.slice(match.index + match[0].length).trimStart();
    if (CREATES_THE_VIRTUALENV.test(rest)) continue;
    found.push(match[1]);
  }

  return found;
}

const STRING_LITERAL =
  /'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"|`(?:[^`\\]|\\.)*`/g;

/** The child_process calls that take the program as their first argument. */
const SPAWN_ARGV0 =
  /\b(?:spawnSync|spawn|execFile|execFileSync|execa|execaSync)\s*\(\s*(['"`])([^'"`]*)\1/g;

const LONE_INTERPRETER = /^\s*python3?\s*$/;

/**
 * Two shapes count in source: a string that is nothing but the interpreter —
 * `spawnSync('python3', […])` hands it straight to the kernel as argv[0] — and
 * a string holding a shell command that starts one.
 *
 * The two are found separately on purpose. A lone `'python'` is also the last
 * segment of `path.join(serviceRoot, '.venv', 'bin', 'python')`, which is the
 * correct interpreter spelled the correct way, so it counts only where a spawn
 * is demonstrably reading it as argv[0].
 */
export function findHardcodedInterpreter(source, filePath) {
  const normalized = filePath.split(path.sep).join('/');

  if (normalized.endsWith(OWN_TEST_FILE)) return [];

  if (WORKFLOW_EXTENSIONS.some((extension) => normalized.endsWith(extension))) {
    return findInWorkflow(source, normalized);
  }

  const code = blankComments(source);
  const errors = [];

  const report = (index, interpreter) =>
    errors.push(
      `${normalized}:${lineOf(code, index)}: ` +
        `\`${interpreter}\` is spawned by name and ${ADVICE}`,
    );

  SPAWN_ARGV0.lastIndex = 0;
  let spawned;
  while ((spawned = SPAWN_ARGV0.exec(code)) !== null) {
    for (const interpreter of findInCommand(spawned[2])) {
      report(spawned.index, interpreter);
    }
  }

  STRING_LITERAL.lastIndex = 0;
  let literal;
  while ((literal = STRING_LITERAL.exec(code)) !== null) {
    const value = literal[0].slice(1, -1);
    if (LONE_INTERPRETER.test(value)) continue;

    for (const interpreter of findInCommand(value)) {
      report(literal.index, interpreter);
    }
  }

  return errors;
}

/**
 * In a workflow the command is the line itself, not a quoted string. A step
 * writes it as `- run: <command>`; a `run: |` block writes the rest bare, one
 * command per line. Only `run` is unwrapped, so `name: python3 something` stays
 * the label it is.
 */
export function findInWorkflow(source, filePath) {
  const normalized = filePath.split(path.sep).join('/');
  const errors = [];

  source.split('\n').forEach((line, index) => {
    const command = line
      .replace(/(^|\s)#.*$/, '')
      .trim()
      .replace(/^-\s+/, '')
      .replace(/^run:\s*/, '');

    for (const interpreter of findInCommand(command)) {
      errors.push(
        `${normalized}:${index + 1}: ` +
          `\`${interpreter}\` is run by name and ${ADVICE}`,
      );
    }
  });

  return errors;
}

export function findInPackageScripts(manifest, filePath = 'package.json') {
  return Object.entries(manifest.scripts ?? {}).flatMap(([name, command]) =>
    findInCommand(command).map(
      (interpreter) =>
        `${filePath}: the \`${name}\` script runs \`${interpreter}\` by name ` +
        `and ${ADVICE}`,
    ),
  );
}

function scanDir(dir, errors) {
  if (!fs.existsSync(dir)) return;

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      scanDir(fullPath, errors);
      continue;
    }

    const scanned = [...CODE_EXTENSIONS, ...WORKFLOW_EXTENSIONS].some(
      (extension) => fullPath.endsWith(extension),
    );

    if (scanned) {
      errors.push(
        ...findHardcodedInterpreter(fs.readFileSync(fullPath, 'utf-8'), fullPath),
      );
    }
  }
}

/**
 * The check fails in both directions. Without this half it would pass on a
 * repository whose resolver had been deleted or gutted, because then there
 * would be no `python3` left to find and no interpreter resolved either.
 */
function findMissingResolver() {
  if (!fs.existsSync(RESOLVER)) {
    return [`${RESOLVER}: the interpreter resolver is missing.`];
  }

  const source = fs.readFileSync(RESOLVER, 'utf-8');

  if (!/['"`]\.venv['"`][\s\S]{0,40}['"`]python['"`]/.test(source)) {
    return [
      `${RESOLVER}: no longer resolves the service virtualenv interpreter.`,
    ];
  }

  return [];
}

function main() {
  const errors = [];

  for (const directory of SCANNED_DIRECTORIES) scanDir(directory, errors);

  errors.push(
    ...findInPackageScripts(JSON.parse(fs.readFileSync('package.json', 'utf-8'))),
  );
  errors.push(...findMissingResolver());

  if (errors.length > 0) {
    console.error('Python interpreter fitness check failed:');
    errors.forEach((error) => console.error(error));
    process.exit(1);
  }

  console.log('Python interpreter fitness check passed.');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
