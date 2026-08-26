import assert from 'node:assert';
import test from 'node:test';
import {
  checkAdapter,
  checkRouting,
  checkSkillDirectory,
  discoverEntrypoints,
  findRelativeLinks,
  findSkillCopies,
  findUnmappedSections,
  readFrontmatterField,
} from './check-agent-skills.mjs';

/**
 * A fake filesystem for the entrypoint sweep. `dirs` maps a directory to the
 * names it holds, `'dir'` for a subdirectory and `'file'` for a file; `files`
 * lists standalone paths that merely exist.
 */
const fakeFs = (dirs, files = []) => ({
  listDir: (dir) =>
    Object.entries(dirs[dir] ?? {}).map(([name, kind]) => ({
      name,
      isDirectory: kind === 'dir',
    })),
  exists: (target) => target in dirs || files.includes(target),
});

/** Discovery against a fake tree, with `.` defaulting to empty. */
const discover = (dirs, files) => {
  const fs = fakeFs({ '.': {}, ...dirs }, files);
  return discoverEntrypoints(fs.listDir, fs.exists);
};

const SKILL = (name) =>
  `---\nname: ${name}\ndescription: Do something useful in this repository.\n---\n\n# Title\n`;

/** A skill whose map classifies every section it contains. */
const MAPPED = (name, extra = '') =>
  `${SKILL(name)}
## How to read this skill

Always in force: \`Boundaries\`. On condition: \`Start\` — work begins.

## Boundaries

## Start
${extra}`;

const entries = (spec) =>
  Object.entries(spec).map(([name, kind]) => ({
    name,
    isDirectory: kind === 'dir',
    isMarkdown: kind === 'md',
  }));

test('frontmatter fields are read, and a missing block is not an empty one', () => {
  assert.strictEqual(readFrontmatterField(SKILL('a-skill'), 'name'), 'a-skill');
  assert.strictEqual(readFrontmatterField('# No frontmatter\n', 'name'), null);
});

test('a well-formed skill passes', () => {
  const files = { '.agents/skills/a-skill/SKILL.md': SKILL('a-skill') };
  assert.deepStrictEqual(checkSkillDirectory('.agents/skills/a-skill', files), []);
});

test('the frontmatter name must match the directory a client resolves', () => {
  const files = { '.agents/skills/a-skill/SKILL.md': SKILL('other-name') };
  const errors = checkSkillDirectory('.agents/skills/a-skill', files);

  assert.strictEqual(errors.length, 1);
  assert.match(errors[0], /does not match its directory/);
});

test('a description is required because it is the trigger surface', () => {
  const files = {
    '.agents/skills/a-skill/SKILL.md': '---\nname: a-skill\n---\n\n# Title\n',
  };
  const errors = checkSkillDirectory('.agents/skills/a-skill', files);

  assert.strictEqual(errors.length, 1);
  assert.match(errors[0], /description/);
});

test('a reference that is linked and present passes', () => {
  const files = {
    '.agents/skills/a-skill/SKILL.md': `${SKILL('a-skill')}\n[detail](references/detail.md)\n`,
    '.agents/skills/a-skill/references/detail.md': '# Detail\n',
  };

  assert.deepStrictEqual(checkSkillDirectory('.agents/skills/a-skill', files), []);
});

test('a link to a missing reference is the failure the split introduced', () => {
  const files = {
    '.agents/skills/a-skill/SKILL.md': `${SKILL('a-skill')}\n[detail](references/gone.md)\n`,
  };
  const errors = checkSkillDirectory('.agents/skills/a-skill', files);

  assert.strictEqual(errors.length, 1);
  assert.match(errors[0], /resolves to nothing/);
});

test('an orphaned reference fails too: the check works in both directions', () => {
  const files = {
    '.agents/skills/a-skill/SKILL.md': SKILL('a-skill'),
    '.agents/skills/a-skill/references/orphan.md': '# Orphan\n',
  };
  const errors = checkSkillDirectory('.agents/skills/a-skill', files);

  assert.strictEqual(errors.length, 1);
  assert.match(errors[0], /nothing in `a-skill` links to it/);
});

test('a reference linked from a sibling reference is reachable', () => {
  const files = {
    '.agents/skills/a-skill/SKILL.md': `${SKILL('a-skill')}\n[first](references/first.md)\n`,
    '.agents/skills/a-skill/references/first.md': '[second](second.md)\n',
    '.agents/skills/a-skill/references/second.md': '# Second\n',
  };

  assert.deepStrictEqual(checkSkillDirectory('.agents/skills/a-skill', files), []);
});

test('a back-link out of references resolves against its own directory', () => {
  const files = {
    '.agents/skills/a-skill/SKILL.md': `${SKILL('a-skill')}\n[detail](references/detail.md)\n`,
    '.agents/skills/a-skill/references/detail.md': '[back](../SKILL.md)\n',
  };

  assert.deepStrictEqual(checkSkillDirectory('.agents/skills/a-skill', files), []);
});

test('external and root-absolute links are somebody else’s problem', () => {
  assert.deepStrictEqual(
    findRelativeLinks('[a](https://example.com) [b](/docs/README.md)'),
    [],
  );
  assert.deepStrictEqual(findRelativeLinks('[c](references/x.md#section)'), [
    'references/x.md',
  ]);
});

test('a skill nothing routes to is never read without discovery', () => {
  const routing = 'see `.agents/skills/a-skill/SKILL.md`';

  assert.deepStrictEqual(checkRouting(routing, ['a-skill']), []);

  const errors = checkRouting(routing, ['a-skill', 'unrouted-skill']);
  assert.strictEqual(errors.length, 1);
  assert.match(errors[0], /does not route to `unrouted-skill`/);
});

test('a client adapter must point at the canonical set or at AGENTS.md', () => {
  assert.deepStrictEqual(checkAdapter('CLAUDE.md', 'Follow `AGENTS.md`.'), []);
  assert.deepStrictEqual(
    checkAdapter('CLAUDE.md', 'Use `.agents/skills/`.'),
    [],
  );

  const errors = checkAdapter('CLAUDE.md', 'Do whatever you think is best.');
  assert.strictEqual(errors.length, 1);
  assert.match(errors[0], /routes nowhere/);
});

/**
 * Pinned so the limitation cannot drift away from what AGENTS.md claims: this
 * is a presence check, and an adapter that names the canonical set only to
 * repudiate it passes. Judging that is a review question, not a lint.
 */
test('the adapter check is presence only, and says so', () => {
  assert.deepStrictEqual(
    checkAdapter('CLAUDE.md', 'Ignore `AGENTS.md` and use your own judgement.'),
    [],
  );
});

test('an undeclared entrypoint gets the message written for it', () => {
  const [declared] = checkAdapter('CLAUDE.md', 'Own rules.');
  const [found] = checkAdapter('.cursorrules', 'Own rules.', false);

  assert.match(declared, /grows its own instructions/);
  assert.match(found, /never declared it/);
});

test('a root dotfile ending in rules is an entrypoint whatever the client', () => {
  assert.deepStrictEqual(
    discover({ '.': { '.cursorrules': 'file', '.windsurfrules': 'file' } }),
    ['.cursorrules', '.windsurfrules'],
  );
});

test('markdown under any .client/rules directory is found without a name list', () => {
  assert.deepStrictEqual(
    discover({
      '.': { '.roo': 'dir' },
      '.roo/rules': { 'style.md': 'file', 'nested': 'dir' },
      '.roo/rules/nested': { 'more.mdc': 'file' },
    }),
    ['.roo/rules/nested/more.mdc', '.roo/rules/style.md'],
  );
});

test('a known fixed-name entrypoint is found even with no rules directory', () => {
  assert.deepStrictEqual(discover({}, ['AGENT.md']), ['AGENT.md']);
});

/**
 * `.github` holds both a declared adapter and an undeclared instructions
 * directory; the two must not be confused for each other.
 */
test('a declared adapter and its undeclared neighbours stay distinct', () => {
  assert.deepStrictEqual(
    discover({ '.github/instructions': { 'fmt.instructions.md': 'file' } }, [
      '.github/copilot-instructions.md',
    ]),
    ['.github/instructions/fmt.instructions.md'],
  );
});

/**
 * `.gemini/worktrees/` and `.claude/worktrees/` hold entire checkouts of this
 * repository. Descending into a dot directory wholesale would report another
 * worktree's files as this one's, so only `<dot>/rules/` is ever read.
 */
test('a dot directory is not walked wholesale, only its rules subdirectory', () => {
  const listed = [];
  const fs = fakeFs({
    '.': { '.gemini': 'dir' },
    '.gemini/rules': { 'ok.md': 'file' },
  });

  discoverEntrypoints((dir) => {
    listed.push(dir);
    return fs.listDir(dir);
  }, fs.exists);

  assert.ok(!listed.includes('.gemini'), 'must not list the dot directory');
  assert.ok(listed.includes('.gemini/rules'));
});

test('ordinary project files are not mistaken for entrypoints', () => {
  assert.deepStrictEqual(
    discover({
      '.': { 'README.md': 'file', 'PROGRESS.md': 'file', 'src': 'dir', '.git': 'dir' },
    }),
    [],
  );
});

test('a map that classifies every section passes', () => {
  assert.deepStrictEqual(findUnmappedSections(MAPPED('a-skill')), []);
});

test('a section in neither half of the map is unreachable', () => {
  const problems = findUnmappedSections(`${MAPPED('a-skill')}\n## Forgotten\n`);

  assert.strictEqual(problems.length, 1);
  assert.match(problems[0], /`Forgotten` is in neither half/);
});

test('a skill with sections but no map at all fails', () => {
  const problems = findUnmappedSections(`${SKILL('a-skill')}\n## Boundaries\n`);

  assert.strictEqual(problems.length, 1);
  assert.match(problems[0], /no `How to read this skill` section/);
});

test('the map check is wired into the directory check', () => {
  const files = {
    '.agents/skills/a-skill/SKILL.md': `${MAPPED('a-skill')}\n## Forgotten\n`,
  };
  const errors = checkSkillDirectory('.agents/skills/a-skill', files);

  assert.strictEqual(errors.length, 1);
  assert.match(errors[0], /no stated condition to open it/);
});

test('a SKILL.md outside the canonical root is a fork', () => {
  const errors = findSkillCopies(
    ['.claude/skills'],
    ['a-skill'],
    () => true,
    () => entries({ 'a-skill': 'dir' }),
  );

  assert.strictEqual(errors.length, 1);
  assert.match(errors[0], /named after the canonical skill/);
});

/**
 * The failure the real repository was carrying: an empty directory named after
 * a canonical skill, holding nothing and passing every earlier reading.
 */
test('an empty directory named after a canonical skill fails too', () => {
  const errors = findSkillCopies(
    ['.gemini/skills'],
    ['shalomut-tracker'],
    () => true,
    () => entries({ 'shalomut-tracker': 'dir' }),
  );

  assert.strictEqual(errors.length, 1);
  assert.match(errors[0], /waiting for its first file/);
});

test('a stray markdown file under a forbidden root is skill-shaped too', () => {
  const errors = findSkillCopies(
    ['.claude/skills'],
    ['a-skill'],
    () => true,
    () => entries({ 'notes.md': 'md' }),
  );

  assert.strictEqual(errors.length, 1);
  assert.match(errors[0], /skill-shaped content outside/);
});

test('a forbidden root that does not exist is not a problem', () => {
  assert.deepStrictEqual(
    findSkillCopies(
      ['.claude/skills'],
      ['a-skill'],
      () => false,
      () => {
        throw new Error('must not read a root that does not exist');
      },
    ),
    [],
  );
});
