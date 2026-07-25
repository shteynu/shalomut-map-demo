import { PageIntro } from "@/components/ui";
import { SetupForm } from "@/components/round";
import { ManagerOnboarding } from "@/components/manager";
import { loadManagerContext } from "@/lib/server/manager-context";

export default async function SetupPage() {
  const context = await loadManagerContext();
  if (context.state === "scope-required") {
    return <ManagerOnboarding state={context.state} />;
  }

  const organizationName = context.organization?.name ?? "בית ספר חדש";
  const roundTitle = context.currentRound?.title ?? "סבב אבחון חדש";

  return (
    <div className="page stone-page">
      <PageIntro
        eyebrow={`${organizationName}, ${roundTitle}`}
        title="הגדרת סבב אבחון"
        description="פתיחת רבעון, הזנת נתוני רקע וקביעת סף פרטיות להצגת תוצאות (הנתונים מוצגים כרקע לדשבורד ואינם מזהים משיבים)."
      />

      <SetupForm
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
          context.currentRound
            ? {
                id: context.currentRound.id,
                title: context.currentRound.title,
                startDate: context.currentRound.startDate.toISOString().slice(0, 10),
                endDate: context.currentRound.endDate?.toISOString().slice(0, 10) ?? "",
                privacyThreshold: context.currentRound.privacyThreshold,
                backgroundContext: context.currentRound.backgroundContext,
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
