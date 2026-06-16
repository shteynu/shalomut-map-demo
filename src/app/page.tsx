import Link from "next/link";
import { ArrowLeft, ClipboardList, LockKeyhole, Map, Send, Settings2 } from "lucide-react";
import { MetricCard, PageIntro } from "@/components/app-shell";
import { activeRound, getStatusCount, organization } from "@/lib/demo-data";

const steps = [
  {
    href: "/setup",
    title: "הגדרת סבב מדידה",
    body: "פתיחת רבעון, הזנת נתוני רקע וקביעת סף פרטיות להצגת תוצאות.",
    icon: Settings2,
  },
  {
    href: "/round",
    title: "הפצת לינק אנונימי",
    body: "מעקב אחרי מספר התשובות בלבד, בלי שמות ובלי זיהוי אישי.",
    icon: Send,
  },
  {
    href: "/survey",
    title: "מילוי שאלון לדוגמה",
    body: "חוויה קצרה במובייל עם בחירת צבע לכל היגד.",
    icon: ClipboardList,
  },
  {
    href: "/dashboard",
    title: "צפייה במפת השלומות",
    body: "אבחון צבעוני, פירוט מילולי והמלצות לשיחה ניהולית.",
    icon: Map,
  },
];

export default function HomePage() {
  const responsePercent = Math.round((activeRound.responseCount / activeRound.expectedResponses) * 100);

  return (
    <div className="page">
      <PageIntro
        eyebrow={`${organization.name}, ${activeRound.period}`}
        title={`שלום ${organization.managerName}, תמונת הסבב מוכנה`}
        description="מרכז הניהול מציג את מסלול הפיילוט מקצה לקצה: פתיחת סבב, שאלון אנונימי, מעקב מצרפי ודשבורד שלומות."
        actions={
          <>
            <Link className="primary-button" href="/setup">
              התחלת סבב
              <ArrowLeft size={18} aria-hidden="true" />
            </Link>
            <Link className="secondary-button" href="/dashboard">
              פתיחת המפה
              <Map size={18} aria-hidden="true" />
            </Link>
          </>
        }
      />

      <section className="metric-grid" aria-label="מדדי סבב">
        <MetricCard value={`${activeRound.responseCount}/${activeRound.expectedResponses}`} label="השיבו עד כה" helper={`${responsePercent}% מצוות בית הספר`} />
        <MetricCard value={`${activeRound.minimumResponses}`} label="סף פרטיות" helper="מינימום תשובות לפני הצגת תוצאות" />
        <MetricCard value={`${getStatusCount("red")}`} label="מוקדי טיפול" helper="אבנים אדומות במפה" />
        <MetricCard value={`${getStatusCount("green")}`} label="חוזקות לשימור" helper="אבנים ירוקות במפה" />
      </section>

      <section className="workflow-grid" aria-label="זרימת הדמו">
        {steps.map((step) => {
          const Icon = step.icon;
          return (
            <Link key={step.href} className="workflow-card" href={step.href}>
              <span className="workflow-icon" aria-hidden="true">
                <Icon size={22} />
              </span>
              <strong>{step.title}</strong>
              <span>{step.body}</span>
              <small>
                מעבר למסך
                <ArrowLeft size={14} aria-hidden="true" />
              </small>
            </Link>
          );
        })}
      </section>

      <section className="privacy-band">
        <LockKeyhole size={24} aria-hidden="true" />
        <div>
          <h2>פרטיות כברירת מחדל</h2>
          <p>המערכת מציגה רק נתונים מצרפיים. מנהלת בית הספר רואה כמה ענו, לא מי ענה.</p>
        </div>
      </section>
    </div>
  );
}
