import { ActivityLog } from "@/components/activity";
import { ManagerOnboarding } from "@/components/manager";
import { PageIntro } from "@/components/ui";
import {
  formatAuditLogCursor,
  parseAuditLogCursor,
} from "@/lib/audit/audit-log-cursor";
import { ACTIVITY_AFTER_PARAM, activityRoute } from "@/lib/navigation";
import {
  loadManagerContext,
  loadSchoolActivity,
  loadSchoolChoices,
} from "@/lib/server/manager-context";

/**
 * What was done in this school, and by whom.
 *
 * The screen the administrative audit was missing. Every manager write has been
 * recorded since the owner made the audit mandatory on 2026-08-23, and the read
 * was bounded and paged before anything called it — this is the caller.
 *
 * Administrator-only, and enforced twice: the middleware turns a school user's
 * URL away, and the navigation does not render the tab. The narrower answer is
 * deliberate. The log records that an administrator opened a school, so showing
 * it to the school would answer a question nobody has asked the owner yet.
 *
 * Not round-scoped, like the goals and unlike everything between them: an
 * action outlives the round it was performed on, and the question this screen
 * answers is what has happened in this school.
 */
export default async function ActivityPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const context = await loadManagerContext(undefined, { withAnalytics: false });

  if (!context.organization) {
    return (
      <ManagerOnboarding
        state={context.state}
        schoolChoices={await loadSchoolChoices(context)}
      />
    );
  }

  const params = await searchParams;
  const after = parseAuditLogCursor(params[ACTIVITY_AFTER_PARAM]);
  const { entries, nextCursor } = await loadSchoolActivity(context, after);

  return (
    <div className="page stone-page">
      <PageIntro
        eyebrow={context.organization.name}
        title="יומן פעולות"
        description="כל פעולה ניהולית שנרשמה בבית הספר הזה, מהחדשה לישנה. היומן מתעד מי פעל ומתי, ואינו מכיל שום תשובה של משיב ושום פרט מזהה עליו."
      />

      <ActivityLog
        entries={entries}
        emptyText="עדיין לא נרשמה פעולה בבית הספר הזה."
        nextHref={
          nextCursor ? activityRoute(formatAuditLogCursor(nextCursor)) : undefined
        }
        // Offered only on a continued page, so the newest page does not carry a
        // link back to itself.
        newestHref={after ? activityRoute() : undefined}
      />
    </div>
  );
}
