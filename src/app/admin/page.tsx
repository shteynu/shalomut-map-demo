import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { AdminConsole } from "@/components/admin";
import { PageIntro } from "@/components/ui";
import { ManagerAdministrationService } from "@/lib/auth/manager-administration-service";
import { resolveCoreRepositories } from "@/lib/composition-root";
import { resolveManagerSessionFromHeaders } from "@/lib/server/session-auth";

/**
 * The platform's own screen: every school, and who reaches each one.
 *
 * It is not scoped to a school and deliberately does not go through
 * `loadManagerContext` — there is no school to be inside, and reading this list
 * is not a visit to any of them. Opening one of these schools is, and that is
 * recorded when the administrator follows a link into it.
 */
export default async function AdminPage() {
  await connection();

  const session = await resolveManagerSessionFromHeaders({
    headers: await headers(),
  });
  // The middleware already refused everybody else. This is the same refusal
  // made by the thing that renders the data, so a matcher change cannot turn
  // the page into a list of every school and every address.
  if (!session?.isPlatformAdministrator) notFound();

  const { managerRepo, orgRepo, roundRepo, surveyRepo } =
    resolveCoreRepositories();
  const overview = await ManagerAdministrationService.loadOverview(
    orgRepo,
    managerRepo,
    roundRepo,
    surveyRepo,
  );

  return (
    <div className="page stone-page">
      <PageIntro
        eyebrow="ניהול פלטפורמה"
        title="בתי ספר ומשתמשים"
        description="כאן נפתחים בתי ספר וניתנת הגישה אליהם. לכל בית ספר משתמש אחד. הזמנה אינה סיסמה — היא הרשאה: מי שהוזמן נכנס עם חשבון הארגון שלו, וההזמנה הופכת לפעילה ברגע הכניסה הראשונה."
      />

      <AdminConsole
        schools={overview.schools.map((school) => ({
          id: school.organization.id,
          name: school.organization.name,
          city: school.organization.city,
          totalStaffCount: school.organization.totalStaffCount,
          roundCount: school.roundCount,
          // Passed through as it is built. The screen decides how to say these
          // numbers and never which ones exist — a card that derived a figure of
          // its own would be deriving it per school, in a list, which is the
          // shape the k-anonymity limit refuses.
          currentRound: school.currentRound,
          people: school.people.map(({ manager, membership }) => ({
            membershipId: membership.id,
            email: manager.email,
            name: manager.name,
            status: membership.status,
          })),
        }))}
        administrators={overview.administrators.map((manager) => ({
          email: manager.email,
          name: manager.name,
          isSelf: manager.id === session.managerId,
        }))}
        unattached={overview.unattached.map((manager) => ({
          email: manager.email,
          name: manager.name,
        }))}
      />
    </div>
  );
}
