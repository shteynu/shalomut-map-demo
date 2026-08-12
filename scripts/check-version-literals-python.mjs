import { spawnSync } from 'node:child_process';
import path from 'node:path';
import {
  repositoryRoot,
  requireAiServicePython,
} from './ai-service-python.mjs';

/**
 * The Python half of the version-literal fitness gate. Node runs it so that
 * the interpreter comes from `ai-service-python.mjs` rather than from PATH:
 * the checker itself is pure standard library, but a machine with no `python3`
 * at all would otherwise fail this gate with `sh: python3: command not found`.
 *
 * The checker walks `ai-analytics-service/src` relative to the working
 * directory, so it runs from the repository root, not from the service root.
 */

const checker = path.join(
  'ai-analytics-service',
  'scripts',
  'check_version_literals.py',
);

let python;

try {
  python = requireAiServicePython('The version-literal fitness gate');
} catch (error) {
  console.error(error.message);
  process.exit(1);
}

const result = spawnSync(python, [checker], {
  cwd: repositoryRoot,
  stdio: 'inherit',
});

if (result.error) {
  console.error(`Could not run ${checker}: ${result.error.message}`);
  process.exit(1);
}

process.exit(result.status ?? 1);
