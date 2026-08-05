import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

/**
 * Fitness check for the mutation configuration.
 *
 * `tap.testFiles` is the denominator of the mutation score. A test file that
 * exercises a mutated module but sits outside the list does not lower the
 * score honestly — it reports as a survivor a mutant that a real test kills,
 * and a reader of the report concludes a rule needs tests it already has.
 *
 * That has happened twice. On 2026-08-03 the two corpus files were missing and
 * the Hebrew-only rule looked completely untested. By 2026-08-05 the 5.0 smoke
 * test and the 3.0 staging dry run had accumulated outside the list the same
 * way. Neither was an error anyone made; both were omissions nobody could see,
 * because nothing compared the list against the repository.
 *
 * So the list is re-derived here rather than trusted. The rule is the one the
 * config documents: a test file belongs in `tap.testFiles` exactly when it
 * calls a function the mutated modules export.
 *
 * Known limit: a test that reaches the mutated code only through a helper
 * module is invisible to this check, the same way it is invisible to the grep
 * the config names. Both would need import graph analysis to see it, and a
 * fitness check nobody can read by hand is a worse trade than a known gap.
 */
const CONFIG_FILE = 'stryker.config.mjs';

const TEST_FILE_PATTERN = /\.test\.tsx?$/;

/** Names a mutated module exports as functions, in declaration order. */
export function exportedFunctionNames(source) {
  return [...source.matchAll(/^export\s+(?:async\s+)?function\s+(\w+)/gmu)].map(
    (match) => match[1],
  );
}

/**
 * Whether a test file calls any of them. A file that imports a type or a
 * constant from a mutated module is not a test of that module and belongs
 * outside the list: it would slow every run without deciding any mutant.
 */
export function callsAnyExport(source, names) {
  return names.some((name) =>
    new RegExp(`\\b${name}\\s*\\(`, 'u').test(source),
  );
}

export function collectTestFiles(dir, found = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collectTestFiles(fullPath, found);
    } else if (TEST_FILE_PATTERN.test(entry.name)) {
      found.push(fullPath.split(path.sep).join('/'));
    }
  }
  return found;
}

/**
 * The list and the repository, compared in both directions. A missing file
 * inflates the survivor count; a listed file that no longer calls anything
 * costs a process per run and quietly stops meaning what its presence claims.
 */
export function findConfigViolations({ listed, required, existing }) {
  const errors = [];

  for (const file of required) {
    if (!listed.includes(file)) {
      errors.push(
        `${file} calls a mutated module but is missing from tap.testFiles. ` +
          'Its mutants will be reported as survivors that this test kills.',
      );
    }
  }

  for (const file of listed) {
    if (!existing.includes(file)) {
      errors.push(`${file} is listed in tap.testFiles but does not exist.`);
    } else if (!required.includes(file)) {
      errors.push(
        `${file} is listed in tap.testFiles but no longer calls any mutated ` +
          'module. Remove it, or the run pays for a test that decides nothing.',
      );
    }
  }

  return errors;
}

async function main() {
  const errors = [];
  const config = (
    await import(pathToFileURL(path.resolve(CONFIG_FILE)).href)
  ).default;

  const mutated = config.mutate ?? [];
  const listed = config.tap?.testFiles ?? [];

  const exportNames = [];
  for (const file of mutated) {
    if (!fs.existsSync(file)) {
      errors.push(`${file} is listed in mutate but does not exist.`);
      continue;
    }
    exportNames.push(...exportedFunctionNames(fs.readFileSync(file, 'utf-8')));
  }

  if (exportNames.length === 0) {
    errors.push(
      'No mutated module exports a function; the check cannot derive the ' +
        'test list and would pass by accident.',
    );
  }

  const existing = collectTestFiles('src');
  const required = existing.filter((file) =>
    callsAnyExport(fs.readFileSync(file, 'utf-8'), exportNames),
  );

  errors.push(...findConfigViolations({ listed, required, existing }));

  if (errors.length > 0) {
    console.error('Mutation configuration fitness check failed:');
    errors.forEach((error) => console.error(error));
    process.exit(1);
  }
  console.log(
    `Mutation configuration fitness check passed: ${required.length} test ` +
      `files for ${mutated.length} mutated modules.`,
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
