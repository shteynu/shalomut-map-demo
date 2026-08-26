/**
 * The check on script tables written to be caught and to be let through.
 *
 * Each of the three rules is exercised from both sides, including the one the
 * chain check exists for: a gate whose name is a prefix of another gate's must
 * not pass on that other gate's step.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  checkGateTests,
  checkInventoryCoverage,
  checkVerifyCore,
  gateNames,
  parseInventoryGates,
} from './check-gate-inventory.mjs';

const gate = (name, subject = name.replace('lint:', 'check-')) =>
  `node --test scripts/${subject}.test.mjs && node scripts/${subject}.mjs`;

const present = () => true;

test('gates are the `lint:*` scripts, sorted', () => {
  assert.deepEqual(
    gateNames({ 'lint:fonts': '', build: '', 'lint:audit-count': '' }),
    ['lint:audit-count', 'lint:fonts'],
  );
});

test('the inventory is read as the code spans it names', () => {
  const source = [
    '| `lint:fonts` | шрифт из сети | `scripts/check-local-fonts.mjs` |',
    'Обычный `npm run lint` сюда не относится.',
  ].join('\n');

  assert.deepEqual(parseInventoryGates(source), ['lint:fonts']);
});

test('a gate the inventory omits is caught', () => {
  const errors = checkInventoryCoverage(
    { 'lint:fonts': gate('lint:fonts'), 'lint:skills': gate('lint:skills') },
    ['lint:fonts'],
  );

  assert.equal(errors.length, 1);
  assert.match(errors[0], /does not name `lint:skills`/);
  assert.match(errors[0], /no route back to its rule/);
});

test('a row for a gate that no longer exists is caught', () => {
  const errors = checkInventoryCoverage({ 'lint:fonts': gate('lint:fonts') }, [
    'lint:fonts',
    'lint:removed',
  ]);

  assert.equal(errors.length, 1);
  assert.match(errors[0], /names `lint:removed`/);
});

test('an inventory that matches package.json is silent', () => {
  assert.deepEqual(
    checkInventoryCoverage({ 'lint:fonts': gate('lint:fonts'), build: 'next build' }, [
      'lint:fonts',
      'lint:fonts',
    ]),
    [],
  );
});

test('a gate outside verify:core is caught', () => {
  const errors = checkVerifyCore({
    'lint:fonts': gate('lint:fonts'),
    'lint:skills': gate('lint:skills'),
    'verify:core': 'npm run lint:fonts && npm run build',
  });

  assert.equal(errors.length, 1);
  assert.match(errors[0], /`lint:skills` is not a step of `verify:core`/);
});

test('a prefix of another step does not count as membership', () => {
  const errors = checkVerifyCore({
    'lint:doc': gate('lint:doc'),
    'lint:doc-numbers': gate('lint:doc-numbers'),
    'verify:core': 'npm run lint:doc-numbers',
  });

  assert.equal(errors.length, 1);
  assert.match(errors[0], /`lint:doc` is not a step/);
});

test('a missing verify:core is the whole chain missing', () => {
  const errors = checkVerifyCore({ 'lint:fonts': gate('lint:fonts') });

  assert.equal(errors.length, 1);
  assert.match(errors[0], /no `verify:core` script/);
});

test('a gate that skips its own test is caught', () => {
  const errors = checkGateTests(
    { 'lint:fonts': 'node scripts/check-local-fonts.mjs' },
    present,
  );

  assert.equal(errors.length, 1);
  assert.match(errors[0], /does not run `node --test` first/);
});

test('a gate whose test file is not there is caught', () => {
  const errors = checkGateTests({ 'lint:fonts': gate('lint:fonts') }, () => false);

  assert.equal(errors.length, 1);
  assert.match(errors[0], /which does not exist/);
});

test('several test files before the check are all allowed and all checked', () => {
  const command =
    'node --test scripts/deploy-migrate.test.mjs scripts/check-deploy-migrations.test.mjs' +
    ' && node scripts/check-deploy-migrations.mjs';
  const seen = [];

  assert.deepEqual(
    checkGateTests({ 'lint:deploy-migrations': command }, (file) => {
      seen.push(file);
      return true;
    }),
    [],
  );
  assert.deepEqual(seen, [
    'scripts/deploy-migrate.test.mjs',
    'scripts/check-deploy-migrations.test.mjs',
  ]);
});

test('a gate that is only a test suite is a gate', () => {
  // `lint:docs-publish` runs tests and no separate check; that is the whole
  // gate, not a command missing its second half.
  assert.deepEqual(
    checkGateTests(
      { 'lint:docs-publish': 'node --test scripts/publish-doc.test.mjs' },
      present,
    ),
    [],
  );
});
