import { EyeOff, Users } from "lucide-react";
import type {
  BackgroundBreakdown,
  BreakdownGroup,
  BreakdownQuestionChoice,
} from "@/lib/analytics/background-breakdown";
import { dimensionPresentations } from "@/lib/dashboard/dimension-presentation";
import type { WellbeingDimensionId } from "@/lib/shalomut-source";
import { statusLabelShort } from "@/components/ui";
import { BreakdownQuestionPicker } from "./breakdown-question-picker";

/**
 * Why a group is not on the table, in the manager's own terms.
 *
 * The module distinguishes a group that is too small from one blanked so that
 * the small one could not be subtracted back out. The manager is told both,
 * because they are different facts about their own school: the first is "this
 * group is tiny", the second is "this group is fine, and naming it would give
 * away the tiny one".
 */
const SUPPRESSION_NOTES = {
  "below-threshold": "קבוצה קטנה מדי מכדי להישאר אנונימית",
  complementary: "לא מוצג כדי שלא ניתן יהיה לחשב את הקבוצה הקטנה בחיסור",
} as const;

function GroupSize({ group }: { group: BreakdownGroup }) {
  if (!group.size.suppressed) {
    return (
      <span className="breakdown-group-size">
        <Users size={14} aria-hidden="true" />
        {group.size.count}
      </span>
    );
  }

  return (
    <span className="breakdown-group-size breakdown-group-size-hidden">
      <EyeOff size={14} aria-hidden="true" />
      {SUPPRESSION_NOTES[group.size.reason]}
    </span>
  );
}

/**
 * One dimension's score for one group, or the reason there is none.
 *
 * Never colour alone: the cell carries the number, the status word and a
 * status class. A reader who cannot tell the three surfaces apart still reads
 * "68 · צהוב".
 */
function ScoreCell({
  group,
  dimensionId,
}: {
  group: BreakdownGroup;
  dimensionId: WellbeingDimensionId;
}) {
  if (group.size.suppressed) {
    return (
      <td className="breakdown-cell breakdown-cell-hidden">
        <span aria-hidden="true">—</span>
        <span className="visually-hidden">אינו מוצג</span>
      </td>
    );
  }

  const score = group.dimensionScores?.[dimensionId];

  if (!score) {
    // The group exists and answered nothing in this dimension. Distinct from a
    // suppressed cell, and it has to look distinct: "we may not tell you" and
    // "nobody answered" are not the same sentence.
    return (
      <td className="breakdown-cell breakdown-cell-empty">
        <span aria-hidden="true">·</span>
        <span className="visually-hidden">אין תשובות</span>
      </td>
    );
  }

  return (
    <td className={`breakdown-cell breakdown-cell-${score.computedStatus}`}>
      <strong>{score.averageScore}</strong>
      <span className="breakdown-cell-status">
        {statusLabelShort[score.computedStatus]}
      </span>
    </td>
  );
}

/**
 * The breakdown of one round by one background question.
 *
 * A table rather than eight small maps: the question is comparative — is this
 * group's number different from that group's — and a comparison is what a table
 * of rows against columns is for. The map keeps its job of showing one round's
 * shape whole.
 */
export function BreakdownBoard({
  breakdown,
  choices,
  selectedQuestionId,
  roundId,
  isRoundLocked,
  privacyThreshold,
  totalResponses,
}: {
  breakdown: BackgroundBreakdown | null;
  choices: readonly BreakdownQuestionChoice[];
  selectedQuestionId: string | undefined;
  roundId: string;
  isRoundLocked: boolean;
  privacyThreshold: number;
  totalResponses: number;
}) {
  if (choices.length === 0) {
    return (
      <section className="breakdown-empty">
        <Users size={20} aria-hidden="true" />
        <p>
          בשאלון של הסבב הזה אין שאלת רקע עם אפשרויות בחירה, ולכן אין לפי מה
          לפלח. אפשר להוסיף שאלת רקע — למשל ותק או שכבת גיל — במסך בניית השאלון.
        </p>
      </section>
    );
  }

  return (
    <>
      <BreakdownQuestionPicker
        choices={choices}
        selectedQuestionId={selectedQuestionId}
        roundId={roundId}
      />

      {isRoundLocked ? (
        <section className="breakdown-locked">
          <EyeOff size={20} aria-hidden="true" />
          <p>
            תוצאות הסבב עדיין נעולות, ולכן גם הפילוח נעול. פילוח של תוצאה שאי
            אפשר להציג במלואה הוא דרך לקרוא אותה בחלקים. נדרשות לפחות{" "}
            {privacyThreshold} תשובות, ובינתיים יש {totalResponses}.
          </p>
        </section>
      ) : null}

      {!isRoundLocked && breakdown ? (
        <BreakdownTable breakdown={breakdown} />
      ) : null}
    </>
  );
}

function BreakdownTable({ breakdown }: { breakdown: BackgroundBreakdown }) {
  const hiddenGroups = breakdown.groups.filter((group) => group.size.suppressed);

  // A table can come out empty for two unlike reasons, and the same sentence
  // would be wrong about one of them. Either every category really is tiny, or
  // one of them holds almost the whole staff room — and publishing that one
  // would state the handful outside it by subtraction, which is what a
  // `complementary` blank records. Telling a manager that no group is large
  // enough, when a group of forty is sitting in front of them, reads as a bug.
  const hidesALargeGroup = breakdown.groups.some(
    (group) => group.size.suppressed && group.size.reason === "complementary",
  );

  if (breakdown.isFullySuppressed) {
    return (
      <section className="breakdown-locked">
        <EyeOff size={20} aria-hidden="true" />
        <p>
          {hidesALargeGroup
            ? "בשאלה הזאת יש קבוצה גדולה מספיק להצגה, אבל מי שנותר מחוצה לה קטן מכדי להישאר אנונימי — והצגת הגדולה הייתה מסגירה אותם בחיסור. לכן הטבלה כולה אינה מוצגת. פילוח לפי שאלה אחרת עשוי להציג יותר."
            : "אף קבוצה בשאלה הזאת אינה גדולה מספיק כדי להציג אותה בנפרד. אפשר לפלח לפי שאלה עם פחות קטגוריות, או להמתין לתשובות נוספות."}
        </p>
      </section>
    );
  }

  return (
    <section className="breakdown-table-panel" aria-label="פילוח מדדים לפי קבוצה">
      <div className="breakdown-table-scroll">
        <table className="breakdown-table">
          <caption className="visually-hidden">
            ציון ממוצע לכל מדד, לפי {breakdown.questionText}
          </caption>
          <thead>
            <tr>
              <th scope="col">מדד</th>
              {breakdown.groups.map((group) => (
                <th key={group.categoryId} scope="col">
                  <span className="breakdown-group-label">{group.label}</span>
                  <GroupSize group={group} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {dimensionPresentations.map((dimension) => (
              <tr key={dimension.id}>
                <th scope="row">{dimension.conceptLabel}</th>
                {breakdown.groups.map((group) => (
                  <ScoreCell
                    key={group.categoryId}
                    group={group}
                    dimensionId={dimension.id}
                  />
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="breakdown-total-note">
        סך התשובות בסבב: {breakdown.totalResponses}. סף הפרטיות:{" "}
        {breakdown.privacyThreshold}.
        {hiddenGroups.length > 0 ? (
          <>
            {" "}
            {hiddenGroups.length} קבוצות אינן מוצגות, ולכן סכום הקבוצות המוצגות
            קטן מסך התשובות — זה מכוון.
          </>
        ) : null}
      </p>
    </section>
  );
}
