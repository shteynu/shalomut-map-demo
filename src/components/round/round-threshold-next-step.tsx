"use client";

import Link from "next/link";
import {
  AlertTriangle,
  CircleCheckBig,
  LoaderCircle,
  LockKeyhole,
  Sparkles,
} from "lucide-react";
import type { ReactNode } from "react";
import type { AiInsightsUiState } from "@/lib/hooks/use-ai-insights";
import { useAiInsights } from "@/lib/hooks/use-ai-insights";
import { getNavigationAction } from "@/lib/navigation";

export type RoundThresholdNextStepState =
  | { status: "below-threshold" }
  | AiInsightsUiState;

type RoundThresholdNextStepContentProps = {
  state: RoundThresholdNextStepState;
  responseCount: number;
  minimumResponses: number;
  /**
   * The round this band is about. The map link carries it, or the manager
   * reading an earlier round would be sent to the map of the newest one.
   */
  roundId?: string;
  /**
   * Whether the round is still collecting.
   *
   * Since analysis follows closing rather than submitting (owner decision
   * 2026-08-17), "no analysis yet" means two opposite things. On an open round
   * it is the ordinary state and the next step is to close; on a closed one it
   * is an anomaly and the next step is to run the analysis by hand. Reusing one
   * message for both would either alarm a manager whose round is simply still
   * open, or hide a round that closed and never got its map.
   */
  isCollecting?: boolean;
};

type NextStepCopy = {
  title: string;
  body: string;
  icon: ReactNode;
  action?: "dashboard" | "refresh";
};

function getNextStepCopy({
  state,
  responseCount,
  minimumResponses,
  isCollecting = true,
}: RoundThresholdNextStepContentProps): NextStepCopy {
  if (state.status === "below-threshold") {
    const remaining = Math.max(minimumResponses - responseCount, 0);
    const remainingLabel =
      remaining === 1 ? "עוד תשובה אחת" : `עוד ${remaining} תשובות`;

    return {
      title: `${remainingLabel} עד סף הפרטיות`,
      body:
        "המפה נשארת נעולה כדי לשמור על אנונימיות הצוות. הניתוח יופעל בסגירת הסבב, על כל התשובות שיתקבלו עד אז.",
      icon: <LockKeyhole size={24} aria-hidden="true" />,
    };
  }

  if (state.status === "loading") {
    return {
      title: "סף הפרטיות הושג",
      body: "בודקים את מצב הניתוח שנוצר עבור התשובות שנאספו.",
      icon: (
        <LoaderCircle
          className="round-next-step-spinner"
          size={24}
          aria-hidden="true"
        />
      ),
    };
  }

  if (state.status === "running") {
    return {
      title: "הניתוח החל",
      body: "התשובות נשמרו והתוצאות יופיעו במפה בתוך דקות ספורות.",
      icon: (
        <LoaderCircle
          className="round-next-step-spinner"
          size={24}
          aria-hidden="true"
        />
      ),
      action: "dashboard",
    };
  }

  if (state.status === "ready") {
    return {
      title: "המפה מוכנה",
      body: "הניתוח הסתיים. התוצאות המצרפיות מוכנות לצפייה.",
      icon: <CircleCheckBig size={24} aria-hidden="true" />,
      action: "dashboard",
    };
  }

  if (state.status === "locked") {
    return {
      title: "הניתוח עדיין נעול",
      body:
        "מספר המשיבים הגיע לסף, אבל לפחות שאלה אחת עדיין לא קיבלה מספיק תשובות. המפה נשארת נעולה עד שכל השאלות המנותחות יעמדו בסף.",
      icon: <LockKeyhole size={24} aria-hidden="true" />,
    };
  }

  if (state.status === "not-found") {
    // An open round with no analysis is where every round is until it closes,
    // and telling a manager to press a recovery button here would make the
    // ordinary case look like a fault.
    if (isCollecting) {
      return {
        title: "הסבב אוסף תשובות",
        body: "סף הפרטיות הושג. הניתוח יופעל בסגירת הסבב, על כל התשובות שיתקבלו עד אז.",
        icon: <Sparkles size={24} aria-hidden="true" />,
      };
    }

    return {
      title: "עדיין לא נוצר ניתוח",
      body: "הסבב נסגר אך המפה לא נוצרה. הפעילו רענון ניתוח כדי ליצור אותה מהתשובות שנשמרו.",
      icon: <Sparkles size={24} aria-hidden="true" />,
      action: "refresh",
    };
  }

  return {
    title: "לא ניתן היה להשלים את הניתוח",
    body: "התשובות שנאספו נשמרו. אפשר להפעיל רענון ניתוח ולנסות שוב מאוחר יותר.",
    icon: <AlertTriangle size={24} aria-hidden="true" />,
    action: "refresh",
  };
}

export function RoundThresholdNextStepContent(
  props: RoundThresholdNextStepContentProps,
) {
  const copy = getNextStepCopy(props);
  const openDashboardAction = getNavigationAction("openDashboard", props.roundId);

  return (
    <section
      className={`next-step-band round-next-step-band round-next-step-${props.state.status}`}
      aria-labelledby="round-analysis-next-step-title"
      aria-live="polite"
    >
      <div className="round-next-step-copy">
        <span className="round-next-step-icon">{copy.icon}</span>
        <div>
          <h2 id="round-analysis-next-step-title">{copy.title}</h2>
          <p>{copy.body}</p>
        </div>
      </div>

      {copy.action === "dashboard" ? (
        <Link href={openDashboardAction.href}>{openDashboardAction.label}</Link>
      ) : null}
      {copy.action === "refresh" ? (
        <a href="#refresh-round-analysis">רענון ניתוח</a>
      ) : null}
    </section>
  );
}

function ThresholdReachedNextStep({
  roundId,
  responseCount,
  minimumResponses,
  isCollecting,
}: {
  roundId: string;
  responseCount: number;
  minimumResponses: number;
  isCollecting: boolean;
}) {
  const { state } = useAiInsights(roundId);

  return (
    <RoundThresholdNextStepContent
      state={state}
      responseCount={responseCount}
      minimumResponses={minimumResponses}
      roundId={roundId}
      isCollecting={isCollecting}
    />
  );
}

export function RoundThresholdNextStep({
  roundId,
  responseCount,
  minimumResponses,
  isCollecting,
}: {
  roundId: string;
  responseCount: number;
  minimumResponses: number;
  isCollecting: boolean;
}) {
  if (responseCount < minimumResponses) {
    return (
      <RoundThresholdNextStepContent
        state={{ status: "below-threshold" }}
        responseCount={responseCount}
        minimumResponses={minimumResponses}
        roundId={roundId}
        isCollecting={isCollecting}
      />
    );
  }

  return (
    <ThresholdReachedNextStep
      roundId={roundId}
      responseCount={responseCount}
      minimumResponses={minimumResponses}
      isCollecting={isCollecting}
    />
  );
}
