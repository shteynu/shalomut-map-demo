import assert from 'node:assert';
import test from 'node:test';
import { describePlannedEnd } from '../planned-end';

const NOW = new Date('2026-08-11T09:00:00.000Z');

test('the card never calls the date a closing', () => {
  for (const status of ['draft', 'active', 'closed', 'archived'] as const) {
    const described = describePlannedEnd(new Date('2026-09-01'), status, NOW);
    assert.strictEqual(described.label, 'סיום מתוכנן');
    assert.doesNotMatch(described.helper, /נסגר בתאריך|ייסגר אוטומטית/u);
  }
});

test('a future date says the round will not close by itself', () => {
  const described = describePlannedEnd(new Date('2026-09-01'), 'active', NOW);

  assert.strictEqual(described.isOverdue, false);
  assert.match(described.helper, /אינו נסגר מעצמו/u);
});

test('a passed date on a collecting round says so out loud', () => {
  const described = describePlannedEnd(new Date('2026-08-04'), 'active', NOW);

  assert.strictEqual(described.isOverdue, true);
  assert.match(described.helper, /התאריך עבר והסבב עדיין אוסף תשובות/u);
});

test('today is not overdue, in the school day rather than the server one', () => {
  // 09:00 UTC on the 11th is midday in Jerusalem, and a round ending on the
  // 11th is not late until the 12th.
  const described = describePlannedEnd(new Date('2026-08-11T00:00:00.000Z'), 'active', NOW);

  assert.strictEqual(described.isOverdue, false);
});

test('a round that stopped collecting is not late for anything', () => {
  for (const status of ['closed', 'archived'] as const) {
    const described = describePlannedEnd(new Date('2026-08-04'), status, NOW);
    assert.strictEqual(described.isOverdue, false);
    assert.match(described.helper, /תאריך היעד שנקבע/u);
  }
});

test('no date says where a date would be set and what closes the round', () => {
  const described = describePlannedEnd(null, 'active', NOW);

  assert.strictEqual(described.isOverdue, false);
  assert.match(described.helper, /נסגר ידנית/u);
});
