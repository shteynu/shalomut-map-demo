import { spawnSync } from 'node:child_process';
import { aiServiceRoot, requireAiServicePython } from './ai-service-python.mjs';

let python;

try {
  python = requireAiServicePython('AI verification');
} catch (error) {
  console.error(error.message);
  process.exit(1);
}

const result = spawnSync(python, ['-m', 'pytest'], {
  cwd: aiServiceRoot,
  stdio: 'inherit',
});

if (result.error) {
  console.error(`Could not run AI verification: ${result.error.message}`);
  process.exit(1);
}

process.exit(result.status ?? 1);
