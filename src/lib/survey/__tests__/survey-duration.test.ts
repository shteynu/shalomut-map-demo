/**
 * The estimate is the one promise this product makes about a respondent's time,
 * and it is the last thing they read before deciding whether to start. These
 * tests pin the two things that must not drift: the questionnaire that is
 * actually running keeps the number it has been quoting, and the instrument
 * that is coming lands inside the range the owner read the source document as.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { estimateMinutesForQuestionnaire } from '../survey-duration';
import type {
  BackgroundSurveyQuestion,
  SurveyDefinitionQuestion,
} from '../../types/backend';

function colour(id: string): SurveyDefinitionQuestion {
  return {
    id,
    kind: 'analytic',
    text: `שאלה ${id}`,
    required: true,
    enabled: true,
    dimensionId: 'self-expression',
    scaleId: 'wellbeing-colour',
    polarity: 'positive',
  };
}

function likert(
  id: string,
  sectionId: string,
  scaleId: 'likert-5-extent' | 'likert-7-frequency' = 'likert-5-extent',
): SurveyDefinitionQuestion {
  return {
    id,
    kind: 'analytic',
    text: `היגד ${id}`,
    required: true,
    enabled: true,
    sectionId,
    dimensionId: 'meaning',
    scaleId,
    polarity: 'positive',
  };
}

function choice(id: string): SurveyDefinitionQuestion {
  return {
    id,
    kind: 'background',
    text: `רקע ${id}`,
    required: false,
    enabled: true,
    answerMode: 'single-choice',
    options: [{ value: 'a', label: 'א' }],
  };
}

function allocationRow(id: string, groupId: string): BackgroundSurveyQuestion {
  return {
    id,
    kind: 'background',
    text: `פעילות ${id}`,
    required: false,
    enabled: true,
    answerMode: 'allocation-100',
    allocationGroupId: groupId,
  };
}

function many<T>(count: number, make: (index: number) => T): T[] {
  return Array.from({ length: count }, (_, index) => make(index));
}

describe('the completion estimate', () => {
  it('still says four minutes for the twenty-four that are running', () => {
    // The number on the live consent screen. If this changes, every manager who
    // sent a link was told something the questionnaire no longer promises.
    assert.equal(
      estimateMinutesForQuestionnaire(many(24, (index) => colour(`q${index}`))),
      4,
    );
  });

  it('never estimates less than a minute', () => {
    // A round under construction has no questions yet, and «0 דקות» reads as a
    // broken screen rather than as a short questionnaire.
    assert.equal(estimateMinutesForQuestionnaire([]), 1);
    assert.equal(estimateMinutesForQuestionnaire([colour('q1')]), 1);
  });

  it('charges a block once for its anchors and then per row', () => {
    // Twenty statements one per screen cost more than twenty in a block, which
    // is the whole reason the block layout exists.
    const loose = many(20, (index) => colour(`q${index}`));
    const blocked = many(20, (index) => likert(`b${index}`, 'משאבים בעבודה'));

    assert.ok(
      estimateMinutesForQuestionnaire(blocked) <
        estimateMinutesForQuestionnaire(loose),
    );
  });

  it('charges two blocks two preambles', () => {
    const one = many(10, (index) => likert(`a${index}`, 'חלק א'));
    const two = [
      ...many(5, (index) => likert(`a${index}`, 'חלק א')),
      ...many(5, (index) => likert(`b${index}`, 'חלק ב')),
    ];

    assert.ok(
      estimateMinutesForQuestionnaire(two) >=
        estimateMinutesForQuestionnaire(one),
    );
  });

  it('lands inside the range the owner read the instrument as', () => {
    // 126 items in 20–30 minutes, per §4.6 of the instrument plan. The formula
    // this replaced said 21 by counting items and calling each one a tap.
    const instrument: SurveyDefinitionQuestion[] = [
      ...many(15, (index) => choice(`bg${index}`)),
      {
        id: 'hours',
        kind: 'background',
        text: 'מספר שעות עבודה יומי ממוצע',
        required: false,
        enabled: true,
        answerMode: 'number',
      },
      ...many(13, (index) => allocationRow(`now${index}`, 'now')),
      ...many(13, (index) => allocationRow(`ideal${index}`, 'ideal')),
      ...many(22, (index) => likert(`demand${index}`, 'דרישות וגורמי לחץ בעבודה')),
      ...many(30, (index) => likert(`resource${index}`, 'משאבים בעבודה')),
      ...many(14, (index) =>
        likert(`burnout${index}`, 'שאלון שחיקה', 'likert-7-frequency'),
      ),
      ...many(22, (index) => likert(`outcome${index}`, 'תוצאות תעסוקתיות נחוות')),
      ...many(20, (index) => likert(`short${index}`, `חלק קצר ${index % 9}`)),
    ];

    const minutes = estimateMinutesForQuestionnaire(instrument);

    assert.ok(minutes >= 20 && minutes <= 30, `estimated ${minutes} minutes`);
  });
});
