import assert from 'node:assert';
import test from 'node:test';
import {
  findHardcodedInterpreter,
  findInCommand,
  findInPackageScripts,
  findInWorkflow,
} from './check-python-interpreter.mjs';

test('the exact regression this gate exists for', () => {
  // src/app/api/__tests__/ai-e2e.test.ts:181 as it stood until 2026-08-12.
  const errors = findHardcodedInterpreter(
    "const python = spawnSync('python3', ['-m', 'tests.stub_pipeline_cli'], {",
    'src/app/api/__tests__/ai-e2e.test.ts',
  );

  assert.strictEqual(errors.length, 1);
  assert.match(errors[0], /ai-e2e\.test\.ts:1:/);
  assert.match(errors[0], /ai-service-python\.mjs/);
});

test('a package script that runs the interpreter by name is a violation', () => {
  const errors = findInPackageScripts({
    scripts: {
      'lint:literals':
        'node scripts/check-version-literals.mjs && python3 ai-analytics-service/scripts/check_version_literals.py',
    },
  });

  assert.strictEqual(errors.length, 1);
  assert.match(errors[0], /`lint:literals` script/);
});

test('a workflow step is code too — CI is where the next one will appear', () => {
  const errors = findInWorkflow(
    ['jobs:', '  test:', '    steps:', '      - run: python3 -m pytest'].join(
      '\n',
    ),
    '.github/workflows/test.yml',
  );

  assert.strictEqual(errors.length, 1);
  assert.match(errors[0], /test\.yml:4:/);
});

test('bare `python` is the same mistake with a shorter name', () => {
  assert.strictEqual(findInCommand('python -m pytest').length, 1);
  assert.strictEqual(findInCommand('foo && python run_tests.py').length, 1);
});

test('the resolved interpreter is what the rule asks for', () => {
  for (const command of [
    '.venv/bin/python -m pytest',
    'ai-analytics-service/.venv/bin/python -m src.pipeline_cli',
    'cd ai-analytics-service && .venv/bin/python -m pip install -e ".[dev]"',
  ]) {
    assert.deepStrictEqual(findInCommand(command), [], command);
  }
});

test('building the virtualenv is the system interpreter’s one job', () => {
  assert.deepStrictEqual(findInCommand('python3 -m venv .venv'), []);
  assert.deepStrictEqual(
    findInCommand(
      'cd ai-analytics-service && python3 -m venv .venv && .venv/bin/python -m pip install -e ".[dev]"',
    ),
    [],
  );
});

test('prose about python3 is prose, not a spawn', () => {
  // Both halves of the resolver's own error message, which explains at length
  // why a system interpreter will not do. A gate that fails on its own
  // explanation gets switched off.
  assert.deepStrictEqual(
    findInCommand('A system python3 is not a substitute: the service needs'),
    [],
  );
  assert.deepStrictEqual(
    findHardcodedInterpreter(
      [
        '/**',
        ' * A bare `python3` is the wrong interpreter twice over.',
        ' */',
        '// never a `python3` from PATH',
        "const message = 'run python3 yourself, said no one';",
      ].join('\n'),
      'scripts/ai-service-python.mjs',
    ),
    [],
  );
});

test('a comment cannot hide a spawn on the line below it', () => {
  const errors = findHardcodedInterpreter(
    ['// resolve the interpreter properly one day', "spawn('python3');"].join(
      '\n',
    ),
    'scripts/anything.mjs',
  );

  assert.strictEqual(errors.length, 1);
  assert.match(errors[0], /anything\.mjs:2:/);
});

test('a block comment does not shift the reported line', () => {
  const errors = findHardcodedInterpreter(
    ['/*', ' * three', ' * lines', ' */', "spawnSync('python3', []);"].join(
      '\n',
    ),
    'scripts/anything.mjs',
  );

  assert.strictEqual(errors.length, 1);
  assert.match(errors[0], /anything\.mjs:5:/);
});

test('a URL is not a line comment', () => {
  assert.deepStrictEqual(
    findHardcodedInterpreter(
      ['// see https://example.test/docs', "spawnSync('python3', []);"].join(
        '\n',
      ),
      'scripts/anything.mjs',
    ).length,
    1,
  );
});

test('the last segment of a path is not a program name', () => {
  // How the resolver and local-stack.mjs both spell the correct interpreter.
  // Reading a lone 'python' as argv[0] wherever it appears would fail the gate
  // on the very code it exists to protect.
  for (const source of [
    "const interpreter = path.join(aiServiceRoot, '.venv', 'bin', 'python');",
    'const venvPython = path.join(aiServiceRoot, ".venv", "bin", "python");',
  ]) {
    assert.deepStrictEqual(
      findHardcodedInterpreter(source, 'scripts/local-stack.mjs'),
      [],
      source,
    );
  }
});

test('a lone interpreter still counts where a spawn reads it as argv[0]', () => {
  for (const source of [
    "spawnSync('python', ['-m', 'pytest']);",
    'execFileSync("python3", args);',
    "spawn(\n  'python3',\n  args,\n);",
  ]) {
    assert.strictEqual(
      findHardcodedInterpreter(source, 'scripts/anything.mjs').length,
      1,
      source,
    );
  }
});

test('the gate does not scan its own fixtures', () => {
  assert.deepStrictEqual(
    findHardcodedInterpreter(
      "spawnSync('python3', []);",
      'scripts/check-python-interpreter.test.mjs',
    ),
    [],
  );
});

test('an ordinary spawn is left alone', () => {
  assert.deepStrictEqual(
    findHardcodedInterpreter(
      "spawnSync(process.execPath, ['--import', 'tsx', '--test']);",
      'scripts/run-tests.mjs',
    ),
    [],
  );
});
