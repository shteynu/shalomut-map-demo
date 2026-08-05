import { Info } from "lucide-react";
import type { DashboardInsightsDto } from "@/lib/dashboard/dashboard-insights";
import { getDimensionPresentation } from "@/lib/dashboard/dimension-presentation";
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
 */
export function DashboardPartialMapNotice({
  gaps,
}: {
  gaps: DashboardInsightsDto["gapsByReason"];
}) {
  const total =
    gaps.provider_unavailable.length +
    gaps.validation_rejected.length +
    gaps.unstated.length;
  if (total === 0) return null;

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
    total === 1
      ? "הציון, פירוט השאלות וההמלצות של הממד הזה מלאים."
      : "הציון, פירוט השאלות וההמלצות של הממדים האלה מלאים.",
  ].filter((sentence): sentence is string => Boolean(sentence));

  return (
    <section className="map-partial-notice" aria-labelledby="map-partial-notice-title">
      <Info size={20} aria-hidden="true" />
      <div>
        <h2 id="map-partial-notice-title">ניתוח חלקי</h2>
        <p>{sentences.join(" ")}</p>
      </div>
    </section>
  );
}
