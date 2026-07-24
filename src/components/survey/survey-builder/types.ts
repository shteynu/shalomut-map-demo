import type { WellbeingDimensionId } from "@/lib/shalomut-source";

export type BuilderQuestion = {
  id: string;
  text: string;
  dimensionId: WellbeingDimensionId;
  required: boolean;
  enabled: boolean;
  answerMode: string;
};
