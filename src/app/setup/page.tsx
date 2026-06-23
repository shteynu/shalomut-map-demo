import Link from "next/link";
import { ArrowLeft, ClipboardList } from "lucide-react";
import { PageIntro } from "@/components/app-shell";
import { SetupForm } from "@/components/setup-form";
import { activeRound, organization } from "@/lib/demo-data";

export default function SetupPage() {
  return (
    <div className="page stone-page">
      <PageIntro
        eyebrow={`${organization.name}, ${activeRound.period}`}
        title="הגדרת סבב אבחון"
        description="פתיחת רבעון, הזנת נתוני רקע וקביעת סף פרטיות להצגת תוצאות (הנתונים מוצגים כרקע לדשבורד ואינם מזהים משיבים)."
        actions={
          <Link className="secondary-button" href="/survey">
            עריכת שאלון
            <ClipboardList size={18} aria-hidden="true" />
          </Link>
        }
      />

      <SetupForm />

      <div className="next-step-band">
        <span>לאחר שמירת סבב האבחון ניתן להפיץ את הלינק האנונימי לצוות.</span>
        <Link href="/round">
          מעבר למעקב סבב אבחון
          <ArrowLeft size={16} aria-hidden="true" />
        </Link>
      </div>
    </div>
  );
}
