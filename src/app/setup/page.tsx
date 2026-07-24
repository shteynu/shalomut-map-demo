import { PageIntro } from "@/components/ui";
import { SetupForm } from "@/components/round";
import { activeRound, organization } from "@/lib/demo-data";

export default function SetupPage() {
  return (
    <div className="page stone-page">
      <PageIntro
        eyebrow={`${organization.name}, ${activeRound.period}`}
        title="הגדרת סבב אבחון"
        description="פתיחת רבעון, הזנת נתוני רקע וקביעת סף פרטיות להצגת תוצאות (הנתונים מוצגים כרקע לדשבורד ואינם מזהים משיבים)."
      />

      <SetupForm />

      <div className="next-step-band">
        <span>לאחר שמירת סבב האבחון ניתן להפיץ את הלינק האנונימי לצוות.</span>
      </div>
    </div>
  );
}
