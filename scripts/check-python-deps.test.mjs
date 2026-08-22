import assert from 'node:assert';
import test from 'node:test';
import {
  checkDeclaredAreLocked,
  checkDevLockAgrees,
  checkEveryRequirementIsHashed,
  compareVersions,
  findUnhashedInstalls,
  normalize,
  parseDeclared,
  parseLock,
  satisfies,
} from './check-python-deps.mjs';

const HASHED = [
  'fastapi==0.141.1 \\',
  '    --hash=sha256:aaaa \\',
  '    --hash=sha256:bbbb',
  '    # via shalomut-ai-analytics (pyproject.toml)',
  'httpx==0.28.1 \\',
  '    --hash=sha256:cccc',
].join('\n');

test('the exact regression this gate exists for: a bumped floor, an unchanged lock', () => {
  const errors = checkDeclaredAreLocked(
    ['fastapi>=0.150.0'],
    parseLock(HASHED),
    'ai-analytics-service/requirements.txt',
  );

  assert.strictEqual(errors.length, 1);
  assert.match(errors[0], /pinned at 0\.141\.1/);
  assert.match(errors[0], /uv pip compile/);
});

test('a declared dependency missing from the lock is named, not skipped', () => {
  const errors = checkDeclaredAreLocked(
    ['uvicorn[standard]>=0.28.0'],
    parseLock(HASHED),
    'ai-analytics-service/requirements.txt',
  );

  assert.strictEqual(errors.length, 1);
  assert.match(errors[0], /`uvicorn` is declared/);
});

test('an extra on a declared name does not hide the name', () => {
  const lock = parseLock('uvicorn==0.52.4 \\\n    --hash=sha256:dddd');

  assert.deepStrictEqual(
    checkDeclaredAreLocked(['uvicorn[standard]>=0.28.0'], lock, 'x'),
    [],
  );
});

test('PyPI name normalization, because `PyYAML` and `pyyaml` are one package', () => {
  assert.strictEqual(normalize('PyYAML'), 'pyyaml');
  assert.strictEqual(normalize('typing_extensions'), 'typing-extensions');
  assert.deepStrictEqual(
    checkDeclaredAreLocked(
      ['typing_extensions>=4.0'],
      parseLock('typing-extensions==4.16.0 \\\n    --hash=sha256:eeee'),
      'x',
    ),
    [],
  );
});

test('a requirement without hashes fails the whole file, and says so', () => {
  const errors = checkEveryRequirementIsHashed(
    parseLock('fastapi==0.141.1\nhttpx==0.28.1 \\\n    --hash=sha256:cccc'),
    'ai-analytics-service/requirements.txt',
  );

  assert.strictEqual(errors.length, 1);
  assert.match(errors[0], /`fastapi` carries no `--hash`/);
  assert.match(errors[0], /refuses the whole file/);
});

test('a hash on a continuation line belongs to its own requirement', () => {
  const lock = parseLock(HASHED);

  assert.deepStrictEqual(lock.get('fastapi').hashes, ['sha256:aaaa', 'sha256:bbbb']);
  assert.deepStrictEqual(lock.get('httpx').hashes, ['sha256:cccc']);
});

test('an environment marker is not part of the version', () => {
  const lock = parseLock(
    "colorama==0.4.6 ; sys_platform == 'win32' \\\n    --hash=sha256:ffff",
  );

  assert.strictEqual(lock.get('colorama').version, '0.4.6');
});

test('the dev lock testing a different version of a shipped package is a failure', () => {
  const errors = checkDevLockAgrees(
    parseLock('fastapi==0.141.1 \\\n    --hash=sha256:aaaa'),
    parseLock('fastapi==0.140.0 \\\n    --hash=sha256:zzzz'),
  );

  assert.strictEqual(errors.length, 1);
  assert.match(errors[0], /0\.140\.0 here and 0\.141\.1/);
  assert.match(errors[0], /the deployment does not run/);
});

test('a package the deployment has and the suite does not is also a failure', () => {
  const errors = checkDevLockAgrees(
    parseLock('uvloop==0.22.1 \\\n    --hash=sha256:aaaa'),
    parseLock('fastapi==0.141.1 \\\n    --hash=sha256:bbbb'),
  );

  assert.strictEqual(errors.length, 1);
  assert.match(errors[0], /`uvloop`/);
});

test('dropping the flag from an install line is caught wherever the line lives', () => {
  const errors = findUnhashedInstalls(
    [
      'RUN pip install --no-cache-dir -r requirements.txt',
      'RUN pip install --no-cache-dir --require-hashes -r requirements-dev.txt',
      'RUN pip install --no-deps -e .',
    ].join('\n'),
    'Dockerfile',
  );

  assert.strictEqual(errors.length, 1);
  assert.match(errors[0], /^Dockerfile:1:/);
  assert.match(errors[0], /--require-hashes/);
});

test('prose about the flag is not an install of it', () => {
  assert.deepStrictEqual(
    findUnhashedInstalls(
      'Until 2026-08-22 requirements.txt was four `>=` lines and nothing was hashed.',
      'ai-analytics-service/README.md',
    ),
    [],
  );
});

test('the declared arrays are read out of the real pyproject shape', () => {
  const declared = parseDeclared(
    [
      '[build-system]',
      'requires = ["setuptools>=61.0"]',
      '',
      '[project]',
      'name = "shalomut-ai-analytics"',
      'dependencies = [',
      '    "fastapi>=0.110.0",',
      '    "httpx>=0.27.0",',
      ']',
      '',
      '[project.optional-dependencies]',
      'dev = [',
      '    "pytest>=8.1.0",',
      ']',
    ].join('\n'),
  );

  assert.deepStrictEqual(declared.runtime, ['fastapi>=0.110.0', 'httpx>=0.27.0']);
  assert.deepStrictEqual(declared.dev, ['pytest>=8.1.0']);
});

test('a restructured pyproject throws rather than checking nothing', () => {
  assert.throws(
    () => parseDeclared('[project]\nname = "x"\n'),
    /no `dependencies` under \[project\]/,
  );
});

test('a specifier this gate cannot evaluate throws rather than passing', () => {
  assert.throws(() => satisfies('1.2.3', '~=1.2'), /unsupported version specifier/);
  assert.throws(() => compareVersions('1.2.3', '1.2.0rc1'), /numerically/);
});

test('version comparison is numeric, not lexicographic', () => {
  assert.strictEqual(compareVersions('0.110.0', '0.28.0'), 1);
  assert.strictEqual(compareVersions('2.6', '2.6.0'), 0);
  assert.ok(satisfies('0.141.1', '>=0.110.0'));
  assert.ok(!satisfies('0.28.0', '>=0.110.0'));
});
