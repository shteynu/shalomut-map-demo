import Link from "next/link";
import { ArrowLeft, ClipboardList } from "lucide-react";
import { PageIntro } from "@/components/app-shell";
import { SetupForm } from "@/components/setup-form";
import { activeRound, organization } from "@/lib/demo-data";

export default function SetupPage() {
  return (
    <div className="page">
      <PageIntro
        eyebrow="הגדרת סבב"
        title={`פתיחת מדידה עבור ${organization.name}`}
        description={`הסבב הנוכחי מוגדר עבור ${activeRound.period}. הנתונים כאן מוצגים כרקע לדשבורד ואינם מזהים משיבים.`}
        actions={
          <Link className="secondary-button" href="/survey">
            עריכת שאלון
            <ClipboardList size={18} aria-hidden="true" />
          </Link>
        }
      />

      <SetupForm />

      <div className="next-step-band">
        <span>לאחר שמירת הסבב ניתן להפיץ את הלינק האנונימי לצוות.</span>
        <Link href="/round">
          מעבר למעקב סבב
          <ArrowLeft size={16} aria-hidden="true" />
        </Link>
      </div>
    </div>
  );
}
