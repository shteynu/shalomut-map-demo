import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * Documents quote numbers that live in configuration, and nothing used to
 * notice when the two parted ways. On 2026-08-20 the idle poll backoff changed
 * `AI_JOB_POLL_MAX_INTERVAL_SECONDS` from nothing to thirty seconds, and three
 * documents went on saying the worker asks Core every two seconds — one of them
 * for two days, the other two until someone happened to open them.
 *
 * This is the same shape as `check-version-literals.mjs` and
 * `generate-endpoint-surface.mjs --check`: the code is the source, the prose is
 * the copy, and a disagreement is a failed check rather than a discovery.
 *
 * What it cannot do is worth stating plainly. It compares numbers that name a
 * source. It cannot see that a paragraph now describes behaviour the code no
 * longer has, or that a diagram draws the wrong shape. The hardest edit of that
 * same day — a passage claiming nobody had counted what idle polling costs —
 * would sail through this check untouched. Numbers stop depending on whether an
 * agent remembered; meaning still does.
 */

/** Where each documented number actually comes from. */
export const SOURCES = {
  AI_JOB_POLL_INTERVAL_SECONDS: {
    file: 'ai-analytics-service/src/config.py',
    pattern: /os\.getenv\("AI_JOB_POLL_INTERVAL_SECONDS", "([\d.]+)"\)/,
  },
  AI_JOB_POLL_MAX_INTERVAL_SECONDS: {
    file: 'ai-analytics-service/src/config.py',
    pattern: /os\.getenv\("AI_JOB_POLL_MAX_INTERVAL_SECONDS", "([\d.]+)"\)/,
  },
  AI_JOB_HEARTBEAT_INTERVAL_SECONDS: {
    file: 'ai-analytics-service/src/config.py',
    pattern: /os\.getenv\("AI_JOB_HEARTBEAT_INTERVAL_SECONDS", "([\d.]+)"\)/,
  },
  AI_ANALYSIS_JOB_LEASE_MS: {
    file: 'src/lib/server/ai-analysis-worker.ts',
    pattern: /AI_ANALYSIS_JOB_LEASE_MS = ([\d_]+)/,
    // Declared in milliseconds, written in documents as seconds.
    divideBy: 1000,
  },
  AI_ANALYSIS_JOB_MAX_ATTEMPTS: {
    file: 'src/lib/server/ai-analysis-worker.ts',
    pattern: /AI_ANALYSIS_JOB_MAX_ATTEMPTS = (\d+)/,
  },
};

/**
 * A row in the HTML settings table that names its own setting. Generated from
 * the setting name rather than written out, so adding a row to the registry
 * cannot disagree with the row in the page about which setting it describes.
 */
const htmlRowNamingSetting = (setting) =>
  new RegExp(
    `<td class="num">([\\d.,]+)[^<]*</td><td class="src">${setting}</td>`,
  );

/** The same idea for the Markdown table, whose third cell names the setting. */
const markdownRowNamingSetting = (setting) =>
  new RegExp(`\\|\\s*([\\d.,]+)\\s*s\\s*\\|\\s*\`${setting}\``);

/**
 * Every place a document states one of those numbers.
 *
 * `where` is for the failure message: it has to tell a reader which sentence to
 * open, because a document may state the same number in a table, a diagram and
 * a paragraph, and only one of them is usually wrong.
 */
export const CLAIMS = [
  // docs/ai-analysis-run-lifecycle.md — the numbers table.
  ...['AI_JOB_POLL_INTERVAL_SECONDS', 'AI_JOB_POLL_MAX_INTERVAL_SECONDS',
    'AI_JOB_HEARTBEAT_INTERVAL_SECONDS', 'AI_ANALYSIS_JOB_LEASE_MS'].map(
    (setting) => ({
      document: 'docs/ai-analysis-run-lifecycle.md',
      setting,
      where: 'the numbers table',
      pattern: markdownRowNamingSetting(setting),
    }),
  ),

  // docs/ai-analysis-jobs.html — the settings table.
  ...['AI_JOB_POLL_INTERVAL_SECONDS', 'AI_JOB_POLL_MAX_INTERVAL_SECONDS',
    'AI_JOB_HEARTBEAT_INTERVAL_SECONDS', 'AI_ANALYSIS_JOB_LEASE_MS',
    'AI_ANALYSIS_JOB_MAX_ATTEMPTS'].map((setting) => ({
    document: 'docs/ai-analysis-jobs.html',
    setting,
    where: 'the settings table',
    pattern: htmlRowNamingSetting(setting),
  })),

  // docs/ai-analysis-jobs.html — the sequence diagram states the cadence twice
  // in one label, and a label is exactly what nobody thinks to update.
  {
    document: 'docs/ai-analysis-jobs.html',
    setting: 'AI_JOB_POLL_INTERVAL_SECONDS',
    where: 'the `loop` label of the claim sequence diagram',
    pattern: /loop поллинг: ([\d.,]+) с, до [\d.,]+ с на простое/,
  },
  {
    document: 'docs/ai-analysis-jobs.html',
    setting: 'AI_JOB_POLL_MAX_INTERVAL_SECONDS',
    where: 'the `loop` label of the claim sequence diagram',
    pattern: /loop поллинг: [\d.,]+ с, до ([\d.,]+) с на простое/,
  },

  // docs/ai-analysis-run-mechanics.html — its table names no settings, so the
  // rows are anchored on their labels instead.
  {
    document: 'docs/ai-analysis-run-mechanics.html',
    setting: 'AI_JOB_POLL_INTERVAL_SECONDS',
    where: 'the numbers table, row «Интервал опроса»',
    pattern: /<td>Интервал опроса<\/td><td class="num">([\d.,]+) с<\/td>/,
  },
  {
    document: 'docs/ai-analysis-run-mechanics.html',
    setting: 'AI_JOB_POLL_MAX_INTERVAL_SECONDS',
    where: 'the numbers table, row «Потолок опроса на простое»',
    pattern:
      /<td>Потолок опроса на простое<\/td><td class="num">([\d.,]+) с<\/td>/,
  },
  {
    document: 'docs/ai-analysis-run-mechanics.html',
    setting: 'AI_JOB_HEARTBEAT_INTERVAL_SECONDS',
    where: 'the numbers table, row «Интервал стука»',
    pattern: /<td>Интервал стука<\/td><td class="num">([\d.,]+) с<\/td>/,
  },
  {
    document: 'docs/ai-analysis-run-mechanics.html',
    setting: 'AI_ANALYSIS_JOB_LEASE_MS',
    where: 'the numbers table, row «Срок аренды»',
    pattern: /<td>Срок аренды<\/td><td class="num">([\d.,]+) с<\/td>/,
  },

  // docs/ai-analysis-run-mechanics.html — both diagrams label the arrow with
  // the range, and both said «каждые 2 с» for two days after it stopped
  // being true.
  {
    document: 'docs/ai-analysis-run-mechanics.html',
    setting: 'AI_JOB_POLL_INTERVAL_SECONDS',
    where: 'the «раз в N–N с» labels on the diagrams',
    pattern: /раз в ([\d.,]+)–[\d.,]+ с/g,
  },
  {
    document: 'docs/ai-analysis-run-mechanics.html',
    setting: 'AI_JOB_POLL_MAX_INTERVAL_SECONDS',
    where: 'the «раз в N–N с» labels on the diagrams',
    pattern: /раз в [\d.,]+–([\d.,]+) с/g,
  },
];

/** `2,5` and `2.5` are one number; `90_000` is another. */
export function toNumber(written) {
  return Number(String(written).replace(',', '.').replace(/_/g, ''));
}

/** The configured default, as documents are expected to write it. */
export function readDefault(setting, readFile) {
  const source = SOURCES[setting];
  if (!source) return { error: `${setting}: not in SOURCES.` };

  let text;
  try {
    text = readFile(source.file);
  } catch {
    return { error: `${source.file}: cannot be read, so ${setting} has no source of truth.` };
  }

  const match = source.pattern.exec(text);
  if (!match) {
    return {
      error:
        `${source.file}: no longer declares a default for ${setting}. ` +
        'Either the setting moved — update SOURCES in scripts/check-doc-numbers.mjs — ' +
        'or it is gone and the documents quoting it need the same news.',
    };
  }

  const value = toNumber(match[1]) / (source.divideBy ?? 1);
  return Number.isFinite(value)
    ? { value }
    : { error: `${source.file}: the default for ${setting} is not a number.` };
}

/** Every value one claim states, or an explanation of why it states none. */
export function readClaim(claim, documentText) {
  const pattern = claim.pattern.global
    ? claim.pattern
    : new RegExp(claim.pattern.source, `${claim.pattern.flags}g`);

  const found = [...documentText.matchAll(pattern)].map((match) => match[1]);

  if (found.length === 0) {
    return {
      error:
        `${claim.document}: nothing matches the check for ${claim.setting} in ` +
        `${claim.where}. If that passage was rewritten, update CLAIMS in ` +
        'scripts/check-doc-numbers.mjs to match — a check whose anchor has ' +
        'quietly slipped off passes forever and guards nothing.',
    };
  }

  return { values: found };
}

export function check({ readFile }) {
  const errors = [];
  const defaults = new Map();

  for (const setting of new Set(CLAIMS.map((claim) => claim.setting))) {
    const result = readDefault(setting, readFile);
    if (result.error) errors.push(result.error);
    else defaults.set(setting, result.value);
  }

  for (const claim of CLAIMS) {
    if (!defaults.has(claim.setting)) continue;

    let text;
    try {
      text = readFile(claim.document);
    } catch {
      errors.push(`${claim.document}: cannot be read, but CLAIMS expects it.`);
      continue;
    }

    const result = readClaim(claim, text);
    if (result.error) {
      errors.push(result.error);
      continue;
    }

    const expected = defaults.get(claim.setting);
    for (const written of result.values) {
      if (toNumber(written) === expected) continue;
      errors.push(
        `${claim.document}: ${claim.where} says ${written} for ` +
          `${claim.setting}, which is configured as ${expected} in ` +
          `${SOURCES[claim.setting].file}. Update the document in the task ` +
          'that changed the number — that is the rule in docs/README.md.',
      );
    }
  }

  return errors;
}

function main() {
  const errors = check({ readFile: (file) => fs.readFileSync(file, 'utf-8') });

  if (errors.length > 0) {
    console.error('Documented numbers check failed:');
    errors.forEach((error) => console.error(`  ${error}`));
    process.exit(1);
  }

  console.log(
    `Documented numbers check passed: ${CLAIMS.length} claims across ` +
      `${new Set(CLAIMS.map((claim) => claim.document)).size} documents.`,
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
