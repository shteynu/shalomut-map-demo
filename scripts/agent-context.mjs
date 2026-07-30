import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

function commandOutput(result) {
  return `${result.stderr ?? ''}${result.stdout ?? ''}`.trim();
}

function runGit(args, cwd, { allowFailure = false } = {}) {
  const result = spawnSync('git', args, {
    cwd,
    encoding: 'utf8',
  });

  if (result.error) {
    throw new Error(`could not run git ${args.join(' ')}: ${result.error.message}`);
  }

  if (result.status !== 0) {
    if (allowFailure) return null;

    const detail = commandOutput(result) || `exit status ${result.status}`;
    throw new Error(`git ${args.join(' ')} failed: ${detail}`);
  }

  return result.stdout.trim();
}

function printList(label, value) {
  console.log(`${label}:`);
  if (!value) {
    console.log('  (none)');
    return;
  }

  for (const line of value.split('\n')) {
    console.log(`  ${line}`);
  }
}

function nextConcreteStep(taskFile) {
  if (!taskFile || !existsSync(taskFile)) return null;

  const lines = readFileSync(taskFile, 'utf8').split(/\r?\n/);
  const heading = lines.findIndex((line) => line.trim() === '## Next concrete step');
  if (heading === -1) return null;

  const body = [];
  for (const line of lines.slice(heading + 1)) {
    if (line.startsWith('## ')) break;
    body.push(line);
  }

  const value = body.join('\n').trim();
  return value || null;
}

try {
  const repositoryRoot = runGit(['rev-parse', '--show-toplevel'], process.cwd());
  const head = runGit(['rev-parse', 'HEAD'], repositoryRoot);
  const branch = runGit(
    ['symbolic-ref', '--quiet', '--short', 'HEAD'],
    repositoryRoot,
    { allowFailure: true },
  );
  const taskRelativePath = branch
    ? path.posix.join(
        'docs',
        'agent-tasks',
        'active',
        `${branch.replaceAll('/', '--')}.md`,
      )
    : null;
  const taskFile = taskRelativePath
    ? path.join(repositoryRoot, ...taskRelativePath.split('/'))
    : null;
  const upstream = runGit(
    ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{upstream}'],
    repositoryRoot,
    { allowFailure: true },
  );

  let divergence = null;
  if (upstream) {
    const counts = runGit(
      ['rev-list', '--left-right', '--count', `HEAD...${upstream}`],
      repositoryRoot,
      { allowFailure: true },
    );
    if (counts) {
      const [ahead, behind] = counts.split(/\s+/);
      divergence = `ahead ${ahead}, behind ${behind}`;
    }
  }

  const workingTree = runGit(
    ['status', '--short', '--untracked-files=all'],
    repositoryRoot,
  );
  const staged = runGit(['diff', '--cached', '--name-only'], repositoryRoot);
  const unstaged = runGit(['diff', '--name-only'], repositoryRoot);
  const untracked = runGit(
    ['ls-files', '--others', '--exclude-standard'],
    repositoryRoot,
  );
  const recentCommits = runGit(['log', '-5', '--oneline'], repositoryRoot);
  const nextStep = nextConcreteStep(taskFile);

  console.log('Agent context');
  console.log(`Repository root: ${repositoryRoot}`);
  console.log(`Current branch: ${branch ?? '(detached HEAD)'}`);
  console.log(`Current HEAD: ${head}`);
  console.log(
    `Expected active task file: ${taskRelativePath ?? '(not applicable on detached HEAD)'}`,
  );
  console.log(
    `Active task file exists: ${taskFile ? (existsSync(taskFile) ? 'yes' : 'no') : 'n/a'}`,
  );
  console.log(`Upstream branch: ${upstream ?? '(not configured)'}`);
  console.log(`Ahead/behind: ${divergence ?? '(not available locally)'}`);
  printList('Working-tree status', workingTree);
  printList('Staged changed files', staged);
  printList('Unstaged changed files', unstaged);
  printList('Untracked files', untracked);
  printList('Five recent commits', recentCommits);
  printList('Next concrete step', nextStep);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`agent-context: ${message}`);
  process.exit(1);
}
