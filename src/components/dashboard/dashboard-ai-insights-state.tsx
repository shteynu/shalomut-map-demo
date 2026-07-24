import {
  AlertTriangle,
  LoaderCircle,
  LockKeyhole,
  Sparkles,
} from "lucide-react";
import type { AiInsightsUiState } from "@/lib/hooks/use-ai-insights";

export function DashboardAiInsightsState({
  state,
  onRetry,
}: {
  state: Exclude<AiInsightsUiState, { status: "ready" }>;
  onRetry: () => void;
}) {
  if (state.status === "loading") {
    return (
      <section className="dashboard-ai-state" aria-live="polite">
        <LoaderCircle className="dashboard-ai-state-spinner" size={30} aria-hidden="true" />
        <h2>טוענים את ניתוח השלומות</h2>
        <p>אנחנו מאמתים את מפת האבנים שנוצרה עבור סבב האבחון.</p>
      </section>
    );
  }

  if (state.status === "locked") {
    return (
      <section className="dashboard-ai-state" aria-live="polite">
        <LockKeyhole size={30} aria-hidden="true" />
        <h2>הניתוח עדיין נעול</h2>
        <p>
          טרם נאספו מספיק תשובות להצגת תובנות מצרפיות בלי לפגוע באנונימיות הצוות.
        </p>
      </section>
    );
  }

  if (state.status === "not-found") {
    return (
      <section className="dashboard-ai-state" aria-live="polite">
        <Sparkles size={30} aria-hidden="true" />
        <h2>הניתוח עדיין לא נוצר</h2>
        <p>לא נמצאה מפת תובנות עבור הסבב הזה. אפשר לבדוק שוב לאחר סיום העיבוד.</p>
        <button type="button" className="secondary-button" onClick={onRetry}>
          בדיקה חוזרת
        </button>
      </section>
    );
  }

  return (
    <section className="dashboard-ai-state" role="alert">
      <AlertTriangle size={30} aria-hidden="true" />
      <h2>לא הצלחנו לטעון את הניתוח</h2>
      <p>הנתונים לא יוצגו עד שהתגובה משירות הניתוח תהיה תקינה ומאומתת.</p>
      <button type="button" className="secondary-button" onClick={onRetry}>
        ניסיון נוסף
      </button>
    </section>
  );
}
