import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Structural check for the canonical agent skills.
 *
 * `AGENTS.md` states that `.agents/skills/` is the one set of skills every
 * client reads, and `GEMINI.md` has said since 2026-07-30 not to create
 * duplicate `.gemini/skills/` copies. Prose did not hold: a partial 3,442-byte
 * copy of `shalomut-tracker` was made anyway, and `.gemini/skills/` was still
 * carrying an empty leftover directory a fortnight later. Neither was visible
 * to Git, because `.gitignore` ignores `.claude/` and `.gemini/` — which is
 * exactly why a copy in one of them is dangerous rather than merely redundant.
 *
 * The rules below are the ones a reader cannot verify by reading:
 *
 * 1. Every skill named in the routing exists, and its frontmatter `name`
 *    matches its directory, because that pairing is what a discovering client
 *    resolves.
 * 2. Every relative link inside a skill resolves. Splitting a skill into
 *    `references/` traded reading budget for exactly one new failure mode — a
 *    pointer to a file that is not there — and a reference nobody can open is
 *    a rule that has silently stopped applying.
 * 3. No `references/` file is orphaned. An unreferenced file is not
 *    progressive disclosure; it is a rule with no route to it.
 * 4. Every `## ` section is classified by the skill's own reading map. Since
 *    `AGENTS.md` made that map decide how much of a skill a task needs, a
 *    section the map never names is unreachable for the same reason an orphaned
 *    reference is.
 * 5. Nothing that looks like a skill exists outside `.agents/skills/` — not a
 *    `SKILL.md`, not a stray `references/` file, and not an empty directory
 *    named after a canonical skill, which is that fork one file from being
 *    live. Two copies both claim to be canonical and drift without a diff.
 * 6. Every client entrypoint routes to the canonical location, so a new client
 *    cannot quietly grow its own instructions. The four declared adapters must
 *    exist; anything else that is shaped like an entrypoint must route if it is
 *    present. This is a presence check: it cannot tell whether an adapter's
 *    prose contradicts what it points at, and `AGENTS.md` says so rather than
 *    claiming more.
 */
const SKILLS_ROOT = '.agents/skills';
const ROUTING_FILE = 'AGENTS.md';

/** Locations a client would plausibly look in, and must not find a skill in. */
const FORBIDDEN_SKILL_ROOTS = [
  '.claude/skills',
  '.gemini/skills',
  '.github/skills',
  'skills',
];

/** Declared adapters: each must exist and must route to the canonical set. */
const REQUIRED_ADAPTERS = [
  'CLAUDE.md',
  'GEMINI.md',
  '.github/copilot-instructions.md',
  'docs/agent-tasks/README.md',
];

/**
 * Entrypoints this repository has not adopted, by the fixed filename their
 * client reads. Optional — but the moment one appears it is instructions an
 * agent will follow, so it has to route here like the declared four.
 */
const KNOWN_ENTRYPOINT_FILES = [
  'AGENT.md',
  'CONVENTIONS.md',
  '.junie/guidelines.md',
  '.idx/airules.md',
];

/** Directories whose Markdown files a client loads as instructions. */
const KNOWN_ENTRYPOINT_DIRS = ['.github/instructions', '.clinerules'];

/**
 * The shapes, for clients nobody here has heard of yet. A curated list of
 * product names is a list that is wrong the week after it is written, so these
 * two patterns carry the general case: a root dotfile ending in `rules`
 * (`.cursorrules`, `.windsurfrules`), and Markdown under `.<client>/rules/`
 * (`.cursor/rules/`, `.amazonq/rules/`, `.roo/rules/`). No ordinary project
 * file has either shape, so the false-positive cost is close to zero and the
 * failure it prevents — a second set of instructions nobody compared against
 * this one — is not.
 */
const ROOT_RULES_FILE = /^\.[a-z0-9._-]*rules$/;
const INSTRUCTION_EXTENSIONS = ['.md', '.mdc'];
const NEVER_SCAN = new Set(['.git', '.agents', 'node_modules']);

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---/;
const MARKDOWN_LINK = /\[[^\]]*\]\(([^)\s]+)\)/g;
const READING_MAP_HEADING = 'Как читать этот скилл';

/**
 * Sections a skill's reading map must classify, and the map itself, which
 * classifies rather than is classified.
 */
export function findUnmappedSections(source) {
  const sections = [...source.matchAll(/^## (.+)$/gm)].map((match) =>
    match[1].trim(),
  );
  if (!sections.includes(READING_MAP_HEADING)) {
    return sections.length === 0
      ? []
      : [`has no \`${READING_MAP_HEADING}\` section`];
  }

  const start = source.indexOf(`## ${READING_MAP_HEADING}`);
  const rest = source.slice(start + READING_MAP_HEADING.length);
  const end = rest.indexOf('\n## ');
  const map = end === -1 ? rest : rest.slice(0, end);

  return sections
    .filter((section) => section !== READING_MAP_HEADING)
    .filter((section) => !map.includes(section))
    .map(
      (section) =>
        `section \`${section}\` is in neither half of the reading map`,
    );
}

export function readFrontmatterField(source, field) {
  const block = source.match(FRONTMATTER)?.[1];
  if (!block) return null;
  const line = block
    .split('\n')
    .find((candidate) => candidate.startsWith(`${field}:`));
  return line ? line.slice(field.length + 1).trim() : null;
}

/**
 * Relative links only. An `https://` reference is somebody else's uptime, and a
 * repository-root path is covered by the link checks the docs already get.
 */
export function findRelativeLinks(source) {
  const links = [];
  for (const match of source.matchAll(MARKDOWN_LINK)) {
    const target = match[1].split('#')[0];
    if (!target || /^[a-z][a-z0-9+.-]*:/i.test(target) || target.startsWith('/')) {
      continue;
    }
    links.push(target);
  }
  return links;
}

export function checkSkillDirectory(dir, files) {
  const errors = [];
  const name = path.basename(dir);
  const skillFile = `${dir}/SKILL.md`;
  const source = files[skillFile];

  if (source === undefined) {
    return [`${skillFile}: missing. Every skill directory needs a SKILL.md.`];
  }

  const declaredName = readFrontmatterField(source, 'name');
  if (declaredName === null) {
    errors.push(`${skillFile}: frontmatter has no \`name\`.`);
  } else if (declaredName !== name) {
    errors.push(
      `${skillFile}: frontmatter name \`${declaredName}\` does not match its ` +
        `directory \`${name}\`. A discovering client resolves the pair.`,
    );
  }

  const description = readFrontmatterField(source, 'description');
  if (!description) {
    errors.push(
      `${skillFile}: frontmatter has no \`description\`. It is the trigger ` +
        'surface a client matches a task against.',
    );
  }

  const linkedFromSkill = new Set();
  for (const [file, contents] of Object.entries(files)) {
    if (!file.startsWith(`${dir}/`)) continue;
    for (const target of findRelativeLinks(contents)) {
      const resolved = path.posix.normalize(
        path.posix.join(path.posix.dirname(file), target),
      );
      if (files[resolved] === undefined && !fs.existsSync(resolved)) {
        errors.push(`${file}: link \`${target}\` resolves to nothing.`);
        continue;
      }
      linkedFromSkill.add(resolved);
    }
  }

  for (const file of Object.keys(files)) {
    if (!file.startsWith(`${dir}/references/`)) continue;
    if (linkedFromSkill.has(file)) continue;
    errors.push(
      `${file}: nothing in \`${name}\` links to it. An unreachable reference ` +
        'is a rule with no route to it.',
    );
  }

  for (const problem of findUnmappedSections(source)) {
    errors.push(
      `${skillFile}: ${problem}. The map decides how much of the skill a task ` +
        'needs, so an unclassified section has no stated condition to open it.',
    );
  }

  return errors;
}

/**
 * Fails on an empty directory too. The `.gemini/skills/shalomut-tracker/`
 * leftover of 2026-07-25 held no file and still passed every reading of the
 * rule; it was the scaffolding for the fork, not the fork.
 */
export function findSkillCopies(roots, canonicalNames, exists, listEntries) {
  const errors = [];
  for (const root of roots) {
    if (!exists(root)) continue;
    for (const entry of listEntries(root)) {
      if (canonicalNames.includes(entry.name)) {
        errors.push(
          `${root}/${entry.name}: named after the canonical skill ` +
            `\`${entry.name}\`. ${SKILLS_ROOT} is the only source of skills; a ` +
            'second copy drifts without a diff, and an empty one is that copy ' +
            'waiting for its first file.',
        );
      } else if (entry.isMarkdown || entry.isDirectory) {
        errors.push(
          `${root}/${entry.name}: skill-shaped content outside ` +
            `${SKILLS_ROOT}.`,
        );
      }
    }
  }
  return errors;
}

export function checkRouting(routingSource, skillNames) {
  const errors = [];
  for (const name of skillNames) {
    if (!routingSource.includes(`${SKILLS_ROOT}/${name}/SKILL.md`)) {
      errors.push(
        `${ROUTING_FILE}: does not route to \`${name}\`. A skill nothing ` +
          'routes to is never read by a client without discovery.',
      );
    }
  }
  return errors;
}

export function checkAdapter(file, source, declared = true) {
  if (source.includes(SKILLS_ROOT) || source.includes(ROUTING_FILE)) return [];
  return [
    `${file}: names neither \`${ROUTING_FILE}\` nor \`${SKILLS_ROOT}\`. ` +
      (declared
        ? 'A client entrypoint that routes nowhere grows its own instructions.'
        : 'This repository never declared it, and a client is reading it as ' +
          'instructions. Point it at the canonical set or delete it — a second ' +
          'set of rules nobody compared against the first is the whole failure.'),
  ];
}

/**
 * Everything that is shaped like a client entrypoint, declared or not.
 *
 * Only `<root>/.<client>/rules/` is descended into, never the whole dot
 * directory: `.gemini/worktrees/` and `.claude/worktrees/` hold entire
 * checkouts of this repository, and walking them would both cost seconds and
 * report another worktree's files as this one's.
 */
export function discoverEntrypoints(listDir, exists) {
  const found = new Set();

  for (const file of KNOWN_ENTRYPOINT_FILES) {
    if (exists(file)) found.add(file);
  }

  const collectFrom = (dir) => {
    if (!exists(dir)) return;
    for (const entry of listDir(dir)) {
      const full = `${dir}/${entry.name}`;
      if (entry.isDirectory) {
        collectFrom(full);
      } else if (INSTRUCTION_EXTENSIONS.some((ext) => entry.name.endsWith(ext))) {
        found.add(full);
      }
    }
  };

  for (const dir of KNOWN_ENTRYPOINT_DIRS) collectFrom(dir);

  for (const entry of listDir('.')) {
    if (NEVER_SCAN.has(entry.name)) continue;
    if (!entry.isDirectory && ROOT_RULES_FILE.test(entry.name)) {
      found.add(entry.name);
    }
    if (entry.isDirectory && entry.name.startsWith('.')) {
      collectFrom(`${entry.name}/rules`);
    }
  }

  return [...found].filter((file) => !REQUIRED_ADAPTERS.includes(file)).sort();
}

function readTree(dir, files = {}) {
  if (!fs.existsSync(dir)) return files;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.posix.join(dir, entry.name);
    if (entry.isDirectory()) {
      readTree(fullPath, files);
    } else if (entry.name.endsWith('.md')) {
      files[fullPath] = fs.readFileSync(fullPath, 'utf-8');
    }
  }
  return files;
}

function listEntries(root) {
  return fs.readdirSync(root, { withFileTypes: true }).map((entry) => ({
    name: entry.name,
    isDirectory: entry.isDirectory(),
    isMarkdown: entry.isFile() && entry.name.endsWith('.md'),
  }));
}

function main() {
  const errors = [];

  if (!fs.existsSync(SKILLS_ROOT)) {
    console.error(`Agent skills check failed:\n${SKILLS_ROOT}: missing.`);
    process.exit(1);
  }

  const files = readTree(SKILLS_ROOT);
  const skillNames = fs
    .readdirSync(SKILLS_ROOT, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);

  if (skillNames.length === 0) {
    errors.push(`${SKILLS_ROOT}: holds no skill directory.`);
  }

  for (const name of skillNames) {
    errors.push(...checkSkillDirectory(`${SKILLS_ROOT}/${name}`, files));
  }

  errors.push(
    ...checkRouting(fs.readFileSync(ROUTING_FILE, 'utf-8'), skillNames),
  );

  for (const adapter of REQUIRED_ADAPTERS) {
    if (!fs.existsSync(adapter)) {
      errors.push(`${adapter}: missing. It is a declared client entrypoint.`);
      continue;
    }
    errors.push(...checkAdapter(adapter, fs.readFileSync(adapter, 'utf-8')));
  }

  const discovered = discoverEntrypoints(listEntries, (p) => fs.existsSync(p));
  for (const entrypoint of discovered) {
    errors.push(
      ...checkAdapter(entrypoint, fs.readFileSync(entrypoint, 'utf-8'), false),
    );
  }

  errors.push(
    ...findSkillCopies(
      FORBIDDEN_SKILL_ROOTS,
      skillNames,
      (root) => fs.existsSync(root),
      listEntries,
    ),
  );

  if (errors.length > 0) {
    console.error('Agent skills check failed:');
    errors.forEach((error) => console.error(error));
    process.exit(1);
  }
  console.log(
    `Agent skills check passed: ${skillNames.length} canonical skills, ` +
      `${REQUIRED_ADAPTERS.length} declared entrypoints` +
      (discovered.length > 0
        ? ` and ${discovered.length} discovered (${discovered.join(', ')})`
        : '') +
      ', one set for every client.',
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
