import { spawnSync } from 'node:child_process';
import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const sourceRoot = fileURLToPath(new URL('../src/', import.meta.url));

async function collectTestFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    const entryPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...await collectTestFiles(entryPath));
      continue;
    }

    if (
      entryPath.includes(`${path.sep}__tests__${path.sep}`) &&
      /\.test\.tsx?$/.test(entry.name)
    ) {
      files.push(entryPath);
    }
  }

  return files;
}

const testFiles = await collectTestFiles(sourceRoot);

if (testFiles.length === 0) {
  console.error('No TypeScript test files found under src/**/__tests__.');
  process.exit(1);
}

const result = spawnSync(
  process.execPath,
  ['--import', 'tsx', '--test', ...testFiles],
  { stdio: 'inherit' },
);

if (result.error) {
  throw result.error;
}

process.exit(result.status ?? 1);
