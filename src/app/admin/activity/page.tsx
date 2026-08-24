import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { ActivityLog } from "@/components/activity";
import { PageIntro } from "@/components/ui";
import { buildActivityLog } from "@/lib/audit/activity-log-view";
import {
  formatAuditLogCursor,
  parseAuditLogCursor,
  takeAuditLogPage,
} from "@/lib/audit/audit-log-cursor";
import {
  ManagerAuditService,
  PLATFORM_SCOPE,
} from "@/lib/auth/manager-audit-service";
import { resolveCoreRepositories } from "@/lib/composition-root";
import { ACTIVITY_AFTER_PARAM, adminActivityRoute, routes } from "@/lib/navigation";
import { ACTIVITY_LOG_PAGE_SIZE } from "@/lib/server/manager-context";
import { resolveManagerSessionFromHeaders } from "@/lib/server/session-auth";

/**
 * What was done above every school.
 *
 * `ManagerAuditService.logEvent` files an event under the school the session is
 * in, and one action has no school to be in: inviting a platform administrator
 * happens over the whole platform, so it is recorded under `PLATFORM_SCOPE`.
 * That put it in a bucket every school's log excludes by definition, and until
 * this screen nothing read it — the log recorded who was granted the right to
 * open every school, and no screen could say so.
 *
 * Its own page rather than a section on the console, for a reason the address
 * bar decides: `/admin` already keeps its search and its page there, and a
 * second cursor beside them would be two pagers whose every link has to carry
 * the other's state or silently reset it.
 *
 * No `loadManagerContext`, and that is the one thing this shares with `/admin`
 * rather than with the school's log: there is no school here to be inside, so
 * there is no visit to record and nothing for a per-school chokepoint to name.
 * `check-tenant-chokepoints.mjs` holds that claim, and holds it by name.
 */
export default async function AdminActivityPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await connection();

  const session = await resolveManagerSessionFromHeaders({
    headers: await headers(),
  });
  // The same second lock the console has, for the same reason: the middleware
  // refused everybody else already, and this is the refusal made by the thing
  // that renders the rows, so a matcher change cannot turn the page into a list
  // of who was granted the platform.
  if (!session?.isPlatformAdministrator) notFound();

  const params = await searchParams;
  const after = parseAuditLogCursor(params[ACTIVITY_AFTER_PARAM]);

  const { auditLogRepo, managerRepo } = resolveCoreRepositories();
  const events = await ManagerAuditService.getOrganizationAuditLogs(
    auditLogRepo,
    session,
    PLATFORM_SCOPE,
    { limit: ACTIVITY_LOG_PAGE_SIZE + 1, after },
  );

  const { page, nextCursor } = takeAuditLogPage(events, ACTIVITY_LOG_PAGE_SIZE);
  const actors = await managerRepo.findManagersByIds([
    ...new Set(page.map((event) => event.managerId)),
  ]);

  const entries = buildActivityLog(page, {
    actorsById: new Map(actors.map((actor) => [actor.id, actor.email])),
    // No rounds here, and there never will be: a round belongs to a school, so
    // an event naming one is not an event of the platform.
    roundTitlesById: new Map(),
  });

  return (
    <div className="page stone-page">
      <PageIntro
        eyebrow="ניהול פלטפורמה"
        title="יומן הפלטפורמה"
        description="פעולות שנעשו מעל בתי הספר ולא בתוך אחד מהם — כרגע זו הזמנת מנהל פלטפורמה. מה שנעשה בתוך בית ספר נרשם ביומן שלו, ונקרא משם."
      />

      {/* A button for the reason the console's link is one: every anchor in
          this stylesheet renders as plain text unless it is given a shape. */}
      <p className="activity-back">
        <a className="secondary-button" href={routes.admin}>
          חזרה לבתי הספר ולמשתמשים
        </a>
      </p>

      <ActivityLog
        entries={entries}
        emptyText="עדיין לא נרשמה פעולה מעל בתי הספר."
        nextHref={
          nextCursor
            ? adminActivityRoute(formatAuditLogCursor(nextCursor))
            : undefined
        }
        newestHref={after ? adminActivityRoute() : undefined}
      />
    </div>
  );
}
