import { PageIntro } from "@/components/ui";
import { SetupForm } from "@/components/round";
import { SchoolSwitcher } from "@/components/school";
import { ManagerOnboarding } from "@/components/manager";
import {
  isNewRoundParam,
  isNewSchoolParam,
  readRoundParam,
  readSchoolParam,
  routes,
} from "@/lib/navigation";
import { toSchoolSwitcherOptions } from "@/lib/schools/school-options";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { loadManagerContext, loadSchools } from "@/lib/server/manager-context";
import { resolveManagerSessionFromHeaders } from "@/lib/server/session-auth";

export default async function SetupPage({
  searchParams,
}: {
  searchParams: Promise<{ round?: string | string[]; school?: string | string[] }>;
}) {
  const resolvedSearchParams = await searchParams;
  const requestedRound = readRoundParam(resolvedSearchParams);
  const isNewRound = isNewRoundParam(requestedRound);
  const session = await resolveManagerSessionFromHeaders({
    headers: await headers(),
  });
  // A school is opened by a platform administrator, who then invites its user.
  // Anybody else asking for the new-school form is sent back to their own
  // school rather than shown a form whose save is refused.
  const mayOpenASchool = Boolean(session?.isPlatformAdministrator);
  const isNewSchool =
    isNewSchoolParam(readSchoolParam(resolvedSearchParams)) && mayOpenASchool;
  if (isNewSchoolParam(readSchoolParam(resolvedSearchParams)) && !mayOpenASchool) {
    redirect(routes.setup);
  }
  // A school that does not exist yet has no rounds to ask for. Loading the
  // context anyway is what keeps the switcher — and the way back to the school
  // the manager came from — on the screen while the new one is filled in.
  const [context, schools] = await Promise.all([
    loadManagerContext(isNewRound || isNewSchool ? undefined : requestedRound, {
      withAnalytics: false,
    }),
    loadSchools(),
  ]);

  const schoolOptions = toSchoolSwitcherOptions(
    schools,
    context.organization?.id,
  );
  const switcher = (
    <SchoolSwitcher options={schoolOptions} isNewSchool={isNewSchool} />
  );

  // Several schools and no way to tell which one this request is about. The
  // switcher is the answer to exactly that question, so the screen asks it
  // instead of sending the manager to an onboarding dead end.
  if (context.state === "scope-required" && !isNewSchool) {
    return (
      <div className="page stone-page">
        <PageIntro
          eyebrow="מפת השלומות"
          title="בחירת בית ספר"
          description="במערכת יש יותר מבית ספר אחד. בחרו את בית הספר שאתם עובדים בו — כל המסכים, סבבי האבחון והמפה יוצגו עבורו."
        />
        {switcher}
      </div>
    );
  }

  if (context.state === "round-not-found") {
    return (
      <ManagerOnboarding
        organizationName={context.organization?.name}
        state={context.state}
        // This screen already read every school for its own switcher, so the
        // dead end is given that list rather than asking for it again.
        schoolChoices={{ options: schoolOptions, roundId: requestedRound }}
      />
    );
  }

  const organizationName = isNewSchool
    ? "בית ספר חדש"
    : (context.organization?.name ?? "בית ספר חדש");
  // In new-round mode the form starts empty even though the school already has
  // rounds: the screen is about the round being opened, not the one running.
  // A new school starts empty for both, because it has neither yet.
  const round = isNewRound || isNewSchool ? null : context.selectedRound;
  const roundTitle = round?.title ?? "סבב אבחון חדש";

  return (
    <div className="page stone-page">
      <PageIntro
        eyebrow={`${organizationName}, ${roundTitle}`}
        title={
          isNewSchool
            ? "הוספת בית ספר"
            : isNewRound
              ? "פתיחת סבב אבחון חדש"
              : "הגדרת סבב אבחון"
        }
        description={
          isNewSchool
            ? "פרטי בית הספר החדש וסבב האבחון הראשון שלו. לאחר השמירה כל המסכים יוצגו עבור בית הספר הזה, ואפשר יהיה לעבור בין בתי הספר מהמסך הזה."
            : isNewRound
              ? "פרטי בית הספר נשמרים כפי שהם; כאן נקבעים התקופה, נתוני הרקע וסף הפרטיות של הסבב החדש. הסבב הנוכחי ימשיך לרוץ עד שהסבב החדש יעלה לאוויר."
              : "פתיחת רבעון, הזנת נתוני רקע וקביעת סף פרטיות להצגת תוצאות (הנתונים מוצגים כרקע לדשבורד ואינם מזהים משיבים)."
        }
      />

      {switcher}

      <SetupForm
        /*
         * What the form is about, so that moving to another school — or to one
         * that does not exist yet — builds a new form rather than reusing this
         * one. Without it the state React keeps across a client-side navigation
         * comes along: an empty new-school form would open reporting the moment
         * the previous school was last saved.
         */
        key={`${isNewSchool ? "new" : (context.organization?.id ?? "none")}:${
          isNewRound ? "new" : (round?.id ?? "none")
        }`}
        isNewRound={isNewRound}
        isNewSchool={isNewSchool}
        canOpenNewRound={Boolean(
          !isNewSchool && context.organization && context.selectedRound,
        )}
        canOpenNewSchool={Boolean(
          !isNewSchool && context.organization && mayOpenASchool,
        )}
        organization={
          !isNewSchool && context.organization
            ? {
                id: context.organization.id,
                name: context.organization.name,
                city: context.organization.city,
                schoolType: context.organization.schoolType,
                totalStaffCount: context.organization.totalStaffCount,
              }
            : null
        }
        round={
          round
            ? {
                id: round.id,
                title: round.title,
                startDate: round.startDate.toISOString().slice(0, 10),
                endDate: round.endDate?.toISOString().slice(0, 10) ?? "",
                privacyThreshold: round.privacyThreshold,
                updatedAt: round.updatedAt?.toISOString(),
                backgroundContext: round.backgroundContext,
              }
            : null
        }
      />

      <div className="next-step-band">
        <span>לאחר שמירת סבב האבחון ניתן להפיץ את הלינק האנונימי לצוות.</span>
      </div>
    </div>
  );
}
