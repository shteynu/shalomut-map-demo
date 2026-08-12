import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * The one place that answers "which Python runs the AI service here".
 *
 * A bare `python3` is the wrong interpreter twice over. The service declares
 * `requires-python = ">=3.11"`, while the `python3` on a macOS PATH is often
 * the 3.9 that ships with the Command Line Tools — too old to import
 * `src/agents/state.py`, which asks for `typing.NotRequired`. And even a new
 * enough system interpreter has none of the service's dependencies, because
 * they are installed only into the virtualenv.
 *
 * Both failures arrive as an ImportError or a `No module named` from deep
 * inside the service, which reads like a product defect rather than a missing
 * local environment. So every caller resolves the interpreter through here and
 * fails on the real cause instead.
 */

export const repositoryRoot = fileURLToPath(new URL('../', import.meta.url));
export const aiServiceRoot = path.join(repositoryRoot, 'ai-analytics-service');

const interpreter = path.join(aiServiceRoot, '.venv', 'bin', 'python');

/** The service interpreter, or `null` when the virtualenv does not exist. */
export function findAiServicePython() {
  return existsSync(interpreter) ? interpreter : null;
}

/**
 * The service interpreter, or an `Error` naming the missing virtualenv.
 *
 * `purpose` completes the sentence "<purpose> needs the AI service
 * interpreter", so pass a noun phrase such as `'The Python suite'`.
 */
export function requireAiServicePython(purpose) {
  const found = findAiServicePython();

  if (found) return found;

  throw new Error(
    `${purpose} needs the AI service interpreter at ` +
      `${path.relative(repositoryRoot, interpreter)}, which does not exist. ` +
      'Create it once, as docs/local-environment.md describes:\n' +
      '  cd ai-analytics-service && python3 -m venv .venv && ' +
      '.venv/bin/python -m pip install -e ".[dev]"\n' +
      'A system python3 is not a substitute: the service needs Python 3.11+ ' +
      'and its dependencies live only inside the virtualenv.',
  );
}
