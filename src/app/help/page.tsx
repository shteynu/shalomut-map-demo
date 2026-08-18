import { ManagerHelpBoard } from "@/components/help";
import { PageIntro } from "@/components/ui";
import { managerHelpTopics } from "@/lib/help/manager-help";

/**
 * The manager guide.
 *
 * Deliberately outside every scope the other screens carry: no school, no
 * round, no analytics, no repository. It answers questions about how the
 * product behaves, and those answers are the same for a manager whose round is
 * locked, whose database is empty, or who has not opened a round at all —
 * which is precisely when they are most likely to be asked.
 */
export default function HelpPage() {
  return (
    <div className="page stone-page">
      <PageIntro
        eyebrow="מדריך למנהל"
        title="איך המערכת עובדת"
        description="התשובות לשאלות שהמסכים מעוררים: מתי התוצאה נעולה ולמה, איך נקבע צבע של אבן, מה הבינה המלאכותית כותבת ומה היא לא מחליטה, ומה בכלל נשמר על מי שהשיב."
      />

      <ManagerHelpBoard topics={managerHelpTopics()} />
    </div>
  );
}
