import {
  deltaDirection,
  describeDelta,
  formatDelta,
  isDeltaReadable,
  type RoundComparison,
} from "@/lib/dashboard/round-comparison";

/**
 * What changed since the school's previous round, with everything the reader
 * needs in order to know how much of the change to believe.
 *
 * The three paragraphs are one statement, which is why they live in one
 * component: the delta, the sample it rests on, and — when the school rewrote
 * its questionnaire — the fact that part of the movement may belong to the
 * wording. Separating any of them would leave a number on screen that reads
 * more confidently than the data behind it.
 */
export function DashboardRoundComparison({
  comparison,
}: {
  comparison: RoundComparison;
}) {
  const { overallDelta, minimumReadableDelta } = comparison;
  const readable = isDeltaReadable(overallDelta, minimumReadableDelta);

  return (
    <div className="map-sidebar-comparison">
      <p>
        <span
          className={`round-delta round-delta-${deltaDirection(
            overallDelta,
            minimumReadableDelta,
          )}`}
          aria-hidden="true"
        >
          {formatDelta(overallDelta, minimumReadableDelta)}
        </span>{" "}
        {describeDelta(overallDelta, minimumReadableDelta)} בהשוואה ל
        {comparison.previousRoundTitle}.
      </p>
      {/* The two counts are the reason the sentence above is worded the way it
          is, so they are never separated from it. */}
      <p className="quiet-note">
        {comparison.currentResponseCount} משיבים בסבב הזה,{" "}
        {comparison.previousResponseCount} בקודם.{" "}
        {readable
          ? null
          : `בגודל מדגם כזה משיב אחד יכול להזיז את הציון עד ${minimumReadableDelta} נקודות, ולכן שינוי קטן מזה אינו נקרא כשינוי.`}
      </p>
      {/* The questionnaire is part of what produced the number, so a change in
          it belongs beside the delta rather than in a settings screen the
          principal will never open. */}
      {comparison.questionnaireChanged ? (
        <p className="quiet-note">
          השאלון השתנה בין הסבבים. ההשוואה היא ברמת הממדים, שנשארים זהים, אבל חלק
          מהשינוי יכול לנבוע מניסוח אחר של השאלות ולא משינוי בבית הספר.
        </p>
      ) : null}
    </div>
  );
}
