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
 *
 * Three unlike blanks, and they must not look alike. "The questionnaire never
 * asked about this" is a fact about the round; "this group is not shown" is a
 * fact about the group; "this cell is not shown" is a fact about how few people
 * inside a shown group answered these questions. A manager who reads the same
 * dash for all three learns nothing from any of them.
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
    // The round's questionnaire asks nothing that feeds this dimension, so
    // there is nothing here for anyone — not for this group and not for the
    // round as a whole. A dimension nobody was asked about is empty, not
    // hidden.
    return (
      <td className="breakdown-cell breakdown-cell-empty">
        <span aria-hidden="true">·</span>
        <span className="visually-hidden">השאלון אינו שואל על המדד הזה</span>
      </td>
    );
  }

  if (score.suppressed) {
    // The group is large enough to name, and still too few of its people
    // answered this dimension's questions for an average to be anyone's but
    // theirs. Same two rules as a group size, one cell down.
    return (
      <td className="breakdown-cell breakdown-cell-hidden">
        <span aria-hidden="true">—</span>
        <span className="visually-hidden">
          {SUPPRESSION_NOTES[score.reason]}
        </span>
      </td>
    );
  }

  return (
    <td className={`breakdown-cell breakdown-cell-${score.computedStatus}`}>
      <strong>{score.averageScore}</strong>
      <span className="breakdown-cell-status">
        {statusLabelShort[score.computedStatus]}
      </span>
      {/*
        How many people the average stands on, in the cell rather than in a
        tooltip. The column header's group size is not this number: background
        questions and analytic questions are answered separately, so a group of
        thirty can bring twelve people to one dimension and thirty to the next.
        A manager comparing two columns is comparing these counts too.
      */}
      <span className="breakdown-cell-respondents">
        {score.respondentCount} משיבים
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
  isCollecting,
  privacyThreshold,
  totalResponses,
}: {
  breakdown: BackgroundBreakdown | null;
  choices: readonly BreakdownQuestionChoice[];
  selectedQuestionId: string | undefined;
  roundId: string;
  isRoundLocked: boolean;
  /** Whether the round can still receive an answer, so this screen says the same true thing the map does. */
  isCollecting: boolean;
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
          {/*
            The reason has to match the map's. A breakdown that explained the
            threshold while the map explained the round still being open would
            be one product giving two accounts of the same lock — and the
            threshold sentence is plainly false on a round that passed it.
          */}
          {isCollecting ? (
            <p>
              תוצאות הסבב ייפתחו כשהוא ייסגר, ולכן גם הפילוח ייפתח אז. פילוח
              שמתעדכן בזמן שתשובות ממשיכות להגיע היה מאפשר לקרוא בחיסור את
              תשובותיו של משיב יחיד. עד כה התקבלו {totalResponses} תשובות.
            </p>
          ) : (
            <p>
              תוצאות הסבב נעולות, ולכן גם הפילוח נעול. פילוח של תוצאה שאי אפשר
              להציג במלואה הוא דרך לקרוא אותה בחלקים. נדרשות לפחות{" "}
              {privacyThreshold} תשובות, ובינתיים יש {totalResponses}.
            </p>
          )}
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

  // Blanks inside a published column need their own sentence. Without one they
  // read as a rendering fault — the column has a size, the row has a name, and
  // the cell where they meet is a dash.
  const hidesACell = breakdown.groups.some((group) =>
    Object.values(group.dimensionScores ?? {}).some((score) => score.suppressed),
  );

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
        {hidesACell ? (
          <>
            {" "}
            תא ריק בתוך קבוצה מוצגת פירושו שפחות מ־{breakdown.privacyThreshold}{" "}
            מאנשיה ענו על שאלות המדד הזה, ולכן הממוצע שלו אינו מוצג.
          </>
        ) : null}
      </p>
    </section>
  );
}
