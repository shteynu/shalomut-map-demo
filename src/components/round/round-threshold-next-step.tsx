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
};

type NextStepCopy = {
  title: string;
  body: string;
  icon: ReactNode;
  action?: "dashboard" | "refresh";
};

const openDashboardAction = getNavigationAction("openDashboard");

function getNextStepCopy({
  state,
  responseCount,
  minimumResponses,
}: RoundThresholdNextStepContentProps): NextStepCopy {
  if (state.status === "below-threshold") {
    const remaining = Math.max(minimumResponses - responseCount, 0);
    const remainingLabel =
      remaining === 1 ? "עוד תשובה אחת" : `עוד ${remaining} תשובות`;

    return {
      title: `${remainingLabel} עד סף הפרטיות`,
      body:
        "המפה נשארת נעולה כדי לשמור על אנונימיות הצוות. כשהסף יושג, הניתוח יתחיל אוטומטית.",
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
      title: "הניתוח התחיל אוטומטית",
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
      body: "הניתוח הסתיים. אין צורך לסגור את הסבב כדי לצפות בתוצאות המצרפיות.",
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
    return {
      title: "עדיין לא נוצר ניתוח",
      body: "סף הפרטיות הושג. הפעילו רענון ניתוח כדי ליצור את המפה מהתשובות שנשמרו.",
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
}: {
  roundId: string;
  responseCount: number;
  minimumResponses: number;
}) {
  const { state } = useAiInsights(roundId);

  return (
    <RoundThresholdNextStepContent
      state={state}
      responseCount={responseCount}
      minimumResponses={minimumResponses}
    />
  );
}

export function RoundThresholdNextStep({
  roundId,
  responseCount,
  minimumResponses,
}: {
  roundId: string;
  responseCount: number;
  minimumResponses: number;
}) {
  if (responseCount < minimumResponses) {
    return (
      <RoundThresholdNextStepContent
        state={{ status: "below-threshold" }}
        responseCount={responseCount}
        minimumResponses={minimumResponses}
      />
    );
  }

  return (
    <ThresholdReachedNextStep
      roundId={roundId}
      responseCount={responseCount}
      minimumResponses={minimumResponses}
    />
  );
}
