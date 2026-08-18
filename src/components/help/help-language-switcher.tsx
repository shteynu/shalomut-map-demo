import Link from "next/link";
import { Languages } from "lucide-react";
import { helpRoute } from "@/lib/navigation";
import {
  DEFAULT_HELP_LOCALE,
  HELP_LOCALES,
  helpLocaleLabels,
  type HelpLocale,
} from "@/lib/help/locales";

/**
 * Three links, not a select.
 *
 * A language here is a URL, which means it survives JavaScript being off, it can
 * be sent to somebody, and the browser's Back button undoes it. A control that
 * changed the page in place would have to keep the choice somewhere, and the one
 * place it could keep it — a cookie — would then decide the language of a screen
 * nobody asked to translate.
 *
 * `current` is marked with `aria-current` rather than removed, so the set reads
 * as a group of three with one active instead of a group of two beside a label.
 */
export function HelpLanguageSwitcher({
  current,
  label,
  topicAnchor,
  compact = false,
}: {
  current: HelpLocale;
  label: string;
  /** Keeps the reader on the same answer when they change language. */
  topicAnchor?: string;
  compact?: boolean;
}) {
  return (
    <nav
      className={`help-languages${compact ? " is-compact" : ""}`}
      aria-label={label}
    >
      <Languages size={compact ? 14 : 16} aria-hidden="true" />
      <ul>
        {HELP_LOCALES.map((locale) => {
          const isCurrent = locale === current;

          return (
            <li key={locale}>
              <Link
                href={helpRoute(
                  topicAnchor,
                  locale === DEFAULT_HELP_LOCALE ? undefined : locale,
                )}
                className={isCurrent ? "is-current" : undefined}
                aria-current={isCurrent ? "true" : undefined}
                lang={locale}
              >
                {helpLocaleLabels[locale]}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
