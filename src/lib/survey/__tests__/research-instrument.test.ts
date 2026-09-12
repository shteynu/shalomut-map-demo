/**
 * The research instrument as data. These tests pin the shape the analysis of
 * 2026-09-12 proposed and the owner accepted as the working mapping, so that a
 * later edit to one row cannot silently change the coverage a stone gets or
 * let a background statement reach an aggregate.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  ALLOCATION_COMPONENTS,
  LOAD_ALLOCATION_GROUP_ID,
  RESEARCH_INSTRUMENT_ID,
  RESEARCH_INSTRUMENT_SECTIONS,
  TIME_ALLOCATION_GROUP_ID,
  createResearchInstrumentDefinition,
  researchInstrumentQuestions,
} from "../../research-instrument";
import {
  isActivatableSurveyDefinition,
  parseSurveyDefinition,
} from "../../survey-definition";
import { createSurveyDefinitionHash } from "../../survey-definition-hash";
import {
  isAnalyticQuestion,
  isBackgroundQuestion,
  type WellbeingDimensionId,
} from "../../types/backend";
import { buildSurveySteps } from "../survey-steps";

const questions = researchInstrumentQuestions();
const analytic = questions.filter(isAnalyticQuestion);
const background = questions.filter(isBackgroundQuestion);

describe("the research instrument as data", () => {
  it("holds the 126 items of the source document as 150 stored questions", () => {
    // The source counts each allocation grid as one item; the store keeps one
    // question per row, so its thirteen components are thirteen questions.
    assert.equal(questions.length, 150);
    assert.equal(new Set(questions.map((question) => question.id)).size, 150);
    assert.ok(questions.every((question) => question.enabled));
  });

  it("is sixteen background items, two grids of thirteen and 108 statements", () => {
    const grids = background.filter((q) => q.answerMode === "allocation-100");
    const statements = questions.filter((q) => q.sectionId !== undefined);
    const demographics = background.filter(
      (q) => q.answerMode !== "allocation-100" && q.sectionId === undefined,
    );

    assert.equal(demographics.length, 16);
    assert.equal(grids.length, 26);
    assert.equal(statements.length, 108);
    assert.equal(ALLOCATION_COMPONENTS.length, 13);
    assert.equal(
      grids.filter((q) => q.allocationGroupId === TIME_ALLOCATION_GROUP_ID).length,
      13,
    );
    assert.equal(
      grids.filter((q) => q.allocationGroupId === LOAD_ALLOCATION_GROUP_ID).length,
      13,
    );
    assert.equal(demographics.filter((q) => q.answerMode === "number").length, 1);
  });

  it("scores 78 statements and collects 30 without scoring them", () => {
    const unscored = background.filter((q) => q.sectionId !== undefined);

    assert.equal(analytic.length, 78);
    assert.equal(unscored.length, 30);
    // Collected on the block's own anchors, so they sit in the block on screen.
    assert.ok(
      unscored.every(
        (q) => q.answerMode === "single-choice" && (q.options?.length ?? 0) >= 5,
      ),
    );
  });

  it("gives every stone the coverage the analysis table gives it", () => {
    const perDimension = new Map<WellbeingDimensionId, { pos: number; neg: number }>();
    for (const question of analytic) {
      const entry = perDimension.get(question.dimensionId) ?? { pos: 0, neg: 0 };
      if (question.polarity === "positive") entry.pos += 1;
      else entry.neg += 1;
      perDimension.set(question.dimensionId, entry);
    }

    // analysis §2, «Покрытие»
    assert.deepEqual(Object.fromEntries(perDimension), {
      "self-expression": { pos: 3, neg: 0 },
      "professional-competence": { pos: 4, neg: 1 },
      "social-resource": { pos: 4, neg: 3 },
      balance: { pos: 4, neg: 32 },
      "management-support": { pos: 3, neg: 2 },
      certainty: { pos: 2, neg: 7 },
      "organizational-climate": { pos: 4, neg: 2 },
      meaning: { pos: 6, neg: 1 },
    });
  });

  it("answers the burnout block on the seven-point scale and everything else on 1–5", () => {
    const burnout = analytic.filter((q) => q.id.startsWith("burnout-"));

    assert.equal(burnout.length, 14);
    assert.ok(burnout.every((q) => q.scaleId === "likert-7-frequency"));
    assert.ok(burnout.every((q) => q.polarity === "negative"));
    assert.ok(
      analytic
        .filter((q) => !q.id.startsWith("burnout-"))
        .every((q) => q.scaleId === "likert-5-extent"),
    );
  });

  it("makes every demand reverse-scored and every resource direct", () => {
    assert.ok(
      analytic
        .filter((q) => q.id.startsWith("demands-"))
        .every((q) => q.polarity === "negative"),
    );
    assert.ok(
      analytic
        .filter((q) => q.id.startsWith("resources-"))
        .every((q) => q.polarity === "positive"),
    );
  });

  it("carries none of the source's defects", () => {
    const texts = questions.map((q) => q.text);
    // Defect 1: the duplicated staffing item appears once.
    assert.equal(
      texts.filter((t) => t === "כוח אדם לא מספיק ביחס לדרישות העבודה").length,
      1,
    );
    // Defect 2: the unnumbered employment-uncertainty item is kept.
    assert.ok(texts.includes("אי ודאות לגבי המשך העסקה"));
    // Defect 3: one `בדיקת מבחנים` per grid.
    assert.equal(
      background.filter(
        (q) => q.answerMode === "allocation-100" && q.text === "בדיקת מבחנים",
      ).length,
      2,
    );
    // Defect 10: the age bands no longer overlap at sixty.
    const age = background.find((q) => q.id === "bg-age");
    assert.ok(age?.options?.some((o) => o.label === "61 ומעלה"));
    assert.ok(!age?.options?.some((o) => o.label === "60 ומעלה"));
  });
});

describe("the research instrument as a questionnaire", () => {
  const definition = createResearchInstrumentDefinition("סבב מחקרי", 10);

  it("parses under the strict write limits and can be activated", () => {
    const parsed = parseSurveyDefinition(definition, { enforceWriteLimits: true });

    assert.ok(parsed.ok, parsed.ok ? "" : parsed.error);
    assert.ok(isActivatableSurveyDefinition(parsed.value));
    assert.equal(parsed.value.instrumentId, RESEARCH_INSTRUMENT_ID);
    assert.equal(parsed.value.questions.length, 150);
  });

  it("walks as thirteen blocks, two grids and the demographic screens", () => {
    const steps = buildSurveySteps(definition.questions);
    const kinds = steps.map((step) => step.kind);

    assert.equal(kinds.filter((kind) => kind === "block").length, 13);
    assert.equal(kinds.filter((kind) => kind === "allocation").length, 2);
    assert.equal(kinds.filter((kind) => kind === "question").length, 16);
    assert.deepEqual(
      steps
        .filter((step) => step.kind === "block")
        .map((step) => (step.kind === "block" ? step.sectionId : "")),
      RESEARCH_INSTRUMENT_SECTIONS,
    );
    // An unscored statement is a row of its block, not a screen of its own.
    const demandsBlock = steps.find(
      (step) => step.kind === "block" && step.sectionId === RESEARCH_INSTRUMENT_SECTIONS[0],
    );
    assert.equal(demandsBlock?.kind === "block" ? demandsBlock.questions.length : 0, 22);
  });

  it("estimates the sitting inside the owner's twenty to thirty minutes", () => {
    assert.ok(
      definition.estimatedMinutes >= 20 && definition.estimatedMinutes <= 30,
      `estimated ${definition.estimatedMinutes}`,
    );
  });

  it("keeps the thirty unscored statements out of the AI-visible identity", () => {
    const withoutUnscored = definition.questions.filter(
      (q) => !(isBackgroundQuestion(q) && q.sectionId !== undefined),
    );

    assert.equal(
      createSurveyDefinitionHash(definition.questions),
      createSurveyDefinitionHash(withoutUnscored),
    );
  });
});
