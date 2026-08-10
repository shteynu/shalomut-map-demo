import assert from "node:assert";
import { test } from "node:test";
import { dividedDimensions } from "@/lib/dashboard/dimension-division";
import type { CanonicalQuestionAggregate } from "@/lib/types/canonical-analytics";
import type { WellbeingDimensionId } from "@/lib/shalomut-source";

/**
 * One question's worth of answers. The dimension totals are the sum of its
 * questions, which is how the real aggregates arrive.
 */
function question(
  questionId: string,
  dimensionId: WellbeingDimensionId,
  distribution: { green: number; yellow: number; red: number },
): CanonicalQuestionAggregate {
  const responseCount =
    distribution.green + distribution.yellow + distribution.red;

  return {
    questionId,
    dimensionId,
    questionText: questionId,
    averageScore:
      (distribution.green * 100 + distribution.yellow * 60) / responseCount,
    responseCount,
    scoreDistribution: distribution,
  };
}

function aggregates(
  ...questions: CanonicalQuestionAggregate[]
): Record<string, CanonicalQuestionAggregate> {
  return Object.fromEntries(
    questions.map((entry) => [entry.questionId, entry]),
  );
}

test("the two staff rooms the score cannot tell apart", () => {
  // The pair from the strategy document: thirty yellow answers, and eighteen
  // green plus twelve red. Both score 60.
  const agreed = dividedDimensions(
    aggregates(
      question("q1", "balance", { green: 0, yellow: 10, red: 0 }),
      question("q2", "balance", { green: 0, yellow: 10, red: 0 }),
      question("q3", "balance", { green: 0, yellow: 10, red: 0 }),
    ),
  );
  const split = dividedDimensions(
    aggregates(
      question("q1", "balance", { green: 6, yellow: 0, red: 4 }),
      question("q2", "balance", { green: 6, yellow: 0, red: 4 }),
      question("q3", "balance", { green: 6, yellow: 0, red: 4 }),
    ),
  );

  assert.deepStrictEqual(agreed, []);
  assert.deepStrictEqual(split, [
    { dimensionId: "balance", greenPercent: 60, redPercent: 40 },
  ]);
});

test("a dimension everyone agrees about is not divided, at either end", () => {
  const allGreen = dividedDimensions(
    aggregates(question("q1", "balance", { green: 12, yellow: 0, red: 0 })),
  );
  const allRed = dividedDimensions(
    aggregates(question("q1", "balance", { green: 0, yellow: 0, red: 12 })),
  );

  assert.deepStrictEqual(allGreen, []);
  assert.deepStrictEqual(allRed, []);
});

test("a minority smaller than a fifth is not called a divided room", () => {
  // Two red answers of thirty — under a fifth, and inside what one or two
  // people can produce. A tenth is one respondent's whole contribution.
  const barelyRed = dividedDimensions(
    aggregates(
      question("q1", "balance", { green: 10, yellow: 0, red: 0 }),
      question("q2", "balance", { green: 10, yellow: 0, red: 0 }),
      question("q3", "balance", { green: 8, yellow: 0, red: 2 }),
    ),
  );

  assert.deepStrictEqual(barelyRed, []);
});

test("exactly a fifth at each end is divided", () => {
  const atThreshold = dividedDimensions(
    aggregates(question("q1", "balance", { green: 2, yellow: 6, red: 2 })),
  );

  assert.deepStrictEqual(atThreshold, [
    { dimensionId: "balance", greenPercent: 20, redPercent: 20 },
  ]);
});

test("each dimension is judged on its own answers, in map order", () => {
  // `meaning` is the last dimension of the instrument and `balance` the fourth,
  // so listing them in the order the aggregates happened to arrive would put
  // them the other way round on screen.
  const divisions = dividedDimensions(
    aggregates(
      question("q1", "meaning", { green: 4, yellow: 2, red: 4 }),
      question("q2", "social-resource", { green: 0, yellow: 10, red: 0 }),
      question("q3", "balance", { green: 5, yellow: 0, red: 5 }),
    ),
  );

  assert.deepStrictEqual(
    divisions.map((division) => division.dimensionId),
    ["balance", "meaning"],
  );
});

test("a locked round, whose aggregates are empty, divides nothing", () => {
  assert.deepStrictEqual(dividedDimensions({}), []);
});
