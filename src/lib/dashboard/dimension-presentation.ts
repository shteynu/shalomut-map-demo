import { statusLabels, surveyInstrument } from "@/lib/shalomut-source";
import type { WellbeingDimensionId, WellbeingStatus } from "@/lib/shalomut-source";

export { statusLabels };

/**
 * How one wellbeing dimension looks on the Stone Map, independent of any round.
 *
 * This used to live in `demo-data.ts` inside a `WellbeingDimension` that also
 * held a score, a status and Hebrew analysis copy. The two have different
 * lifetimes: geometry and labels are fixed product design, while everything
 * about a round arrives from the analysis as a `DashboardStone`. Keeping them
 * in one type is what kept several hundred lines of demo interpretation in a
 * production module.
 */
export type DimensionPresentation = {
  id: WellbeingDimensionId;
  label: string;
  conceptLabel: string;
  subtitle: string;
  mapPosition: {
    top: string;
    right: string;
    size: string;
    rotate: number;
  };
  conceptPosition: {
    top: string;
    right: string;
    width: string;
    height: string;
    rotate: number;
    radius: string;
  };
  /**
   * Where the hover "+" sits inside the concept stone. Each stone is a
   * different organic shape, so the mark is placed per dimension rather than
   * by one rule; the numbers were tuned by eye against the shapes above.
   */
  plusPosition: {
    top: string;
    left: string;
  };
  conceptColor: string;
};

/**
 * What the map owns about a dimension, as opposed to what the methodology owns.
 *
 * Geometry, colour and the map's own short name for the stone. Everything else
 * a `DimensionPresentation` carries — which dimensions exist, in what order,
 * what each is called as a concept and how it is described — is read from
 * `surveyInstrument` below rather than written again here.
 *
 * This file used to re-declare all eight dimensions with their own copies of
 * those strings. Nothing asserted the two lists stayed in step, and they had
 * not: `balance` was described as "יחס מאוזן בין כמות המשימות לזמן לביצוען"
 * on the map and "היחס בין היקף המשימות לבין הזמן לביצוען" in the source. The
 * map now shows the source's wording, so there is one place to change it.
 *
 * A `Record` keyed by the dimension union rather than an array, so the
 * compiler — not a test, and not the manager's screen — is what refuses a
 * ninth dimension with no stone and a stone with no dimension.
 */
type DimensionMapPlacement = Omit<
  DimensionPresentation,
  "id" | "conceptLabel" | "subtitle"
>;

const dimensionMapPlacements: Record<
  WellbeingDimensionId,
  DimensionMapPlacement
> = {
  "self-expression": {
    // The map's name for the stone, deliberately not the source's `label`
    // ("ביטוי עצמי"). Which name each screen shows is a product decision, and
    // it is the one thing here that is genuinely the map's to make.
    label: "קול אישי",
    mapPosition: { top: "10%", right: "12%", size: "8.6rem", rotate: -9 },
    conceptPosition: {
      top: "2%",
      right: "2%",
      width: "17rem",
      height: "9.5rem",
      rotate: 0,
      radius: "44% 56% 52% 48% / 48% 38% 62% 52%",
    },
    plusPosition: { top: "1.4rem", left: "2.0rem" },
    conceptColor: "#24bf10",
  },
  "professional-competence": {
    label: "מומחיות בטוחה",
    mapPosition: { top: "18%", right: "34%", size: "7.9rem", rotate: 7 },
    conceptPosition: {
      top: "30%",
      right: "6%",
      width: "14rem",
      height: "10.5rem",
      rotate: 7,
      radius: "42% 58% 40% 60% / 47% 38% 62% 53%",
    },
    plusPosition: { top: "1.2rem", left: "2.8rem" },
    conceptColor: "#24bf10",
  },
  "social-resource": {
    label: "משאב חברתי",
    mapPosition: { top: "37%", right: "22%", size: "10.2rem", rotate: -3 },
    conceptPosition: {
      top: "34%",
      right: "36%",
      width: "16rem",
      height: "10rem",
      rotate: 0,
      radius: "36% 64% 40% 60% / 44% 34% 66% 56%",
    },
    plusPosition: { top: "1.8rem", left: "2.4rem" },
    conceptColor: "#e49902",
  },
  "balance": {
    label: "איזון",
    mapPosition: { top: "58%", right: "11%", size: "9.4rem", rotate: 10 },
    conceptPosition: {
      top: "32%",
      right: "70%",
      width: "14rem",
      height: "9.5rem",
      rotate: 0,
      radius: "40% 60% 37% 63% / 44% 40% 60% 56%",
    },
    plusPosition: { top: "1.5rem", left: "2.9rem" },
    conceptColor: "#cf2c4e",
  },
  "management-support": {
    label: "עוגן",
    mapPosition: { top: "15%", right: "57%", size: "8.8rem", rotate: -11 },
    conceptPosition: {
      top: "5%",
      right: "72%",
      width: "13rem",
      height: "9.5rem",
      rotate: 4,
      radius: "39% 61% 41% 59% / 48% 36% 64% 52%",
    },
    plusPosition: { top: "1.3rem", left: "3.6rem" },
    conceptColor: "#e49902",
  },
  "certainty": {
    label: "ודאות",
    mapPosition: { top: "38%", right: "52%", size: "8.4rem", rotate: 8 },
    conceptPosition: {
      top: "4%",
      right: "42%",
      width: "15rem",
      height: "9rem",
      rotate: -3,
      radius: "45% 55% 42% 58% / 36% 46% 54% 64%",
    },
    plusPosition: { top: "1.7rem", left: "2.1rem" },
    conceptColor: "#e49902",
  },
  "organizational-climate": {
    label: "אקלים ארגוני",
    mapPosition: { top: "57%", right: "42%", size: "8rem", rotate: -5 },
    conceptPosition: {
      top: "62%",
      right: "22%",
      width: "16rem",
      height: "10.5rem",
      rotate: 0,
      radius: "42% 58% 38% 62% / 49% 39% 61% 51%",
    },
    plusPosition: { top: "1.2rem", left: "3.3rem" },
    conceptColor: "#24bf10",
  },
  "meaning": {
    label: "משמעות",
    mapPosition: { top: "32%", right: "75%", size: "8.8rem", rotate: 5 },
    conceptPosition: {
      top: "64%",
      right: "58%",
      width: "16rem",
      height: "10rem",
      rotate: 0,
      radius: "44% 56% 40% 60% / 44% 34% 66% 56%",
    },
    plusPosition: { top: "1.6rem", left: "2.7rem" },
    conceptColor: "#24bf10",
  },
};

/**
 * The eight stones, in the order the methodology lists them.
 *
 * Derived rather than written, so the map cannot show a stone the instrument
 * does not have, or miss one it does. The order comes from the same place for
 * the same reason — it used to match by coincidence.
 */
export const dimensionPresentations: DimensionPresentation[] =
  surveyInstrument.dimensions.map((dimension) => ({
    id: dimension.id,
    conceptLabel: dimension.conceptLabel,
    subtitle: dimension.subtitle,
    ...dimensionMapPlacements[dimension.id],
  }));

export function getDimensionPresentation(
  id: string,
): DimensionPresentation | undefined {
  return dimensionPresentations.find((dimension) => dimension.id === id);
}

export function getDimensionStaticParams() {
  return dimensionPresentations.map((dimension) => ({
    dimension: dimension.id,
  }));
}

/* Dashboard stone surfaces stay soft, but use the same three-status model as
   the main branch: green / yellow / red. Labels and dots still duplicate the
   status so the map does not rely on color alone. */
export const statusSurfaces: Record<WellbeingStatus, string> = {
  green: "var(--pastel-green)",
  yellow: "var(--pastel-yellow)",
  red: "var(--pastel-pink)",
};

export function getDimensionSurface(status: WellbeingStatus) {
  return statusSurfaces[status];
}
