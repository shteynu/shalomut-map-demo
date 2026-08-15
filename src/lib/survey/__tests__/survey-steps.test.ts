/**
 * The step model exists because an allocation grid is thirteen stored questions
 * answered on one screen. These tests are mostly about the seams that creates:
 * what the funnel is told, what "complete" means for an optional question, and
 * when the questionnaire may be sent.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  allocationTotal,
  buildSurveySteps,
  canSubmitSurvey,
  isStepComplete,
  questionIndexForStep,
  questionsInStep,
  submissionBlocker,
} from '../survey-steps';
import type {
  BackgroundSurveyQuestion,
  SurveyDefinitionQuestion,
} from '../../types/backend';

function analytic(id: string): SurveyDefinitionQuestion {
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

function choice(id: string, required = false): SurveyDefinitionQuestion {
  return {
    id,
    kind: 'background',
    text: `רקע ${id}`,
    required,
    enabled: true,
    answerMode: 'single-choice',
    options: [
      { value: 'a', label: 'א' },
      { value: 'b', label: 'ב' },
    ],
  };
}

function likert(
  id: string,
  sectionId: string | undefined,
  scaleId: 'likert-5-extent' | 'likert-7-frequency' = 'likert-5-extent',
  required = true,
): SurveyDefinitionQuestion {
  return {
    id,
    kind: 'analytic',
    text: `היגד ${id}`,
    required,
    enabled: true,
    sectionId,
    dimensionId: 'meaning',
    scaleId,
    polarity: 'positive',
  };
}

function allocationRow(
  id: string,
  groupId: string,
  required = false,
): BackgroundSurveyQuestion {
  return {
    id,
    kind: 'background',
    text: `פעילות ${id}`,
    required,
    enabled: true,
    answerMode: 'allocation-100',
    allocationGroupId: groupId,
  };
}

describe('building steps', () => {
  it('gives every ordinary question a step of its own', () => {
    const steps = buildSurveySteps([analytic('q1'), choice('b1')]);

    assert.equal(steps.length, 2);
    assert.deepEqual(
      steps.map((step) => step.kind),
      ['question', 'question'],
    );
  });

  it('collapses a grid into one step at the position of its first row', () => {
    const steps = buildSurveySteps([
      analytic('q1'),
      allocationRow('a1', 'load'),
      allocationRow('a2', 'load'),
      allocationRow('a3', 'load'),
      choice('b1'),
    ]);

    assert.deepEqual(
      steps.map((step) => step.kind),
      ['question', 'allocation', 'question'],
    );
    assert.equal(questionsInStep(steps[1]).length, 3);
  });

  it('gathers rows of one grid even when the questionnaire separated them', () => {
    // A manager reordering the builder's list has moved a row, not split a
    // constraint: thirteen entries that must total 100 cannot be answered in
    // two places.
    const steps = buildSurveySteps([
      allocationRow('a1', 'load'),
      choice('b1'),
      allocationRow('a2', 'load'),
    ]);

    assert.deepEqual(
      steps.map((step) => step.kind),
      ['allocation', 'question'],
    );
    assert.equal(questionsInStep(steps[0]).length, 2);
  });

  it('keeps two grids apart', () => {
    const steps = buildSurveySteps([
      allocationRow('a1', 'now'),
      allocationRow('b1', 'ideal'),
    ]);

    assert.equal(steps.length, 2);
  });
});

describe('blocks', () => {
  it('collapses a section answered on one scale into one step', () => {
    const steps = buildSurveySteps([
      likert('a1', 'משאבים בעבודה'),
      likert('a2', 'משאבים בעבודה'),
      likert('a3', 'משאבים בעבודה'),
    ]);

    assert.equal(steps.length, 1);
    assert.equal(questionsInStep(steps[0]).length, 3);
  });

  it('splits a section that mixes two scales, because a block states one set of anchors', () => {
    const steps = buildSurveySteps([
      likert('a1', 'שאלון שחיקה', 'likert-5-extent'),
      likert('a2', 'שאלון שחיקה', 'likert-7-frequency'),
    ]);

    assert.equal(steps.length, 2);
  });

  it('leaves a question with no section on its own screen', () => {
    const steps = buildSurveySteps([likert('a1', undefined), likert('a2', undefined)]);

    assert.deepEqual(
      steps.map((step) => step.kind),
      ['question', 'question'],
    );
  });

  it('never blocks the colour scale, however it is sectioned', () => {
    // The stones are the anchors — three faces with a sentence each — so there
    // is nothing to hoist above them, and every questionnaire persisted before
    // sections existed must keep rendering exactly as it did.
    const coloured = { ...analytic('q1'), sectionId: 'חלק א' };
    const steps = buildSurveySteps([coloured, { ...coloured, id: 'q2' }]);

    assert.deepEqual(
      steps.map((step) => step.kind),
      ['question', 'question'],
    );
  });

  it('holds the block until every required statement is answered', () => {
    // Per statement, not all-or-none: a block shares a screen and a scale, not
    // a constraint, so an optional row inside it stays optional.
    const [step] = buildSurveySteps([
      likert('a1', 'חלק א'),
      likert('a2', 'חלק א', 'likert-5-extent', false),
    ]);

    assert.equal(isStepComplete(step, {}), false);
    assert.equal(isStepComplete(step, { a1: '3' }), true);
  });
});

describe('what the funnel is told', () => {
  const questions = [
    analytic('q1'),
    allocationRow('a1', 'load'),
    allocationRow('a2', 'load'),
    choice('b1'),
  ];
  const steps = buildSurveySteps(questions);

  it('reports a question index, not a step index', () => {
    // Step 2 is the choice question, which is question 3. Reporting `2` would
    // rescale every `lastQuestionReached` already in the database.
    assert.equal(questionIndexForStep(steps, 2, questions), 3);
  });

  it('reports the first question of a grid', () => {
    assert.equal(questionIndexForStep(steps, 1, questions), 1);
  });

  it('reports the end for the review step', () => {
    assert.equal(questionIndexForStep(steps, steps.length, questions), 4);
  });
});

describe('when a step is complete', () => {
  it('holds a required question until it is answered', () => {
    const [step] = buildSurveySteps([analytic('q1')]);

    assert.equal(isStepComplete(step, {}), false);
    assert.equal(isStepComplete(step, { q1: 'green' }), true);
  });

  it('lets an optional question through the moment it is reached', () => {
    const [step] = buildSurveySteps([choice('b1')]);

    assert.equal(isStepComplete(step, {}), true);
  });

  it('refuses half a grid, because half a grid cannot total 100', () => {
    const [step] = buildSurveySteps([
      allocationRow('a1', 'load'),
      allocationRow('a2', 'load'),
    ]);

    assert.equal(isStepComplete(step, {}), true);
    assert.equal(isStepComplete(step, { a1: '60' }), false);
    assert.equal(isStepComplete(step, { a1: '60', a2: '40' }), true);
  });

  it('requires every row of a grid whose rows are required', () => {
    const [step] = buildSurveySteps([
      allocationRow('a1', 'load', true),
      allocationRow('a2', 'load', true),
    ]);

    assert.equal(isStepComplete(step, {}), false);
  });
});

describe('submitting', () => {
  it('does not wait for an optional question', () => {
    const steps = buildSurveySteps([analytic('q1'), choice('b1')]);

    assert.equal(canSubmitSurvey(steps, { q1: 'green' }), true);
  });

  it('waits for every required question', () => {
    const steps = buildSurveySteps([analytic('q1'), choice('b1', true)]);

    assert.equal(canSubmitSurvey(steps, { q1: 'green' }), false);
    assert.equal(canSubmitSurvey(steps, { q1: 'green', b1: 'a' }), true);
  });

  it('refuses a started grid that does not total 100', () => {
    // The submit route refuses this too. Letting the button through would
    // spend the respondent's goodwill on a refusal the screen could prevent.
    const steps = buildSurveySteps([
      allocationRow('a1', 'load'),
      allocationRow('a2', 'load'),
    ]);

    assert.equal(canSubmitSurvey(steps, { a1: '60', a2: '30' }), false);
    assert.equal(canSubmitSurvey(steps, { a1: '60', a2: '40' }), true);
  });

  it('lets an untouched grid through', () => {
    const steps = buildSurveySteps([
      allocationRow('a1', 'load'),
      allocationRow('a2', 'load'),
    ]);

    assert.equal(canSubmitSurvey(steps, {}), true);
  });
});

describe('why sending is blocked', () => {
  it('says nothing when the questionnaire is ready', () => {
    const steps = buildSurveySteps([analytic('q1')]);

    assert.equal(submissionBlocker(steps, { q1: 'green' }), undefined);
  });

  it('names the missing required answer', () => {
    const steps = buildSurveySteps([analytic('q1')]);

    assert.equal(submissionBlocker(steps, {}), 'required-question');
  });

  it('calls a grid at 97 a grid problem, not a skipped question', () => {
    // The review card used to report the step count here, which is full, beside
    // a heading saying answers were missing. Two true numbers, one wrong story.
    const steps = buildSurveySteps([
      analytic('q1'),
      allocationRow('a1', 'load'),
      allocationRow('a2', 'load'),
    ]);

    assert.equal(
      submissionBlocker(steps, { q1: 'green', a1: '60', a2: '37' }),
      'allocation-total',
    );
  });

  it('calls half a grid a grid problem too', () => {
    const steps = buildSurveySteps([
      allocationRow('a1', 'load'),
      allocationRow('a2', 'load'),
    ]);

    assert.equal(submissionBlocker(steps, { a1: '60' }), 'allocation-total');
  });
});

describe('the running total', () => {
  it('adds the rows and ignores what it cannot read', () => {
    const rows = [allocationRow('a1', 'load'), allocationRow('a2', 'load')];

    assert.equal(allocationTotal(rows, { a1: '60', a2: '40' }), 100);
    assert.equal(allocationTotal(rows, { a1: '60', a2: '' }), 60);
    assert.equal(allocationTotal(rows, {}), 0);
  });
});
