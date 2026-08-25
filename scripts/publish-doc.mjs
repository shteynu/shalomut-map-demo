import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

/**
 * Turns one of the repository's standalone HTML documents into the body an
 * artifact platform expects, and refuses when the result would be wrong.
 *
 * The three documents under `docs/` — `how-shalomut-works.html`,
 * `ai-analysis-jobs.html` and `ai-analysis-run-mechanics.html` — are whole
 * pages: they open from disk by double-click, with `vendor/mermaid.min.js`
 * beside them and nothing running. A publishing platform wraps content in its
 * own `<!doctype>`/`<head>`/`<body>` skeleton and injects its own mermaid, so
 * publishing means handing it the body alone, without the runtime this
 * repository ships for the offline case.
 *
 * Until this script existed that was an undocumented hand transformation, which
 * has two costs and both were paid. The next person derives it again from
 * nothing; and the 2026-08-20 pass stripped the two `<script src="vendor/…">`
 * lines but left the `<style>` between the same pair of markers, so two
 * published pages carry that rule twice. Nothing renders differently, which is
 * why it survived — a defect a reader cannot see is the kind a check is for.
 *
 * What it does, in order:
 *
 * 1. takes the inner HTML of `<body>` — the documents keep their `<title>`,
 *    font links and page `<style>` inside it, mirroring what the platform
 *    injects above them, so the head is skeleton and drops whole;
 * 2. removes each `claude-mermaid-runtime` block **entire**, markers included;
 * 3. refuses if anything still points at `vendor/`, because a strict CSP blocks
 *    every external host and a relative path resolves against the platform's
 *    origin, where the file does not exist. A `vendor/` reference outside the
 *    runtime block is something new that this script has not been taught;
 * 4. refuses if a page-level tag survived, or if `<title>` is missing or sits
 *    past the 8 KB the platform scans for it.
 *
 * It reports rather than refuses on two mermaid hazards that have each cost a
 * session: a `;` inside a quoted node label takes the whole diagram down, and a
 * `<br/>` written as itself rather than as `&lt;br/&gt;` reaches the renderer as
 * markup instead of a line break. Both are legal HTML and neither is visible in
 * a diff, so they are named and left to the publisher.
 *
 * Usage:
 *
 *   npm run docs:publish -- docs/how-shalomut-works.html
 *
 * The body lands in `tmp/published/`, which is gitignored: it is an artifact of
 * publishing, not a second copy of the document to drift from the first.
 */

const RUNTIME_BLOCK =
  /<!--claude-mermaid-runtime-begin:[^>]*-->[\s\S]*?<!--claude-mermaid-runtime-end-->\n?/g;

const BODY = /<body[^>]*>([\s\S]*)<\/body>/i;

/** Tags the platform supplies itself; any of them in the body is a double. */
const PAGE_TAGS = /<!doctype\b|<html\b|<\/html>|<head\b|<\/head>|<body\b|<\/body>/gi;

/** The platform scans this many bytes of the file for a `<title>`. */
export const TITLE_SCAN_BYTES = 8192;

const MERMAID_BLOCK = /<pre class="mermaid">([\s\S]*?)<\/pre>/g;

/** A quoted mermaid label: `A["…"]`, `B{"…"}`, `C("…")`. */
const MERMAID_LABEL = /"([^"]*)"/g;

const NAMED_ENTITIES = { lt: '<', gt: '>', quot: '"', apos: "'", nbsp: '\u00a0', amp: '&' };

/**
 * What the renderer receives, which is not what the file contains.
 *
 * The diagram sources sit inside `<pre>`, so mermaid reads them through
 * `textContent` with every entity already decoded. That matters for exactly one
 * check here: an entity ends in `;`, so `&lt;br/&gt;` — the spelling every
 * diagram in this repository uses for a line break — reads as two semicolons in
 * a label and would be reported as the defect it is the fix for. Decoding first
 * asks the question of the string the renderer parses.
 */
export function decodeEntities(text) {
  return text
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&(lt|gt|quot|apos|nbsp|amp);/g, (_, name) => NAMED_ENTITIES[name]);
}

/**
 * The transformation, as a pure function so the tests can state each refusal
 * without a file on disk.
 *
 * @param {string} html one whole document
 * @param {string} name what to call it in a message
 * @returns {{ body: string, title: string, notes: string[] }}
 */
export function toArtifactBody(html, name) {
  const matched = BODY.exec(html);
  if (!matched) {
    throw new Error(`${name}: no <body>…</body>, so there is nothing to publish.`);
  }

  const body = matched[1].replace(RUNTIME_BLOCK, '').trim();

  const vendor = body.match(/[^\s"'=]*vendor\/[^\s"'>]*/);
  if (vendor) {
    throw new Error(
      `${name}: the body still points at ${vendor[0]} after the mermaid runtime ` +
        'was removed. A published page reaches nothing outside itself, and a ' +
        'relative path resolves against the platform. Inline it or move it into ' +
        'the runtime block.',
    );
  }

  const leftover = body.match(PAGE_TAGS);
  if (leftover) {
    throw new Error(
      `${name}: ${leftover.join(', ')} survived into the body. The platform ` +
        'supplies the page skeleton; a second one nests inside the first.',
    );
  }

  const title = /<title>([\s\S]*?)<\/title>/i.exec(body);
  if (!title) {
    throw new Error(
      `${name}: no <title>. It names the artifact in the tab and the gallery, ` +
        'and nothing else supplies it.',
    );
  }
  const titleAt = Buffer.byteLength(body.slice(0, title.index), 'utf8');
  if (titleAt >= TITLE_SCAN_BYTES) {
    throw new Error(
      `${name}: <title> starts at byte ${titleAt}, past the ${TITLE_SCAN_BYTES} ` +
        'the platform reads. Move it to the top of the body.',
    );
  }

  return { body, title: title[1].trim(), notes: mermaidNotes(body) };
}

/**
 * Two ways a diagram publishes as a blank, both of which have happened here.
 *
 * @param {string} body
 * @returns {string[]}
 */
export function mermaidNotes(body) {
  const notes = [];
  let block;
  let index = 0;

  MERMAID_BLOCK.lastIndex = 0;
  while ((block = MERMAID_BLOCK.exec(body)) !== null) {
    index += 1;
    const source = block[1];

    if (/<br\s*\/?>/i.test(source)) {
      notes.push(
        `diagram ${index}: carries a real <br/>. Inside <pre> it is markup, and ` +
          'the renderer receives the tag rather than a line break — write it as ' +
          '&lt;br/&gt;, the way the other diagrams here do.',
      );
    }

    MERMAID_LABEL.lastIndex = 0;
    let label;
    while ((label = MERMAID_LABEL.exec(source)) !== null) {
      const rendered = decodeEntities(label[1]);
      if (rendered.includes(';')) {
        notes.push(
          `diagram ${index}: a ";" inside the label "${rendered}" ends the ` +
            'statement early and takes the whole diagram down, not just the node.',
        );
        break;
      }
    }
  }

  return notes;
}

const OUTPUT_DIRECTORY = path.join('tmp', 'published');

function main(argv) {
  const source = argv[0];
  if (!source) {
    console.error('Usage: node scripts/publish-doc.mjs <docs/page.html>');
    return 1;
  }

  const html = fs.readFileSync(source, 'utf8');
  const { body, title, notes } = toArtifactBody(html, source);

  fs.mkdirSync(OUTPUT_DIRECTORY, { recursive: true });
  const target = path.join(OUTPUT_DIRECTORY, path.basename(source));
  fs.writeFileSync(target, `${body}\n`, 'utf8');

  const kept = Buffer.byteLength(body, 'utf8');
  const whole = Buffer.byteLength(html, 'utf8');
  console.log(`${target}`);
  console.log(`  title: ${title}`);
  console.log(`  body:  ${kept} bytes of ${whole} (page skeleton and runtime removed)`);
  for (const note of notes) console.log(`  note:  ${note}`);
  console.log(
    '  Publish this file, not the source. Republishing an existing artifact ' +
      'needs its URL, or it becomes a second one.',
  );

  return 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    process.exitCode = main(process.argv.slice(2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
