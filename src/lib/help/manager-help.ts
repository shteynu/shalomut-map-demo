import { goalActionLabels } from "@/lib/goals/labels";
import { scoringThresholds } from "@/lib/shalomut-source";
import { MINIMUM_PRIVACY_THRESHOLD } from "@/lib/survey-definition";
import { DEFAULT_HELP_LOCALE, type HelpLocale } from "@/lib/help/locales";
import { hebrewHelp } from "@/lib/help/topics/he";
import { russianHelp } from "@/lib/help/topics/ru";
import { englishHelp } from "@/lib/help/topics/en";
import type {
  HelpIntro,
  HelpNumbers,
  HelpTopic,
  HelpTopicId,
  HelpTranslation,
} from "@/lib/help/types";

/**
 * What a manager is told about how the product works, on the one screen that
 * exists to answer that.
 *
 * The content lives in a module rather than in JSX for the same reason the
 * scoring bands do: every number in it is derived from the source that owns it,
 * and a test can then prove that. A help screen that says "ten" while the
 * product enforces something else is worse than no help screen — it is the
 * product lying about itself in its own voice.
 *
 * That property is what the translations are built around. A locale file writes
 * sentences and never figures: the numbers are computed here, once, and handed
 * to whichever language is being rendered. Three files cannot drift on a
 * threshold because none of them knows it.
 *
 * What this screen deliberately does not carry, in any language: hosting
 * providers, regions, queue mechanics, contract versions, retry budgets. Those
 * belong to `docs/platform-handbook.md`, whose reader is a team member rather
 * than a principal.
 */

export type { HelpIntro, HelpTopic, HelpTopicId } from "@/lib/help/types";
export * from "@/lib/help/locales";

const translations: Record<HelpLocale, HelpTranslation> = {
  he: hebrewHelp,
  ru: russianHelp,
  en: englishHelp,
};

/** The anchor a screen links to when it wants one topic rather than the page. */
export function helpTopicAnchor(id: HelpTopicId): string {
  return `help-${id}`;
}

/**
 * The figures every translation is handed. Read here and nowhere else, so a
 * methodology change moves all three languages at once.
 */
function helpNumbers(): HelpNumbers {
  return {
    threshold: MINIMUM_PRIVACY_THRESHOLD,
    bands: scoringThresholds,
    removeLabel: goalActionLabels.remove,
  };
}

/**
 * Every topic, in the order a manager meets the questions rather than in the
 * order the system does them: the locked screen comes before the colours,
 * because a locked round is what a school sees first.
 */
export function managerHelpTopics(
  locale: HelpLocale = DEFAULT_HELP_LOCALE,
): HelpTopic[] {
  return translations[locale].topics(helpNumbers());
}

/** The screen's own copy — its heading, and the labels the badge borrows. */
export function managerHelpIntro(
  locale: HelpLocale = DEFAULT_HELP_LOCALE,
): HelpIntro {
  return translations[locale].intro;
}
