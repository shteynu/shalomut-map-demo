import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * The gates, run at the moment a file is edited rather than at `verify:core`.
 *
 * `verify:core` is the rule of record: it runs in CI, it binds every client and
 * every human, and nothing here replaces it. What it cannot do is tell an agent
 * *now*. A violation written at 10:00 surfaces when somebody runs the chain,
 * and by then it is buried under later edits made on top of it.
 *
 * So this is a dispatcher, not a rule. Claude Code's `PostToolUse` hook hands
 * it the file that was just written; it maps that path to the gates that could
 * possibly care, runs exactly those, and exits 2 with their own output when one
 * refuses — which is the exit code that feeds stderr back to the agent. Every
 * other path exits 0 and says nothing.
 *
 * Two consequences worth stating plainly:
 *
 * 1. The mapping is a convenience, never a claim of coverage. A path nobody
 *    mapped runs no gate here and is still caught by `verify:core`. Being green
 *    at edit time is not evidence; `verify:core` is.
 * 2. This runs in Claude Code only. A rule that lives in a hook does not exist
 *    for Copilot, Gemini or a person in a terminal, which is exactly why the
 *    rule lives in `scripts/check-*.mjs` and this file only starts it earlier.
 *
 * `lint:literals` is deliberately absent: its Python half needs an interpreter
 * from `.venv`, and a missing local environment must not read as a violation.
 * CI runs it in the chain like everything else.
 *
 * What it runs is the check, not the whole `lint:*` command. Every gate runs
 * `node --test` on its own test file first — the right order for CI, which must
 * prove the check can fail before trusting it, and the wrong one here: the
 * first version of this hook buried a one-line violation under sixty lines of
 * passing TAP. The tests of a gate stay CI's job.
 */
const SKILL = '.agents/skills/shalomut-guardrails/SKILL.md';
const INVENTORY = '.agents/skills/shalomut-guardrails/references/inventory.md';

/** Client entrypoints; the same four `check-agent-skills.mjs` requires. */
const ADAPTERS = [
  'AGENTS.md',
  'CLAUDE.md',
  'GEMINI.md',
  '.github/copilot-instructions.md',
  'docs/agent-tasks/README.md',
];

const MUTATED = ['src/lib/ai-contract.ts', 'src/lib/scoring-bands.ts'];

/**
 * Path → the gates that could refuse it. Deliberately narrow: a gate that fires
 * on every edit is a gate people learn to wait out.
 */
const RULES = [
  {
    gate: 'lint:skills',
    when: (file) => file.startsWith('.agents/skills/') || ADAPTERS.includes(file),
  },
  {
    gate: 'lint:gate-inventory',
    when: (file) =>
      file === 'package.json' ||
      file === INVENTORY ||
      /^scripts\/(check-[\w-]+|gate-hook)(\.test)?\.mjs$/.test(file),
  },
  {
    gate: 'lint:deploy-migrations',
    when: (file) => file === 'package.json' || file === 'scripts/deploy-migrate.mjs',
  },
  {
    gate: 'lint:interpreter',
    when: (file) =>
      file.startsWith('scripts/') ||
      file === 'package.json' ||
      file.startsWith('.github/workflows/'),
  },
  {
    gate: 'lint:error-bodies',
    when: (file) => /^src\/app\/api\/.*\/route\.ts$/.test(file),
  },
  {
    gate: 'lint:tenant-chokepoints',
    when: (file) =>
      /^src\/app\/.*page\.tsx$/.test(file) ||
      file.startsWith('src/app/api/rounds/') ||
      file.startsWith('src/lib/manager-context'),
  },
  {
    gate: 'lint:composition',
    when: (file) =>
      file === 'src/lib/composition-root.ts' ||
      file.startsWith('src/lib/repositories/'),
  },
  { gate: 'lint:fixtures', when: (file) => file.startsWith('src/lib/repositories/') },
  {
    gate: 'lint:mutation-config',
    when: (file) => file === 'stryker.config.mjs' || MUTATED.includes(file),
  },
  {
    gate: 'lint:contract-refusals',
    when: (file) =>
      file === 'contracts/capabilities.json' || file === 'src/lib/ai-contract.ts',
  },
  {
    gate: 'lint:fonts',
    when: (file) =>
      file.startsWith('src/app/fonts/') ||
      file === 'src/app/globals.css' ||
      file === 'src/app/layout.tsx',
  },
  {
    gate: 'lint:doc-numbers',
    when: (file) => file.startsWith('docs/') && file.endsWith('.md'),
  },
  {
    gate: 'lint:audit-count',
    when: (file) => file === 'docs/critical-audit-2026-08-21.md',
  },
  {
    gate: 'lint:python-deps',
    when: (file) =>
      /^ai-analytics-service\/(pyproject\.toml|requirements.*\.txt)$/.test(file) ||
      file === 'Dockerfile',
  },
  { gate: 'lint:docs-publish', when: (file) => file.startsWith('scripts/publish-doc') },
];

/** Every gate this dispatcher can name, for the test that they all exist. */
export const MAPPED_GATES = RULES.map((rule) => rule.gate);

export function gatesFor(file) {
  return RULES.filter((rule) => rule.when(file)).map((rule) => rule.gate);
}

/**
 * The repository-relative path the hook was handed, or null.
 *
 * A path outside the repository is not this repository's business, and neither
 * is a payload without one — `PostToolUse` fires for tools that write nothing.
 */
export function repoRelativeFile(payload, root) {
  const raw =
    payload?.tool_response?.filePath ??
    payload?.tool_input?.file_path ??
    payload?.tool_input?.filePath;
  if (typeof raw !== 'string' || raw.length === 0) return null;

  const relative = path.relative(root, path.resolve(root, raw));
  if (relative.startsWith('..') || path.isAbsolute(relative)) return null;
  return relative.split(path.sep).join('/');
}

/**
 * The check half of a gate's command: the segments that are not `node --test`.
 *
 * A gate that is only a test suite — `lint:docs-publish` — has no other half,
 * and running the suite is then the only way to run the gate at all.
 */
export function checkCommandsFor(script) {
  const segments = script
    .split('&&')
    .map((segment) => segment.trim().split(/\s+/))
    .filter((argv) => argv.length > 0);
  const checks = segments.filter((argv) => argv[1] !== '--test');
  return checks.length > 0 ? checks : segments;
}

function readStdin() {
  try {
    return JSON.parse(fs.readFileSync(0, 'utf8'));
  } catch {
    return null;
  }
}

async function main() {
  const payload = readStdin();
  const file = repoRelativeFile(payload, process.cwd());
  if (file === null) return;

  const gates = gatesFor(file);
  if (gates.length === 0) return;

  const { scripts } = JSON.parse(fs.readFileSync('package.json', 'utf8'));

  for (const gate of gates) {
    for (const argv of checkCommandsFor(scripts[gate])) {
      const [command, ...args] = argv;
      const run = spawnSync(command === 'node' ? process.execPath : command, args, {
        encoding: 'utf8',
      });

      if (run.error) {
        // A hook that cannot start is a broken hook, not a broken repository.
        console.error(`Could not run \`${gate}\`: ${run.error.message}`);
        return;
      }
      if (run.status === 0) continue;

      console.error(
        `The gate \`${gate}\` refuses ${file}.\n\n` +
          [run.stdout, run.stderr]
            .map((stream) => (stream ?? '').trim())
            .filter(Boolean)
            .join('\n') +
          `\n\nThe rule and what to do about it: ${SKILL}, section \`A red gate\`. ` +
          'Do not weaken the check or rewrite its test to make this pass. ' +
          `Run \`npm run ${gate}\` for the gate with its own tests.`,
      );
      process.exit(2);
    }
  }

  console.log(`${gates.join(', ')} passed for ${file}.`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
