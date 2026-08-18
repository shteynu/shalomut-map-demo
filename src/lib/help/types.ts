import type { WellbeingStatus } from "@/lib/shalomut-source";

/**
 * The shape every translation of the guide fills in.
 *
 * It sits in its own module so a locale file can import it without importing the
 * facade that imports every locale file.
 */

export type HelpTopicId =
  | "privacy"
  | "colors"
  | "ai"
  | "round"
  | "questionnaire"
  | "goals"
  | "data";

export interface HelpTopic {
  id: HelpTopicId;
  /** The question a manager would actually ask, in their words. */
  title: string;
  /** One or two sentences that answer it before any detail. */
  summary: string;
  /** What follows from the answer, including what the manager can do. */
  points: string[];
}

export interface HelpIntro {
  eyebrow: string;
  title: string;
  description: string;
  /** The heading over the topic list in the floating badge. */
  badgeTitle: string;
  /** The link from the badge to the whole screen. */
  wholeGuide: string;
  /** The label over the language switcher. */
  languageLabel: string;
}

/**
 * What a translation may not invent.
 *
 * Every figure the guide shows a manager is computed by the facade from the
 * module that enforces it and handed here, so a locale file has no way to write
 * a number of its own. That is the property the tests check, and it is why these
 * arrive as data rather than as instructions to a translator.
 */
export interface HelpNumbers {
  /** `MINIMUM_PRIVACY_THRESHOLD`. */
  threshold: number;
  /** The scoring bands, in the order the manifest declares them. */
  bands: ReadonlyArray<{ status: WellbeingStatus; min: number; max: number }>;
  /**
   * The Hebrew label on the button that removes a goal. It stays Hebrew in
   * every translation, because it is what the manager sees on the screen: a
   * translated button name would send them looking for a control that does not
   * exist.
   */
  removeLabel: string;
}

export interface HelpTranslation {
  intro: HelpIntro;
  topics(numbers: HelpNumbers): HelpTopic[];
}
