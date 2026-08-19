import { Info } from "lucide-react";
import type { DashboardInsightsDto } from "@/lib/dashboard/dashboard-insights";
import {
  dimensionPresentations,
  getDimensionPresentation,
} from "@/lib/dashboard/dimension-presentation";
import type { WellbeingDimensionId } from "@/lib/shalomut-source";

/**
 * `conceptLabel` is what the stone on the map is captioned with. Naming a
 * dimension here by any of its other Hebrew names would send a manager looking
 * for a stone that is not there.
 *
 * Hebrew counts one and many differently, so the subject of every sentence
 * below is built here once rather than spliced from a count and a noun.
 */
function subject(dimensionIds: WellbeingDimensionId[]): string {
  // Every dimension at once is what a silent provider looks like on contract
  // 6.0, and it is the one case where the list is worse than the count: eight
  // names in one sentence is a paragraph a manager skims past.
  if (dimensionIds.length === dimensionPresentations.length) {
    return "כל הממדים";
  }

  const names = dimensionIds.map(
    (dimensionId) =>
      getDimensionPresentation(dimensionId)?.conceptLabel ?? dimensionId,
  );
  return names.length === 1
    ? `ממד ${names[0]}`
    : `${names.length} ממדים — ${names.join(", ")} —`;
}

/**
 * The map says which dimensions are missing their words, and why.
 *
 * A partial map already told the manager the truth, but only on the dimension
 * screen — exactly the screen someone who trusts the map never opens. Eight
 * stones with eight scores read as a complete analysis.
 *
 * The cause is here because it changes what to do next. A service that did not
 * answer is worth another run in a minute; copy this service wrote and then
 * refused is worth a run for a different wording, and worth suspecting if it
 * keeps happening. A round analysed before the service recorded a cause says
 * only that the words are missing, which is all it honestly knows.
 *
 * Deliberately not an error. Nothing here failed for the manager: the scores,
 * the questions and the recommendations of those dimensions are all real, and
 * the closing sentence says so.
 *
 * It says a second thing, about dimensions that are not missing at all.
 * Contract 6.0 does not raise per dimension — a provider that answers nothing
 * produces a full map whose paragraphs the service composed from the round's
 * own numbers — so on the deployed contract the missing-words case is the rare
 * one and this is the common one. Until now it was disclosed only on the
 * dimension and metric screens, which is the same "a manager who trusts the
 * map never opens it" problem this component was built to solve, one shape
 * over.
 *
 * One box rather than two, because the manager's question is the same both
 * times — how much of what I am reading did a model write — and two boxes
 * side by side answering it twice would read as two problems.
 */
export function DashboardPartialMapNotice({
  gaps,
  deterministicSummaries,
}: {
  gaps: DashboardInsightsDto["gapsByReason"];
  deterministicSummaries: DashboardInsightsDto["dimensionsWithDeterministicSummary"];
}) {
  const missing =
    gaps.provider_unavailable.length +
    gaps.validation_rejected.length +
    gaps.unstated.length;
  if (missing === 0 && deterministicSummaries.length === 0) return null;

  const sentences = [
    gaps.provider_unavailable.length > 0 &&
      `שירות הניתוח לא השיב עבור ${subject(gaps.provider_unavailable)} ` +
        "בסבב הזה, ואפשר להפעיל ניתוח מחדש בעוד מספר דקות.",
    gaps.validation_rejected.length > 0 &&
      `הניתוח שנוצר עבור ${subject(gaps.validation_rejected)} לא עמד ` +
        "בבדיקות האיכות של המערכת ולכן לא הוצג, והפעלה מחדש עשויה להניב " +
        "ניסוח אחר.",
    gaps.unstated.length > 0 &&
      `עבור ${subject(gaps.unstated)} לא נוצר ניתוח מילולי בסבב הזה.`,
    // Only about the dimensions named above, so it stays with them rather
    // than closing the box.
    missing > 0 &&
      (missing === 1
        ? "הציון, פירוט השאלות וההמלצות של הממד הזה מלאים."
        : "הציון, פירוט השאלות וההמלצות של הממדים האלה מלאים."),
    // The same wording the dimension screen uses, on purpose: a manager who
    // follows the link should recognise the sentence rather than wonder
    // whether it is a second, different problem.
    deterministicSummaries.length > 0 &&
      `הפסקאות של ${subject(deterministicSummaries)} נגזרו מן הנתונים ` +
        "המצרפיים של הסבב ולא נכתבו על ידי המודל, ואפשר להפעיל ניתוח מחדש " +
        "כדי לקבל קריאה מלאה.",
  ].filter((sentence): sentence is string => Boolean(sentence));

  return (
    <section className="map-partial-notice" aria-labelledby="map-partial-notice-title">
      <Info size={20} aria-hidden="true" />
      <div>
        {/* A map missing words and a map whose words came from the numbers are
            not the same claim, and the heading is the part a manager reads
            first. Calling a complete map "partial" would be the kind of
            overstatement that teaches people to ignore the box. */}
        <h2 id="map-partial-notice-title">
          {missing > 0 ? "ניתוח חלקי" : "פסקאות שנגזרו מהנתונים"}
        </h2>
        <p>{sentences.join(" ")}</p>
      </div>
    </section>
  );
}
