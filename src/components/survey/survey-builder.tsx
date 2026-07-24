"use client";

import Link from "next/link";
import { CheckCircle2, Eye } from "lucide-react";
import { useState } from "react";
import { PageIntro } from "@/components/ui/page-intro";
import { PrivacyTooltip } from "@/components/ui/privacy-tooltip";
import { useClipboard } from "@/lib/hooks/use-clipboard";
import { wellbeingDimensions } from "@/lib/demo-data";
import { getNavigationAction } from "@/lib/navigation";
import { useShareUrl } from "@/lib/use-share-url";
import type { SurveyDefinition } from "@/lib/types/backend";
import { SurveyBuilderQuestions } from "./survey-builder/survey-builder-questions";
import { SurveyBuilderSettings } from "./survey-builder/survey-builder-settings";
import { SurveyBuilderSidebar } from "./survey-builder/survey-builder-sidebar";
import type { BuilderQuestion } from "./survey-builder/types";

const questionBank: Omit<BuilderQuestion, "id">[] = [
  {
    text: "אני יודעת למי לפנות כשאני זקוקה לעזרה מקצועית או רגשית במהלך יום העבודה.",
    dimensionId: "management-support",
    required: true,
    enabled: true,
    answerMode: "סקאלת צבעים",
  },
  {
    text: "יש לי זמן מספק להתכונן למשימות חדשות שמגיעות במהלך השבוע.",
    dimensionId: "certainty",
    required: false,
    enabled: true,
    answerMode: "סקאלת צבעים",
  },
  {
    text: "בישיבות צוות יש מקום אמיתי לשתף רעיונות גם אם הם שונים מהקיים.",
    dimensionId: "self-expression",
    required: true,
    enabled: true,
    answerMode: "סקאלת צבעים",
  },
];

const builderFlowSteps = [
  {
    title: "הגדרות",
    helper: "שם, קהל יעד וסף פרטיות",
  },
  {
    title: "שאלות",
    helper: "8 ממדים ו-24 שאלות מקור",
  },
  {
    title: "הפצה",
    helper: "קישור אנונימי למשיבים",
  },
];

function createDraftId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 7)}`;
}

type SurveyBuilderProps = {
  organizationName: string;
  roundId: string;
  roundTitle: string;
  shareCode: string;
  initialDefinition: SurveyDefinition;
};

export function SurveyBuilder({
  organizationName,
  roundId,
  roundTitle,
  shareCode,
  initialDefinition,
}: SurveyBuilderProps) {
  const [title, setTitle] = useState(initialDefinition.title);
  const [audience, setAudience] = useState(initialDefinition.audience);
  const [estimatedMinutes, setEstimatedMinutes] = useState(
    initialDefinition.estimatedMinutes,
  );
  const [minimumResponses, setMinimumResponses] = useState(
    initialDefinition.minimumResponses,
  );
  const [introText, setIntroText] = useState(initialDefinition.introText);
  const [anonymityText, setAnonymityText] = useState(
    initialDefinition.anonymityText,
  );
  const [questions, setQuestions] = useState<BuilderQuestion[]>(
    initialDefinition.questions,
  );
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const { copied, copy } = useClipboard();
  const shareUrl = useShareUrl(shareCode);
  const openRespondentSurveyAction = getNavigationAction("openRespondentSurvey");
  const [bankCursor, setBankCursor] = useState(0);
  const [selectedDimensionId, setSelectedDimensionId] = useState(wellbeingDimensions[0]?.id ?? "all");

  const enabledQuestions = questions.filter((question) => question.enabled);
  const requiredQuestions = enabledQuestions.filter((question) => question.required);
  const activeDimensions = new Set(enabledQuestions.map((question) => question.dimensionId)).size;
  const nextSuggestedQuestion = questionBank[bankCursor % questionBank.length];
  const visibleQuestions =
    selectedDimensionId === "all"
      ? questions
      : questions.filter((question) => question.dimensionId === selectedDimensionId);

  const summaryStones = [
    {
      value: enabledQuestions.length,
      label: "שאלות פעילות",
      helper: `מתוכן ${requiredQuestions.length} שאלות חובה`,
      className: "stone-variant-navy",
    },
    {
      value: activeDimensions,
      label: "מרכיבי שלומות",
      helper: "פריסה על פני כל ממדי הדשבורד",
      className: "stone-variant-green",
    },
    {
      value: estimatedMinutes,
      label: "דקות למילוי",
      helper: "הערכת זמן להצגת הקישור לצוות",
      className: "stone-variant-orange",
    },
    {
      value: minimumResponses,
      label: "סף פרטיות",
      helper: "תוצאות ייפתחו רק לאחר מינימום משיבים",
      className: "stone-variant-teal",
    },
  ];

  function updateQuestion(id: string, updater: (question: BuilderQuestion) => BuilderQuestion) {
    setQuestions((current) => current.map((question) => (question.id === id ? updater(question) : question)));
  }

  function duplicateQuestion(id: string) {
    setQuestions((current) => {
      const index = current.findIndex((question) => question.id === id);
      const source = current[index];

      if (!source) {
        return current;
      }

      const duplicate = {
        ...source,
        id: createDraftId("duplicate"),
      };

      return [...current.slice(0, index + 1), duplicate, ...current.slice(index + 1)];
    });
  }

  function addQuestionFromBank() {
    const template = questionBank[bankCursor % questionBank.length];
    const nextQuestion: BuilderQuestion = {
      ...template,
      id: createDraftId("bank"),
    };

    setQuestions((current) => [...current, nextQuestion]);
    setBankCursor((current) => current + 1);
    setSelectedDimensionId(nextQuestion.dimensionId);
  }

  async function saveDefinition() {
    setSaving(true);
    setSaved(false);
    setSaveError(null);

    const response = await fetch(
      `/api/rounds/${encodeURIComponent(roundId)}/survey-definition`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          audience,
          estimatedMinutes,
          minimumResponses,
          introText,
          anonymityText,
          questions,
        }),
      },
    ).catch(() => null);

    if (!response?.ok) {
      const payload = response
        ? ((await response.json().catch(() => null)) as { error?: string } | null)
        : null;
      setSaveError(
        payload?.error ??
          "לא ניתן היה לשמור את טיוטת השאלון. נסו שוב.",
      );
      setSaving(false);
      return;
    }

    setSaved(true);
    setSaving(false);
  }

  return (
    <div className="page survey-builder-stone-page">
      <PageIntro
        eyebrow={`${organizationName}, ${roundTitle} | בניית שאלון`}
        title={title}
        description="מסך זה מאפשר עריכת שאלון לפני הפצה: קהל יעד, ניסוח פתיח, שאלות פעילות וקישור המשיבים החיצוני."
        actions={
          <>
            <button
              className="primary-button"
              type="button"
              onClick={saveDefinition}
              disabled={saving}
              data-round-id={roundId}
            >
              {saving ? "שומר..." : "שמירת טיוטה"}
              <CheckCircle2 size={18} aria-hidden="true" />
            </button>
            <Link className="secondary-button" href={shareUrl} target="_blank" rel="noreferrer">
              {openRespondentSurveyAction.label}
              <Eye size={18} aria-hidden="true" />
            </Link>
          </>
        }
      />

      {saveError ? (
        <p className="survey-submit-error" role="alert">
          {saveError}
        </p>
      ) : null}

      <section className="metric-grid survey-builder-metric-grid" aria-label="תקציר שאלון">
        {summaryStones.map((stone) => {
          const showTooltip = stone.label === "סף פרטיות" || stone.label === "סף הצגה";
          return (
            <article key={stone.label} className={`metric-card survey-builder-metric-stone ${stone.className}`}>
              <strong>{stone.value}</strong>
              <span>
                {stone.label}
                {showTooltip && (
                  <PrivacyTooltip minimumResponses={minimumResponses} />
                )}
              </span>
              <small>{stone.helper}</small>
            </article>
          );
        })}
      </section>

      <section className="survey-builder-flow" aria-label="רצף עבודה בשאלון">
        {builderFlowSteps.map((step, index) => (
          <article key={step.title} className="survey-builder-flow-step">
            <span>{String(index + 1).padStart(2, "0")}</span>
            <strong>{step.title}</strong>
            <small>{step.helper}</small>
          </article>
        ))}
      </section>

      <div className="survey-builder-layout">
        <div className="survey-builder-main">
          <SurveyBuilderSettings
            title={title}
            setTitle={setTitle}
            audience={audience}
            setAudience={setAudience}
            estimatedMinutes={estimatedMinutes}
            setEstimatedMinutes={setEstimatedMinutes}
            minimumResponses={minimumResponses}
            setMinimumResponses={setMinimumResponses}
            introText={introText}
            setIntroText={setIntroText}
            anonymityText={anonymityText}
            setAnonymityText={setAnonymityText}
          />

          <SurveyBuilderQuestions
            questions={questions}
            visibleQuestions={visibleQuestions}
            selectedDimensionId={selectedDimensionId}
            setSelectedDimensionId={setSelectedDimensionId}
            onUpdateQuestion={updateQuestion}
            onDuplicateQuestion={duplicateQuestion}
            onAddQuestionFromBank={addQuestionFromBank}
          />
        </div>

        <SurveyBuilderSidebar
          shareUrl={shareUrl}
          copied={copied}
          onCopyRespondentLink={() => copy(shareUrl)}
          nextSuggestedQuestion={nextSuggestedQuestion}
          onAddQuestionFromBank={addQuestionFromBank}
          saved={saved}
        />
      </div>
    </div>
  );
}
