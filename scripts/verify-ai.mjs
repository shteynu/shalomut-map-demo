import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = fileURLToPath(new URL('../', import.meta.url));
const serviceRoot = path.join(repositoryRoot, 'ai-analytics-service');
const python = path.join(serviceRoot, '.venv', 'bin', 'python');

if (!existsSync(python)) {
  console.error(
    'AI verification requires ai-analytics-service/.venv/bin/python. ' +
      'Set up the local Python environment using docs/local-environment.md.',
  );
  process.exit(1);
}

const result = spawnSync(python, ['-m', 'pytest'], {
  cwd: serviceRoot,
  stdio: 'inherit',
});

if (result.error) {
  console.error(`Could not run AI verification: ${result.error.message}`);
  process.exit(1);
}

process.exit(result.status ?? 1);
