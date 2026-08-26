/**
 * The mapping, from both sides, plus the one thing a rename would break.
 *
 * A dispatcher that names a gate `package.json` no longer defines would fail at
 * edit time with an npm error rather than a violation, so every gate it can
 * emit is checked against the real scripts here.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {
  MAPPED_GATES,
  checkCommandsFor,
  gatesFor,
  repoRelativeFile,
} from './gate-hook.mjs';

const ROOT = '/repo';

test('every gate the dispatcher can name exists in package.json', () => {
  const { scripts } = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  const missing = MAPPED_GATES.filter((gate) => scripts[gate] === undefined);
  assert.deepEqual(missing, []);
});

test('a skill and an adapter reach the skills gate', () => {
  assert.deepEqual(gatesFor('.agents/skills/shalomut-map/SKILL.md'), ['lint:skills']);
  assert.deepEqual(gatesFor('AGENTS.md'), ['lint:skills']);
  assert.deepEqual(gatesFor('.github/copilot-instructions.md'), ['lint:skills']);
});

test('package.json reaches every gate that reads it', () => {
  assert.deepEqual(gatesFor('package.json'), [
    'lint:gate-inventory',
    'lint:deploy-migrations',
    'lint:interpreter',
  ]);
});

test('a route handler reaches the error-body gate', () => {
  assert.deepEqual(gatesFor('src/app/api/rounds/[id]/route.ts'), [
    'lint:error-bodies',
    'lint:tenant-chokepoints',
  ]);
});

test('an ordinary component maps to nothing, and that is not a pass', () => {
  // The dispatcher is a convenience; `verify:core` is what proves a change.
  assert.deepEqual(gatesFor('src/components/ui/stat-stone.tsx'), []);
  assert.deepEqual(gatesFor('README.md'), []);
});

test('the Python half of the literals gate is never dispatched', () => {
  // It needs an interpreter from `.venv`; a missing local environment must not
  // read as a violation at edit time.
  assert.equal(MAPPED_GATES.includes('lint:literals'), false);
  assert.deepEqual(gatesFor('src/lib/services/analytics.service.ts'), []);
});

test('a mutated file reaches both gates that measure it', () => {
  assert.deepEqual(gatesFor('src/lib/ai-contract.ts'), [
    'lint:mutation-config',
    'lint:contract-refusals',
  ]);
});

test('the audit reaches its own count as well as the numbers gate', () => {
  assert.deepEqual(gatesFor('docs/critical-audit-2026-08-21.md'), [
    'lint:doc-numbers',
    'lint:audit-count',
  ]);
});

test('an absolute path inside the repository comes back relative', () => {
  const payload = { tool_input: { file_path: `${ROOT}/src/app/api/x/route.ts` } };
  assert.equal(repoRelativeFile(payload, ROOT), 'src/app/api/x/route.ts');
});

test('the tool response wins over the request, as it is what was written', () => {
  const payload = {
    tool_input: { file_path: `${ROOT}/asked.md` },
    tool_response: { filePath: `${ROOT}/written.md` },
  };
  assert.equal(repoRelativeFile(payload, ROOT), 'written.md');
});

test('a path outside the repository is not this repository’s business', () => {
  assert.equal(repoRelativeFile({ tool_input: { file_path: '/etc/hosts' } }, ROOT), null);
});

test('a payload with no file at all is silent', () => {
  assert.equal(repoRelativeFile({}, ROOT), null);
  assert.equal(repoRelativeFile(null, ROOT), null);
  assert.equal(repoRelativeFile({ tool_input: { file_path: '' } }, ROOT), null);
});

test('the gate command is reduced to its check, not its tests', () => {
  assert.deepEqual(
    checkCommandsFor(
      'node --test scripts/check-agent-skills.test.mjs && node scripts/check-agent-skills.mjs',
    ),
    [['node', 'scripts/check-agent-skills.mjs']],
  );
});

test('a gate that is only a test suite keeps its suite', () => {
  // `lint:docs-publish` has no second half; running the suite is the only way
  // to run that gate at all.
  assert.deepEqual(checkCommandsFor('node --test scripts/publish-doc.test.mjs'), [
    ['node', '--test', 'scripts/publish-doc.test.mjs'],
  ]);
});

test('a gate with two checks after its tests runs both', () => {
  assert.deepEqual(
    checkCommandsFor(
      'node --test scripts/check-version-literals.test.mjs && ' +
        'node scripts/check-version-literals.mjs && ' +
        'node scripts/check-version-literals-python.mjs',
    ),
    [
      ['node', 'scripts/check-version-literals.mjs'],
      ['node', 'scripts/check-version-literals-python.mjs'],
    ],
  );
});
