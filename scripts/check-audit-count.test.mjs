import assert from 'node:assert';
import test from 'node:test';
import {
  AUDIT_DOCUMENT,
  check,
  classify,
  deriveCounts,
  parseFindings,
} from './check-audit-count.mjs';

/**
 * A miniature of the real document: the four shapes a record is written in and
 * the three shapes that are not records. Running the script against the real
 * tree proves today's number; these prove the edges, where a gate stops
 * guarding without saying so.
 */
const summary = ({ total = 4, closed = 2, partial = 1, open = 1 } = {}) =>
  `## Счёт\n\nНа сегодня, из **${total}** записей: **${closed}** закрыта, ` +
  `**${partial}** закрыты в части, и **${open}** открыта целиком.\n\n`;

const BODY =
  '### Живой пересчёт агрегатов\n\n' +
  '*Критическая · приватность* — **ЗАКРЫТА** `648465c`\n' +
  'Ниже — формулировка на момент аудита.\n\n' +
  '### Слой воркера не масштабируется\n\n' +
  '**Средняя** · horizontal — **ЗАКРЫТА В ЧАСТИ ЛИМИТЕРА**\n' +
  '`c6635ea`; см. ADR-053\n\n' +
  '### Ещё по расширению (2 средних · 1 низких)\n\n' +
  '- Средняя — **Индекс не используется** — **ЗАКРЫТА** `4774f11`\n' +
  '  Тело записи.\n' +
  '- Низкая — **Дверь-пароль**\n' +
  '  Тело записи без пометки.\n\n' +
  '## Отклонённые находки\n\n' +
  '- Отклонено — **Дедупликация визитов**\n  Почему.\n';

const tree = (document) => ({ readFile: () => document });

test('every shape a record is written in is counted once', () => {
  const findings = parseFindings(BODY);

  assert.deepStrictEqual(
    findings.map((finding) => classify(finding.status)),
    ['closed', 'partial', 'closed', 'open'],
  );
  assert.deepStrictEqual(deriveCounts(findings), {
    total: 4,
    closed: 2,
    partial: 1,
    open: 1,
  });
});

test('a grouping heading and a rejected finding are not records', () => {
  const titles = parseFindings(BODY).map((finding) => finding.title);

  assert.ok(!titles.some((title) => title.includes('Ещё по расширению')));
  assert.ok(!titles.some((title) => title.includes('Отклонено')));
});

test('a section status that wraps onto the next line still reads as closed', () => {
  // The wrap is not cosmetic: `**ЗАКРЫТА**` at the end of one line and its
  // commit at the start of the next is how half the sections are written, and
  // reading only the first line would classify a partial closure as full.
  const [, worker] = parseFindings(BODY);

  assert.ok(worker.status.includes('ADR-053'));
  assert.strictEqual(classify(worker.status), 'partial');
});

test('the summary is checked against the marks, not trusted', () => {
  assert.deepStrictEqual(check(tree(summary() + BODY)), []);

  const errors = check(tree(summary({ open: 0, closed: 3 }) + BODY));
  assert.strictEqual(errors.length, 2);
  assert.ok(errors.every((error) => error.startsWith(AUDIT_DOCUMENT)));
  assert.ok(errors.some((error) => error.includes('closed = 3')));
  assert.ok(errors.some((error) => error.includes('open = 0')));
});

test('the old spelling of a partial closure is refused', () => {
  const document = summary({ closed: 3, partial: 0 }).concat(
    BODY.replace('**ЗАКРЫТА В ЧАСТИ ЛИМИТЕРА**', '**ЗАКРЫТА ДЛЯ ЛИМИТЕРА**'),
  );

  // The arithmetic on its own would pass — that is the point. A record marked
  // "ЗАКРЫТА ДЛЯ …" counts as fully closed, so the summary can be made to
  // agree with it while the remainder goes unnamed.
  const errors = check(tree(document));

  assert.strictEqual(errors.length, 1);
  assert.ok(errors[0].includes('ЗАКРЫТА В ЧАСТИ'));
});

test('the verb agreeing with the number does not fail the gate', () => {
  // Russian agreement: one finding is "закрыта", nine are "закрыты", and zero
  // takes the plural too. The document reaches all three as records close, and
  // a gate that only knew the singular would fail on the day the last open
  // finding closed — which is the day it matters most that it still runs.
  const plural =
    '## Счёт\n\nНа сегодня, из **4** записей: **2** закрыты, ' +
    '**1** закрыты в части, и **1** открыты целиком.\n\n';

  assert.deepStrictEqual(check(tree(plural + BODY)), []);
});

test('a document nothing is recognised in fails rather than passes empty', () => {
  const errors = check(tree('# Ничего похожего на находку\n'));

  assert.strictEqual(errors.length, 1);
  assert.ok(errors[0].includes('no findings'));
});
