import { Info } from "lucide-react";
import { getDimensionPresentation } from "@/lib/dashboard/dimension-presentation";
import type { WellbeingDimensionId } from "@/lib/shalomut-source";

/**
 * The map says one dimension is missing its words, before anyone opens it.
 *
 * A partial map already tells a manager the truth — but only on the dimension
 * screen, which is exactly the screen someone who trusts the map will never
 * open. Eight stones with eight scores read as a complete analysis, and the
 * one that has no interpretation looks like the seven that do.
 *
 * Deliberately not an error. Nothing here failed for the manager: the scores,
 * the questions and the recommendations of that dimension are all real, and
 * saying so is what keeps this from reading as "the analysis is broken".
 */
export function DashboardPartialMapNotice({
  dimensionIds,
}: {
  dimensionIds: WellbeingDimensionId[];
}) {
  if (dimensionIds.length === 0) return null;

  // `conceptLabel` is what the stone on the map is captioned with. Naming a
  // dimension here by any of its other Hebrew names would send a manager
  // looking for a stone that is not there.
  const names = dimensionIds.map(
    (dimensionId) =>
      getDimensionPresentation(dimensionId)?.conceptLabel ?? dimensionId,
  );
  // Hebrew counts one and many differently down the whole sentence — the
  // subject, the pronoun and the demonstrative all change — so the two are
  // written out rather than spliced together from fragments.
  const body =
    names.length === 1
      ? `בסבב הזה לא נוצר ניתוח מילולי לממד ${names[0]}, והמפה מוצגת בלעדיו. ` +
        "הציון, פירוט השאלות וההמלצות של הממד הזה מלאים, ואפשר להפעיל ניתוח " +
        "מחדש כדי לנסות שוב."
      : `בסבב הזה לא נוצר ניתוח מילולי ל־${names.length} ממדים — ` +
        `${names.join(", ")} — והמפה מוצגת בלעדיהם. ` +
        "הציון, פירוט השאלות וההמלצות של הממדים האלה מלאים, ואפשר להפעיל " +
        "ניתוח מחדש כדי לנסות שוב.";

  return (
    <section className="map-partial-notice" aria-labelledby="map-partial-notice-title">
      <Info size={20} aria-hidden="true" />
      <div>
        <h2 id="map-partial-notice-title">ניתוח חלקי</h2>
        <p>{body}</p>
      </div>
    </section>
  );
}
