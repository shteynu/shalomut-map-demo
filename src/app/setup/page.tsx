import { PageIntro } from "@/components/ui";
import { SetupForm } from "@/components/round";
import { ManagerOnboarding } from "@/components/manager";
import { isNewRoundParam, readRoundParam } from "@/lib/navigation";
import { loadManagerContext } from "@/lib/server/manager-context";

export default async function SetupPage({
  searchParams,
}: {
  searchParams: Promise<{ round?: string | string[] }>;
}) {
  const requestedRound = readRoundParam(await searchParams);
  const isNewRound = isNewRoundParam(requestedRound);
  const context = await loadManagerContext(
    isNewRound ? undefined : requestedRound,
  );

  if (context.state === "scope-required" || context.state === "round-not-found") {
    return (
      <ManagerOnboarding
        organizationName={context.organization?.name}
        state={context.state}
      />
    );
  }

  const organizationName = context.organization?.name ?? "בית ספר חדש";
  // In new-round mode the form starts empty even though the school already has
  // rounds: the screen is about the round being opened, not the one running.
  const round = isNewRound ? null : context.selectedRound;
  const roundTitle = round?.title ?? "סבב אבחון חדש";

  return (
    <div className="page stone-page">
      <PageIntro
        eyebrow={`${organizationName}, ${roundTitle}`}
        title={isNewRound ? "פתיחת סבב אבחון חדש" : "הגדרת סבב אבחון"}
        description={
          isNewRound
            ? "פרטי בית הספר נשמרים כפי שהם; כאן נקבעים התקופה, נתוני הרקע וסף הפרטיות של הסבב החדש. הסבב הנוכחי ימשיך לרוץ עד שהשאלון החדש יהיה מוכן."
            : "פתיחת רבעון, הזנת נתוני רקע וקביעת סף פרטיות להצגת תוצאות (הנתונים מוצגים כרקע לדשבורד ואינם מזהים משיבים)."
        }
      />

      <SetupForm
        isNewRound={isNewRound}
        canOpenNewRound={Boolean(context.organization && context.selectedRound)}
        organization={
          context.organization
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
