import { statusLabels } from "@/lib/shalomut-source";
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
 *
 * The labels are the ones the screens have been showing. Some differ from
 * `surveyInstrument` — `self-expression` is "קול אישי" here and "ביטוי עצמי"
 * there — and reconciling them is a product decision, not a refactor.
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

export const dimensionPresentations: DimensionPresentation[] = [
  {
    id: "self-expression",
    label: "קול אישי",
    conceptLabel: "קול אישי",
    subtitle: "אפשרות לביטוי עצמי",
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
  {
    id: "professional-competence",
    label: "מומחיות בטוחה",
    conceptLabel: "מומחיות בטוחה",
    subtitle: "תחושת מסוגלות מקצועית",
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
  {
    id: "social-resource",
    label: "משאב חברתי",
    conceptLabel: "משאב חברתי",
    subtitle: "קשרים חיוביים עם עמיתות ועמיתים",
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
  {
    id: "balance",
    label: "איזון",
    conceptLabel: "איזון",
    subtitle: "יחס מאוזן בין כמות המשימות לזמן לביצוען",
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
  {
    id: "management-support",
    label: "עוגן",
    conceptLabel: "עורף מקצועי",
    subtitle: "תמיכה מהנהלה",
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
  {
    id: "certainty",
    label: "ודאות",
    conceptLabel: "ודאות",
    subtitle: "ודאות בסביבת עבודה",
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
  {
    id: "organizational-climate",
    label: "אקלים ארגוני",
    conceptLabel: "אקלים ארגוני",
    subtitle: "קידום רווחה נפשית כחלק מתרבות הארגון",
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
  {
    id: "meaning",
    label: "משמעות",
    conceptLabel: "משמעות",
    subtitle: "תחושת ערך ומשמעות בעבודה",
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
];

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
