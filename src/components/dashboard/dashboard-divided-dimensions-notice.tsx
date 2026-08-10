import { Users } from "lucide-react";
import { getDimensionPresentation } from "@/lib/dashboard/dimension-presentation";
import type { DimensionDivision } from "@/lib/dashboard/dimension-division";

/**
 * `conceptLabel` is the caption on the stone, which is the only name a manager
 * can look the dimension up by on this screen.
 */
function nameOf(division: DimensionDivision): string {
  return (
    getDimensionPresentation(division.dimensionId)?.conceptLabel ??
    division.dimensionId
  );
}

/**
 * Where the staff room disagrees with itself, said beside the map.
 *
 * The score cannot carry this: a mean of 60 is the same number whether everyone
 * chose yellow or whether four in ten chose red and six chose green. The second
 * school has a group of teachers asking for action and a headline that hides
 * them.
 *
 * It names the dimensions rather than counting them — unlike the band-edge note
 * above it, which is about a sample size and is therefore true of most stones at
 * once. A division is true of few, and which ones is the whole content.
 *
 * The status is untouched by design (owner decision, 2026-08-10). This is a
 * second fact beside the score, not a correction of it: moving the band on a
 * split room would change what the AI service validates a status against, and
 * that is a contract question rather than a display one.
 */
export function DashboardDividedDimensionsNotice({
  divisions,
}: {
  divisions: DimensionDivision[];
}) {
  if (divisions.length === 0) return null;

  const detail = divisions
    .map(
      (division) =>
        `${nameOf(division)} — ${division.redPercent}% אדום מול ${division.greenPercent}% ירוק`,
    )
    .join("; ");

  return (
    <section
      className="map-divided-notice"
      aria-labelledby="map-divided-notice-title"
    >
      <Users size={20} aria-hidden="true" />
      <div>
        <h2 id="map-divided-notice-title">דעות חלוקות בצוות</h2>
        <p>
          {divisions.length === 1
            ? "בממד אחד התשובות מפוצלות בין שני קצות הסולם"
            : `ב־${divisions.length} ממדים התשובות מפוצלות בין שני קצות הסולם`}
          : {detail}. הציון הממוצע לא מראה את הפיצול הזה, וכדאי לקרוא את הממדים
          האלה לפי פירוט השאלות ולא לפי הציון בלבד.
        </p>
      </div>
    </section>
  );
}
