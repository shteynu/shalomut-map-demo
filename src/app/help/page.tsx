import { ManagerHelpBoard } from "@/components/help";
import { PageIntro } from "@/components/ui";
import { helpLocaleDir } from "@/lib/help/locales";
import {
  managerHelpIntro,
  managerHelpTopics,
  readHelpLocaleParam,
} from "@/lib/help/manager-help";

/**
 * The manager guide.
 *
 * Deliberately outside every scope the other screens carry: no school, no
 * round, no analytics, no repository. It answers questions about how the
 * product behaves, and those answers are the same for a manager whose round is
 * locked, whose database is empty, or who has not opened a round at all —
 * which is precisely when they are most likely to be asked.
 *
 * The one thing it does read is the language, from `?lang=`. That keeps the
 * screen a pure function of its URL: no cookie, no session, nothing that could
 * decide the language of a screen that never asked to be translated.
 */
export default async function HelpPage({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string | string[] }>;
}) {
  const locale = readHelpLocaleParam(await searchParams);
  const intro = managerHelpIntro(locale);

  return (
    // The heading belongs to the translation as much as the topics do: the
    // document is `dir="rtl"`, and an intro left to inherit it puts the full
    // stop of a Russian sentence at the wrong end of the line.
    <div className="page stone-page" lang={locale} dir={helpLocaleDir[locale]}>
      <PageIntro
        eyebrow={intro.eyebrow}
        title={intro.title}
        description={intro.description}
      />

      <ManagerHelpBoard
        topics={managerHelpTopics(locale)}
        intro={intro}
        locale={locale}
      />
    </div>
  );
}
