/**
 * The languages the manager guide is published in.
 *
 * Hebrew is the product, and the other two are for the people around it — an
 * owner, a methodologist, a partner reading over a principal's shoulder. That
 * asymmetry is why the badge and every other screen stay Hebrew and only the
 * guide switches: a product that changes language under a manager because
 * somebody once opened a translation would be a worse product than a
 * monolingual one.
 *
 * The choice therefore lives in the URL and nowhere else. No cookie, no session,
 * no state — a language is a link, so it works with JavaScript off, it can be
 * sent to someone, and it cannot leak into a screen that did not ask for it.
 */

export const HELP_LOCALES = ["he", "ru", "en"] as const;

export type HelpLocale = (typeof HELP_LOCALES)[number];

export const DEFAULT_HELP_LOCALE: HelpLocale = "he";

/** Each language named in itself, which is the only naming a switcher can use. */
export const helpLocaleLabels: Record<HelpLocale, string> = {
  he: "עברית",
  ru: "Русский",
  en: "English",
};

/**
 * The writing direction the guide's own container takes. The document is
 * `dir="rtl"`, so a translation that does not say otherwise renders with its
 * punctuation at the wrong end and its lists indented from the wrong side.
 */
export const helpLocaleDir: Record<HelpLocale, "rtl" | "ltr"> = {
  he: "rtl",
  ru: "ltr",
  en: "ltr",
};

export function isHelpLocale(value: unknown): value is HelpLocale {
  return (
    typeof value === "string" &&
    (HELP_LOCALES as readonly string[]).includes(value)
  );
}

/** The parameter a link carries to ask for one language. */
export const HELP_LOCALE_PARAM = "lang";

/**
 * Which language a request asked for. Anything unrecognised is Hebrew rather
 * than an error: this is a help screen, and refusing to render one because a
 * link was mistyped would withhold the explanation at the moment it is wanted.
 * A repeated parameter is not a link this app produces, so the first wins — the
 * same rule `readRoundParam` follows.
 */
export function readHelpLocaleParam(searchParams: {
  lang?: string | string[];
}): HelpLocale {
  const value = Array.isArray(searchParams.lang)
    ? searchParams.lang[0]
    : searchParams.lang;

  return isHelpLocale(value) ? value : DEFAULT_HELP_LOCALE;
}
