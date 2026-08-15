"use client";

import { Check, Frown, Meh, Smile, type LucideIcon } from "lucide-react";
import { responseScale } from "@/lib/shalomut-source";
import { getAnswerScale } from "@/lib/survey/answer-scales";
import { allocationTotal, type SurveyStep } from "@/lib/survey/survey-steps";
import type {
  AnalyticSurveyQuestion,
  BackgroundSurveyQuestion,
} from "@/lib/types/backend";

/**
 * How a respondent gives one answer.
 *
 * Four widgets, chosen by the question rather than by the screen, because the
 * screen used to choose for everyone: it rendered three colour stones for every
 * question in the questionnaire. That was correct while every question was
 * analytic and every analytic question answered on the colour scale, and it
 * became wrong twice over — a manager can set a question's scale in the builder
 * since phase 4, and a background question has no scale at all.
 *
 * The colour stones are kept exactly as they were, for exactly the scale they
 * were built for. They are not a general radio group with pictures: their three
 * faces and their `100/60/0` spacing say something specific about a wellbeing
 * answer, and stretching them over a seven-point frequency scale would be
 * inventing anchors the instrument does not have.
 */

const colourIcons: Record<string, LucideIcon> = {
  green: Smile,
  yellow: Meh,
  red: Frown,
};

type AnswerInputProps = {
  step: SurveyStep;
  answers: Readonly<Record<string, string>>;
  /** `undefined` clears the answer, which is how an optional question is unset. */
  onAnswer: (questionId: string, value: string | undefined) => void;
  /** One-tap widgets advance on their own; typed ones must not. */
  onAdvance: () => void;
};

export function SurveyAnswerInput({
  step,
  answers,
  onAnswer,
  onAdvance,
}: AnswerInputProps) {
  if (step.kind === "allocation") {
    return (
      <AllocationGrid step={step} answers={answers} onAnswer={onAnswer} />
    );
  }

  const question = step.question;

  if (question.kind === "analytic") {
    return question.scaleId === "wellbeing-colour" ? (
      <ColourStones
        question={question}
        value={answers[question.id]}
        onAnswer={onAnswer}
        onAdvance={onAdvance}
      />
    ) : (
      <ScaleChoices
        question={question}
        value={answers[question.id]}
        onAnswer={onAnswer}
        onAdvance={onAdvance}
      />
    );
  }

  if (question.answerMode === "single-choice") {
    return (
      <OptionChoices
        question={question}
        value={answers[question.id]}
        onAnswer={onAnswer}
        onAdvance={onAdvance}
      />
    );
  }

  return <NumberField question={question} value={answers[question.id]} onAnswer={onAnswer} />;
}

function ColourStones({
  question,
  value,
  onAnswer,
  onAdvance,
}: {
  question: AnalyticSurveyQuestion;
  value: string | undefined;
  onAnswer: AnswerInputProps["onAnswer"];
  onAdvance: () => void;
}) {
  // Read from `responseScale` rather than from the scale registry, because a
  // colour stone shows a second line the registry does not carry — «המצב סביר»
  // under «בסדר». The registry holds what a scale is worth, not how this one
  // reads on a stone.
  return (
    <div className="survey-answer-stones">
      {responseScale.map((option) => {
        const Icon = colourIcons[option.value];
        const selected = value === option.value;

        return (
          <button
            key={option.value}
            className={`answer-stone answer-stone-${option.value}`}
            type="button"
            aria-pressed={selected}
            onClick={() => {
              onAnswer(question.id, option.value);
              onAdvance();
            }}
          >
            {Icon ? <Icon size={30} aria-hidden="true" /> : null}
            <strong>{option.title}</strong>
            <span>{option.text}</span>
            {selected ? (
              <Check className="answer-stone-check" size={18} aria-hidden="true" />
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

/**
 * A scale with more than three steps, as a list of its own anchors.
 *
 * Radio semantics rather than a row of buttons: five or seven options is a
 * single choice from a set, and a screen reader should say "3 of 7" rather than
 * read seven separate toggles. The number is shown beside the anchor because
 * the instrument's own blocks are numbered and a respondent comparing two items
 * reads the number faster than the sentence.
 */
function ScaleChoices({
  question,
  value,
  onAnswer,
  onAdvance,
}: {
  question: AnalyticSurveyQuestion;
  value: string | undefined;
  onAnswer: AnswerInputProps["onAnswer"];
  onAdvance: () => void;
}) {
  const scale = getAnswerScale(question.scaleId);

  return (
    <div className="survey-choice-list" role="radiogroup" aria-label={question.text}>
      {scale.points.map((point) => (
        <ChoiceRow
          key={point.value}
          name={question.id}
          value={point.value}
          label={point.label}
          ordinal={point.value}
          checked={value === point.value}
          onSelect={() => {
            onAnswer(question.id, point.value);
            onAdvance();
          }}
        />
      ))}
    </div>
  );
}

/**
 * A background question's own options.
 *
 * Optional by default, so it carries a way out. Without one, a teacher who does
 * not want to state their age band has to answer something untrue or abandon
 * the questionnaire — and the second is what a demographic block costs a round
 * if it has no exit.
 */
function OptionChoices({
  question,
  value,
  onAnswer,
  onAdvance,
}: {
  question: BackgroundSurveyQuestion;
  value: string | undefined;
  onAnswer: AnswerInputProps["onAnswer"];
  onAdvance: () => void;
}) {
  return (
    <div className="survey-choice-list" role="radiogroup" aria-label={question.text}>
      {(question.options ?? []).map((option) => (
        <ChoiceRow
          key={option.value}
          name={question.id}
          value={option.value}
          label={option.label}
          checked={value === option.value}
          onSelect={() => {
            onAnswer(question.id, option.value);
            onAdvance();
          }}
        />
      ))}

      {!question.required ? (
        <button
          className="link-button survey-skip-answer"
          type="button"
          onClick={() => {
            onAnswer(question.id, undefined);
            onAdvance();
          }}
        >
          {value ? "ביטול הבחירה ומעבר הלאה" : "מעדיף/ה לא לענות"}
        </button>
      ) : null}
    </div>
  );
}

function ChoiceRow({
  name,
  value,
  label,
  ordinal,
  checked,
  onSelect,
}: {
  name: string;
  value: string;
  label: string;
  ordinal?: string;
  checked: boolean;
  onSelect: () => void;
}) {
  return (
    <label className={`survey-choice${checked ? " is-selected" : ""}`}>
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={onSelect}
      />
      {ordinal ? (
        <span className="survey-choice-ordinal" aria-hidden="true">
          {ordinal}
        </span>
      ) : null}
      <span className="survey-choice-label">{label}</span>
    </label>
  );
}

/**
 * A plain amount, with no ceiling.
 *
 * The one question that uses it — average daily hours — has no upper bound this
 * layer could defend without inventing one, and the submit route agrees: it
 * accepts any non-negative number. `inputMode="decimal"` is what gets a phone
 * to show digits; `type="number"` alone does not, on every keyboard.
 */
function NumberField({
  question,
  value,
  onAnswer,
}: {
  question: BackgroundSurveyQuestion;
  value: string | undefined;
  onAnswer: AnswerInputProps["onAnswer"];
}) {
  return (
    <div className="survey-number-field">
      {/*
        No visible label: the card's own heading already states the question,
        and a second copy under it would be the same sentence twice. The input
        still needs a name, so it carries the question text as one.
      */}
      <input
        aria-label={question.text}
        id={`answer-${question.id}`}
        type="number"
        inputMode="decimal"
        min={0}
        step="any"
        value={value ?? ""}
        onChange={(event) => {
          const next = event.currentTarget.value;
          onAnswer(question.id, next.trim() === "" ? undefined : next);
        }}
      />
      {!question.required ? (
        <p className="quiet-note">אפשר להשאיר ריק.</p>
      ) : null}
    </div>
  );
}

/**
 * Thirteen rows that must total 100.
 *
 * One screen, because the constraint is the point: a respondent splitting their
 * week between teaching, marking and meetings is comparing the rows against
 * each other, and a running total they cannot see is a total they cannot reach.
 * The refusal is stated as the distance from 100 rather than as an error — "יש
 * להוסיף 12" is an instruction, "הסכום חייב להיות 100" is a complaint.
 */
function AllocationGrid({
  step,
  answers,
  onAnswer,
}: {
  step: Extract<SurveyStep, { kind: "allocation" }>;
  answers: Readonly<Record<string, string>>;
  onAnswer: AnswerInputProps["onAnswer"];
}) {
  const total = allocationTotal(step.questions, answers);
  const touched = step.questions.some(
    (question) => (answers[question.id] ?? "").trim() !== "",
  );
  const remaining = 100 - total;

  return (
    <div className="survey-allocation">
      <ul className="survey-allocation-rows">
        {step.questions.map((question) => (
          <li key={question.id} className="survey-allocation-row">
            <label htmlFor={`answer-${question.id}`}>{question.text}</label>
            <input
              id={`answer-${question.id}`}
              type="number"
              inputMode="numeric"
              min={0}
              max={100}
              step={1}
              value={answers[question.id] ?? ""}
              onChange={(event) => {
                const next = event.currentTarget.value;
                onAnswer(question.id, next.trim() === "" ? undefined : next);
              }}
            />
            <span aria-hidden="true">%</span>
          </li>
        ))}
      </ul>

      <p
        className={`survey-allocation-total${
          touched && remaining !== 0 ? " is-unbalanced" : ""
        }`}
        role="status"
      >
        <strong>{total}%</strong>
        {!touched ? (
          <span>הסכום של כל השורות צריך להיות 100. אפשר גם לדלג על החלק הזה.</span>
        ) : remaining > 0 ? (
          <span>נותרו {remaining} אחוזים לחלוקה.</span>
        ) : remaining < 0 ? (
          <span>יש להפחית {Math.abs(remaining)} אחוזים.</span>
        ) : (
          <span>הסכום מלא.</span>
        )}
      </p>
    </div>
  );
}
