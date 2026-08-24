import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * The audit's own count, re-derived rather than trusted.
 *
 * `docs/critical-audit-2026-08-21.md` is a dated read-only document that is
 * nevertheless marked up as its findings are closed, and that combination is
 * what made it drift. It carried a running feed of "Открытых записей N" that
 * stopped being updated on 2026-08-23 while the marks in the records kept
 * moving — nineteen records apart by the evening — so two numbers in one file
 * disagreed and neither said which was right.
 *
 * This is the same shape as `check-doc-numbers.mjs`: the marks are the source,
 * the summary is the copy, and a disagreement is a failed check rather than a
 * discovery someone makes months later.
 *
 * What it cannot do: judge whether a record marked closed is actually closed.
 * That is a code read, and three records spent a day marked open while their
 * fix was already on `main`. It checks arithmetic and vocabulary, which is all
 * arithmetic and vocabulary are worth.
 */

export const AUDIT_DOCUMENT = 'docs/critical-audit-2026-08-21.md';

const SEVERITIES = ['Критическая', 'Высокая', 'Средняя', 'Низкая'];

/** `- Средняя — **Title** — **ЗАКРЫТА** …`, one record on one line. */
const BULLET = new RegExp(`^- (?:${SEVERITIES.join('|')}) — `);

/**
 * A record written as a section: `### Title`, a blank line, then a line
 * beginning with the emphasised severity. That line is what tells a heading
 * which owns a finding from a heading which only groups the bullets under it —
 * a group says `(4 средних · 5 низких)` and is followed by its bullets.
 *
 * One or two asterisks, because the critical finding is written in italics and
 * every other section in bold. Recognising both is deliberate: the document is
 * a restored artifact and its styling is evidence, so the check reads what is
 * there rather than asking for the file to be restyled. A third spelling would
 * not be missed quietly either — an unrecognised record makes the total
 * disagree with the summary, which is the failure below.
 */
const SEVERITY_LINE = new RegExp(
  `^\\*{1,2}(?:${SEVERITIES.join('|')})(?:\\*|\\s)`,
);

/**
 * The four numbers the summary states. Written as digits inside bold, because
 * a summary that spells "одна" reads better and cannot be checked, and an
 * unchecked number here is the whole reason this file exists.
 *
 * The verb agrees with the number in Russian, so each pattern accepts both
 * endings: "**1** открыта целиком" and "**0** открыты целиком" are the same
 * claim, and a gate that only knew the singular would fail the day a count
 * stopped being one. `закрыт[аы]` refuses to swallow "закрыты в части", which
 * is a different number in the same sentence.
 */
export const SUMMARY_CLAIMS = {
  total: /из \*\*(\d+)\*\* записей/u,
  closed: /\*\*(\d+)\*\* закрыт[аы](?! в части)/u,
  partial: /\*\*(\d+)\*\* закрыт[аы] в части/u,
  open: /\*\*(\d+)\*\* открыт[аы] целиком/u,
};

/**
 * Every finding in the document, each with the line its status is written on.
 *
 * A bullet carries its status on its own line. A section carries it on the
 * severity line under the heading. Nothing else is a record: the rejected
 * findings start with `- Отклонено —`, and the change feed above is prose.
 */
export function parseFindings(text) {
  const lines = text.split('\n');
  const findings = [];

  lines.forEach((line, index) => {
    if (BULLET.test(line)) {
      findings.push({ line: index + 1, title: line, status: line });
      return;
    }

    if (!line.startsWith('### ')) return;

    const offset = lines
      .slice(index + 1, index + 4)
      .findIndex((candidate) => candidate.trim());
    if (offset < 0) return;

    const severityAt = index + 1 + offset;
    if (!SEVERITY_LINE.test(lines[severityAt])) return;

    // A section's status may wrap onto the following line, which is how
    // `**ЗАКРЫТА**` and the commit it names come to be split.
    const status = `${lines[severityAt]} ${lines[severityAt + 1] ?? ''}`;
    findings.push({ line: index + 1, title: line, status });
  });

  return findings;
}

export function classify(status) {
  if (!status.includes('ЗАКРЫТА')) return 'open';
  return status.includes('В ЧАСТИ') ? 'partial' : 'closed';
}

export function deriveCounts(findings) {
  const counts = { total: findings.length, closed: 0, partial: 0, open: 0 };
  for (const finding of findings) counts[classify(finding.status)] += 1;
  return counts;
}

export function check({ readFile }) {
  const text = readFile(AUDIT_DOCUMENT);
  const findings = parseFindings(text);
  const errors = [];

  if (findings.length === 0) {
    return [
      `${AUDIT_DOCUMENT}: no findings were recognised at all. Either the ` +
        'document was restructured or this check is reading the wrong file; ' +
        'both are worth a human look rather than a passing gate.',
    ];
  }

  /*
   * One vocabulary for "closed in part", because the count is derived from the
   * status line and a second spelling is a record counted wrong. The document
   * used three before 2026-08-23: `ЗАКРЫТА В ЧАСТИ …`, `ЗАКРЫТА ДЛЯ ПУЛА pg`
   * and a paragraph in the body that only a reader would notice.
   */
  for (const finding of findings) {
    if (/ЗАКРЫТА\s+ДЛЯ/u.test(finding.status)) {
      errors.push(
        `${AUDIT_DOCUMENT}:${finding.line}: "ЗАКРЫТА ДЛЯ …" is the old ` +
          'spelling of a partial closure and counts as a full one. Write ' +
          '"ЗАКРЫТА В ЧАСТИ …" and name the remainder in the record.',
      );
    }
  }

  const derived = deriveCounts(findings);

  for (const [name, pattern] of Object.entries(SUMMARY_CLAIMS)) {
    const match = text.match(pattern);
    if (!match) {
      errors.push(
        `${AUDIT_DOCUMENT}: the "Счёт" section no longer states ${name}. ` +
          `Expected a number matching ${pattern}.`,
      );
      continue;
    }

    const stated = Number(match[1]);
    if (stated !== derived[name]) {
      errors.push(
        `${AUDIT_DOCUMENT}: the "Счёт" section says ${name} = ${stated}, ` +
          `but the status lines give ${derived[name]}. Update the section in ` +
          'the task that changed a mark.',
      );
    }
  }

  return errors;
}

function main() {
  const errors = check({ readFile: (file) => fs.readFileSync(file, 'utf-8') });

  if (errors.length > 0) {
    console.error('Audit count check failed:');
    errors.forEach((error) => console.error(`  ${error}`));
    process.exit(1);
  }

  const counts = deriveCounts(
    parseFindings(fs.readFileSync(AUDIT_DOCUMENT, 'utf-8')),
  );
  console.log(
    `Audit count check passed: ${counts.total} findings — ${counts.closed} ` +
      `closed, ${counts.partial} closed in part, ${counts.open} open.`,
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
