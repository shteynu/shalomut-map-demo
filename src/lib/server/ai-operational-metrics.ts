import type { AiAnalysisRun } from '../types/ai-analysis-run';

export type OperationalMetricName =
  | 'ai_jobs_queued'
  | 'ai_jobs_running'
  | 'ai_jobs_succeeded'
  | 'ai_jobs_failed'
  | 'ai_jobs_stalled'
  | 'ai_jobs_retry_count'
  | 'ai_job_queue_wait_ms'
  | 'ai_job_processing_duration_ms'
  | 'ai_job_callback_delivery_latency_ms'
  | 'ai_contract_validation_failures'
  | 'ai_partial_map_ratio_sample'
  | 'ai_deterministic_summary_ratio_sample'
  | 'ai_deterministic_metric_narrative_ratio_sample'
  | 'ai_question_suggestions_succeeded'
  | 'ai_question_suggestions_failed'
  | 'duplicate_submission_conflicts'
  | 'survey_submission_recovered_by_retry'
  | 'survey_submission_lost_after_retries';

export interface OperationalMetric {
  name: OperationalMetricName;
  value: number;
  unit: 'count' | 'milliseconds' | 'ratio_sample';
  labels?: Record<string, string>;
  runId?: string;
  roundId?: string;
}

type OperationalMetricSink = (metric: OperationalMetric) => void;

const defaultSink: OperationalMetricSink = (metric) => {
  console.info(
    JSON.stringify({
      observability: 'shalomut_operational_metric',
      ...metric,
    }),
  );
};

let metricSink: OperationalMetricSink = defaultSink;

/**
 * The durable receiver, installed by the composition root when there is a
 * database to write to.
 *
 * A second slot rather than a replacement of the one above, and the difference
 * matters twice. The console line is what a person tailing a local process or
 * a deployment's log reads, and it stays — the durable store answers "did this
 * start happening" and the line answers "what is happening right now". And the
 * slot above is a test seam: a test that installs one to watch what an action
 * recorded must not, by doing so, silence the durable write it is checking, nor
 * be silenced by any wiring a route it calls performs.
 */
let durableSink: OperationalMetricSink | null = null;

export function setOperationalMetricSinkForTests(
  sink: OperationalMetricSink | null,
) {
  metricSink = sink ?? defaultSink;
}

export function setDurableOperationalMetricSink(
  sink: OperationalMetricSink | null,
) {
  durableSink = sink;
}

function emit(metric: OperationalMetric) {
  metricSink(metric);
  if (!durableSink) return;
  /*
   * Observability may not break what it observes. Every caller of these
   * functions is in the middle of doing the product's actual work — queueing a
   * run, storing a response — and none of them is prepared for a counter to
   * throw. The sink itself schedules the write off the request path; this
   * catch is for whatever it fails to do before it gets there.
   */
  try {
    durableSink(metric);
  } catch (error) {
    console.error(
      'Recording an operational metric failed:',
      error instanceof Error ? error.message : 'unknown error',
    );
  }
}

function correlation(run: AiAnalysisRun) {
  return { runId: run.id, roundId: run.roundId };
}

export function recordAiJobQueued(run: AiAnalysisRun) {
  emit({
    name: 'ai_jobs_queued',
    value: 1,
    unit: 'count',
    labels: { trigger: run.trigger },
    ...correlation(run),
  });
}

/*
 * `ai_jobs_rearmed` was here, and it is gone rather than left silent.
 *
 * It counted a round whose automatic analysis had to be started again because
 * responses moved under the previous run, and its rate was the evidence for
 * whether a durable run needs to own an immutable input snapshot. Analysis now
 * follows a manager closing the round (owner decision 2026-08-17), and a closed
 * round refuses submissions, so the ordinary case it measured cannot happen and
 * there is no re-arm to count.
 *
 * The residual case can: `updateStatus` is an unconditional write outside any
 * transaction with the dispatch, so a submission that read `active` before the
 * status changed can still land after the aggregates were read. That is still
 * measured — `ai_jobs_failed{failureCode="round_validation_failed"}` is the same
 * signal from the other end — so the evidence moved rather than disappeared. A
 * counter that stayed in the union and never incremented would have read as
 * zero occurrences instead of no measurement.
 */

export function recordAiJobClaimed(run: AiAnalysisRun) {
  emit({
    name: 'ai_jobs_running',
    value: 1,
    unit: 'count',
    ...correlation(run),
  });
  if (run.attemptCount > 1) {
    emit({
      name: 'ai_jobs_stalled',
      value: 1,
      unit: 'count',
      ...correlation(run),
    });
    emit({
      name: 'ai_jobs_retry_count',
      value: run.attemptCount - 1,
      unit: 'count',
      ...correlation(run),
    });
  }
  if (run.startedAt) {
    emit({
      name: 'ai_job_queue_wait_ms',
      value: Math.max(0, run.startedAt.getTime() - run.queuedAt.getTime()),
      unit: 'milliseconds',
      ...correlation(run),
    });
  }
}

export function recordAiJobCompleted(run: AiAnalysisRun) {
  if (run.state !== 'succeeded' && run.state !== 'failed') return;
  emit({
    name: run.state === 'succeeded' ? 'ai_jobs_succeeded' : 'ai_jobs_failed',
    value: 1,
    unit: 'count',
    labels: run.failureCode ? { failureCode: run.failureCode } : undefined,
    ...correlation(run),
  });
  if (run.startedAt && run.completedAt) {
    emit({
      name: 'ai_job_processing_duration_ms',
      value: Math.max(0, run.completedAt.getTime() - run.startedAt.getTime()),
      unit: 'milliseconds',
      ...correlation(run),
    });
  }
  if (run.startedAt && run.callbackReceivedAt) {
    emit({
      name: 'ai_job_callback_delivery_latency_ms',
      value: Math.max(
        0,
        run.callbackReceivedAt.getTime() - run.startedAt.getTime(),
      ),
      unit: 'milliseconds',
      ...correlation(run),
    });
  }
}

export type ContractViolationCode =
  | 'partial_map'
  | 'round_identity'
  | 'contract_version'
  | 'privacy_state'
  | 'semantic_mismatch'
  | 'questionnaire_provenance'
  | 'invalid_payload';

export function classifyContractViolation(error: string): ContractViolationCode {
  const normalized = error.toLowerCase();
  if (
    normalized.includes('eight dimension') ||
    normalized.includes('all dimensions') ||
    normalized.includes('every dimension') ||
    normalized.includes('stone map must contain')
  ) {
    return 'partial_map';
  }
  if (normalized.includes('roundid') || normalized.includes('round identity')) {
    return 'round_identity';
  }
  if (normalized.includes('contract') && normalized.includes('version')) {
    return 'contract_version';
  }
  if (normalized.includes('privacy') || normalized.includes('locked')) {
    return 'privacy_state';
  }
  if (normalized.includes('score') || normalized.includes('status')) {
    return 'semantic_mismatch';
  }
  if (
    normalized.includes('question') ||
    normalized.includes('metric') ||
    normalized.includes('distribution') ||
    normalized.includes('snapshot')
  ) {
    return 'questionnaire_provenance';
  }
  return 'invalid_payload';
}

export function recordContractValidation(input: {
  contractVersion?: string;
  error: string;
  runId?: string;
  roundId: string;
}) {
  const violationCode = classifyContractViolation(input.error);
  emit({
    name: 'ai_contract_validation_failures',
    value: 1,
    unit: 'count',
    labels: {
      contractVersion: input.contractVersion ?? 'unknown',
      violationCode,
    },
    runId: input.runId,
    roundId: input.roundId,
  });
  emit({
    name: 'ai_partial_map_ratio_sample',
    value: violationCode === 'partial_map' ? 1 : 0,
    unit: 'ratio_sample',
    labels: { contractVersion: input.contractVersion ?? 'unknown' },
    runId: input.runId,
    roundId: input.roundId,
  });
}

export function recordValidMapSample(input: {
  contractVersion: string;
  runId?: string;
  roundId: string;
}) {
  emit({
    name: 'ai_partial_map_ratio_sample',
    value: 0,
    unit: 'ratio_sample',
    labels: { contractVersion: input.contractVersion },
    runId: input.runId,
    roundId: input.roundId,
  });
}

/**
 * How much of an accepted map the service wrote itself.
 *
 * Contract 6.0 never fails a dimension over a silent provider: it falls back
 * to copy derived from the aggregates and reports the round a success. That is
 * a deliberate product choice, but it leaves `ai_jobs_succeeded` unable to
 * distinguish a round the model wrote from one it never answered, and a
 * rate-limited key produces the second while looking like the first.
 */
export function recordDeterministicSummarySample(input: {
  contractVersion: string;
  outcomes: string[];
  runId?: string;
  roundId: string;
}) {
  if (input.outcomes.length === 0) return;
  const deterministic = input.outcomes.filter(
    (outcome) => outcome === 'deterministic_fallback',
  ).length;
  emit({
    name: 'ai_deterministic_summary_ratio_sample',
    value: deterministic / input.outcomes.length,
    unit: 'ratio_sample',
    labels: {
      contractVersion: input.contractVersion,
      dimensions: String(input.outcomes.length),
      deterministic: String(deterministic),
    },
    runId: input.runId,
    roundId: input.roundId,
  });
}

/**
 * The same reading for the metric narratives, which fall back on their own.
 *
 * Separate from the summary sample rather than folded into it, because the two
 * calls fail independently: a key that answers the short summary prompt and
 * times out on the longer narrative one produces a healthy summary ratio and
 * eight dimensions of derived sentences.
 *
 * A round that recorded no outcome emits nothing. Counting it as model-written
 * would make every round analysed before the field existed improve the ratio,
 * which is the one direction a provenance metric must never drift.
 */
export function recordDeterministicMetricNarrativeSample(input: {
  contractVersion: string;
  outcomes: (string | undefined)[];
  runId?: string;
  roundId: string;
}) {
  const recorded = input.outcomes.filter(
    (outcome): outcome is string => outcome !== undefined,
  );
  if (recorded.length === 0) return;
  const deterministic = recorded.filter(
    (outcome) => outcome === 'deterministic_fallback',
  ).length;
  emit({
    name: 'ai_deterministic_metric_narrative_ratio_sample',
    value: deterministic / recorded.length,
    unit: 'ratio_sample',
    labels: {
      contractVersion: input.contractVersion,
      dimensions: String(recorded.length),
      deterministic: String(deterministic),
    },
    runId: input.runId,
    roundId: input.roundId,
  });
}

/**
 * Whether the model answered the one request a manager waits on synchronously.
 *
 * This path had no observability at all until 2026-08-17, and the cost of that
 * was measured rather than imagined: the deployed suggestion button had been
 * answering `503` for an unknown length of time because the provider account's
 * prepayment was depleted, and establishing it took four hand-made requests and
 * a read of the AI service's own log on Render. Neither the route nor the
 * transport wrote a line, so Core held no trace of a feature being dead.
 *
 * Two names rather than one with an `outcome` label, following
 * `ai_jobs_succeeded` and `ai_jobs_failed`: the question asked of these counters
 * is a ratio between them, and a ratio is cheaper to read from two series than
 * from one series split by label.
 *
 * `reason` is the transport's own discriminator rather than a re-derived one, so
 * a provider that is refusing, timing out, unreachable or answering nonsense
 * stay four different readings. `upstreamStatus` is carried only when the
 * service answered with one — the difference between "the service said no" and
 * "the service was not there" is the first thing anyone debugging this needs.
 *
 * No dimension label, deliberately. A suggestion has no round to correlate to,
 * and which of the eight was asked for says nothing about whether the provider
 * is alive — it would add cardinality to every series to answer a question
 * nobody has asked.
 *
 * What this does not do is notice. It puts the failure where the product's other
 * counters land — since 2026-08-23 that is a durable table as well as a
 * `console.info` line. Whether anybody is told is the next commit's question.
 */
export function recordQuestionSuggestionOutcome(
  input:
    | { outcome: 'succeeded'; attempts: number }
    | { outcome: 'failed'; reason: string; upstreamStatus?: number },
) {
  if (input.outcome === 'succeeded') {
    emit({
      name: 'ai_question_suggestions_succeeded',
      value: 1,
      unit: 'count',
      labels: { attempts: String(input.attempts) },
    });
    return;
  }

  emit({
    name: 'ai_question_suggestions_failed',
    value: 1,
    unit: 'count',
    labels: {
      reason: input.reason,
      ...(input.upstreamStatus === undefined
        ? {}
        : { upstreamStatus: String(input.upstreamStatus) }),
    },
  });
}

/**
 * How a submission reached the server when it did not reach it the first time.
 *
 * The deployed endpoint loses the first submit after an idle period, and it
 * loses it *before* the function is invoked — the deployment's own logs hold no
 * entry for the request that died. So the server cannot count this failure by
 * observing itself; the only witness is the client that had to send twice.
 * `sendWithRetry` then repairs it silently, which is the right thing for the
 * respondent and leaves nobody able to say whether it happens once a pilot or
 * once an hour. This counter is that answer.
 *
 * Nothing is emitted for a submission delivered on the first attempt: those are
 * already counted, one stored response each, and a beacon on the happy path
 * would double the traffic of the product's most important action to learn a
 * number the database already holds.
 *
 * No `roundId`, deliberately. Correlating one would mean a repository lookup on
 * the report's own path, and the report exists precisely for the moments when
 * that lookup is the thing that is failing.
 */
export function recordSurveySubmissionDelivery(input: {
  outcome: 'recovered' | 'lost';
  attempts: number;
}) {
  emit({
    name:
      input.outcome === 'recovered'
        ? 'survey_submission_recovered_by_retry'
        : 'survey_submission_lost_after_retries',
    value: 1,
    unit: 'count',
    labels: { attempts: String(input.attempts) },
  });
}

export function recordDuplicateSubmissionConflict(roundId: string) {
  emit({
    name: 'duplicate_submission_conflicts',
    value: 1,
    unit: 'count',
    roundId,
  });
}
