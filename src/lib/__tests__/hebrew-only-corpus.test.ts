import assert from 'node:assert';
import test from 'node:test';

import hebrewTextCorpus from '../../../contracts/fixtures/hebrew_text_corpus.json';
import { isHebrewOnlyUserText, validateStoneMapResult } from '../ai-contract';
import { createValidV6Payload } from './fixtures/v6-payload';

/**
 * The Hebrew-only rule is a semantic rule no JSON Schema expresses, so the two
 * runtimes each implement it and can drift apart. They drifted: Python refused
 * every non-Hebrew script from 2026-07-30, Core still refused only Latin, and
 * Core is the side that decides what a manager reads. The corpus is shared so
 * the next divergence fails a test instead of reaching a dashboard.
 */
test('Core answers every shared Hebrew-only corpus case', () => {
  for (const testCase of hebrewTextCorpus.cases) {
    assert.strictEqual(
      isHebrewOnlyUserText(testCase.text),
      testCase.isHebrewOnly,
      `${testCase.id}: ${testCase.note}`,
    );
  }
});

test('the corpus covers scripts beyond the one the old rule named', () => {
  const refusedScriptCases = hebrewTextCorpus.cases.filter(
    (testCase) => !testCase.isHebrewOnly && /[֐-׿]/u.test(testCase.text),
  );

  assert.ok(
    refusedScriptCases.length >= 3,
    'a corpus without foreign scripts mixed into Hebrew would pass the rule it is meant to pin',
  );
});

test('the callback refuses a stone whose interpretation is Cyrillic', () => {
  const payload = createValidV6Payload('round-cyrillic');
  const dimensionId = Object.keys(payload.stones)[0];
  // One Hebrew letter stands in the sentence on purpose: that is exactly what
  // used to carry a foreign-script paragraph past the old rule, which asked
  // only whether any Hebrew was present and whether Latin was absent.
  payload.stones[dimensionId].summary = [
    'Команда сообщает об усталости ש.',
    'התשובות מלמדות שהחוויה אינה אחידה ושיש מקום לחיזוק עקבי בין הצוותים.',
    'כדאי לבחור צעד ממוקד אחד, ליישם אותו בעקביות ולבדוק בהמשך את השפעתו.',
  ];

  const validation = validateStoneMapResult(payload, payload.roundId);

  assert.strictEqual(
    validation.ok,
    false,
    'Cyrillic copy must not reach persistence through the callback',
  );
});

test('the callback refuses a metric narrative carrying an Arabic confusable', () => {
  const payload = createValidV6Payload('round-confusable');
  const dimensionId = Object.keys(payload.stones)[0];
  const metric = payload.stones[dimensionId].metrics[0];
  metric.insightText = metric.insightText.replace('ו', 'و');

  const validation = validateStoneMapResult(payload, payload.roundId);

  assert.strictEqual(
    validation.ok,
    false,
    'the generation pipeline repairs this confusable before validating, so an unrepaired payload is a defect',
  );
});
