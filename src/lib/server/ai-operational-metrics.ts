import type { AiAnalysisRun } from '../types/ai-analysis-run';

export type OperationalMetricName =
  | 'ai_jobs_queued'
  | 'ai_jobs_rearmed'
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
  | 'duplicate_submission_conflicts';

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

export function setOperationalMetricSinkForTests(
  sink: OperationalMetricSink | null,
) {
  metricSink = sink ?? defaultSink;
}

function emit(metric: OperationalMetric) {
  metricSink(metric);
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

/**
 * A round whose automatic analysis had to be started again because responses
 * moved under the previous run. The rate of this counter is the measurement
 * that says how often the round's input changes mid-analysis, so it is the
 * evidence for whether the durable run needs to own an immutable input
 * snapshot rather than refetching one.
 */
export function recordAiJobRearmed(
  run: AiAnalysisRun,
  input: { attempt: number; previousFailureCode: string },
) {
  emit({
    name: 'ai_jobs_rearmed',
    value: 1,
    unit: 'count',
    labels: {
      attempt: String(input.attempt),
      previousFailureCode: input.previousFailureCode,
    },
    ...correlation(run),
  });
}

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

export function recordDuplicateSubmissionConflict(roundId: string) {
  emit({
    name: 'duplicate_submission_conflicts',
    value: 1,
    unit: 'count',
    roundId,
  });
}
