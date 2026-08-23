import type {
  IOperationalEventRepository,
  OperationalEventTally,
} from '@/lib/repositories/interfaces';

import type { OperationalMetricName } from './ai-operational-metrics';

/**
 * What is worth waking someone for, out of eighteen counters.
 *
 * The audit of 2026-08-21 asked for a durable receiver *and* thresholds on
 * three or four counters, and the second half is the one that turns a store
 * into a warning. A dashboard nobody opens is the same failure as a log nobody
 * reads, so the verdict is delivered the way the queue's is: as an HTTP status
 * an ordinary uptime monitor already knows how to shout about.
 *
 * Four readings, three concerns, chosen with the owner on 2026-08-23:
 *
 * - **A submission that never arrived.** The only witness is the respondent's
 *   own client, which had to send twice; the server cannot see this failure by
 *   observing itself, because the request died before the function ran. One
 *   occurrence is the alert. There is no acceptable rate of losing a teacher's
 *   answers.
 * - **A paid model that stopped answering without saying so.** Read twice,
 *   because it shows up in two unrelated places and either can be the first.
 *   The suggestion button fails outright, which is a count; an analysis run
 *   succeeds while writing its own copy from the aggregates, which is a ratio
 *   and looks healthy in `ai_jobs_succeeded`. This exact failure has happened
 *   once already — a depleted prepayment — and establishing it took four
 *   hand-made requests and a read of Render's log.
 * - **A payload the contract rejected.** The service produced something Core
 *   would not accept. That is a defect either side of the boundary and its
 *   healthy rate is zero.
 *
 * Deliberately not here: `ai_jobs_failed`, which the owner and the queue
 * detector already cover between them, and every duration and every counter
 * whose interesting reading is a trend rather than a line.
 */
export interface ObservabilityThreshold {
  /** Stable, and published: it is what the alert names in a monitor's email. */
  id: string;
  metric: OperationalMetricName;
  /** `count` sums occurrences; `mean` averages the recorded value. */
  reading: 'count' | 'mean';
  windowMinutes: number;
  /** Breached at or above this. */
  limit: number;
  /** `mean` only: below this many samples the reading says nothing. */
  minimumSamples?: number;
  /** One sentence, for whoever arrives at the endpoint without the code. */
  says: string;
}

/** Six hours: long enough to still be alerting when someone reads the mail,
 *  short enough that a fixed problem clears itself without anyone acking it. */
export const OBSERVABILITY_COUNT_WINDOW_MINUTES = 360;

/** Twenty-four hours. Analysis runs are rare — a school closes a round every
 *  few weeks — so a six-hour window would usually hold no sample at all. */
export const OBSERVABILITY_RATIO_WINDOW_MINUTES = 1440;

export const OBSERVABILITY_THRESHOLDS: readonly ObservabilityThreshold[] = [
  {
    id: 'submission_lost',
    metric: 'survey_submission_lost_after_retries',
    reading: 'count',
    windowMinutes: OBSERVABILITY_COUNT_WINDOW_MINUTES,
    limit: 1,
    says: 'A respondent sent their answers and the server never stored them.',
  },
  {
    id: 'suggestions_failing',
    metric: 'ai_question_suggestions_failed',
    reading: 'count',
    windowMinutes: OBSERVABILITY_COUNT_WINDOW_MINUTES,
    limit: 3,
    says: 'The question suggestion button is failing repeatedly, which is what a dead provider account looks like from here.',
  },
  {
    id: 'analysis_written_without_the_model',
    metric: 'ai_deterministic_summary_ratio_sample',
    reading: 'mean',
    windowMinutes: OBSERVABILITY_RATIO_WINDOW_MINUTES,
    limit: 0.5,
    minimumSamples: 2,
    says: 'Analyses are succeeding while most of their copy is derived from the aggregates, so the provider is not answering.',
  },
  {
    id: 'contract_rejected',
    metric: 'ai_contract_validation_failures',
    reading: 'count',
    windowMinutes: OBSERVABILITY_COUNT_WINDOW_MINUTES,
    limit: 1,
    says: 'The AI service returned a payload the published contract refuses.',
  },
];

export type ObservabilityStatus = 'ok' | 'alerting';

export interface ThresholdReading {
  id: string;
  metric: OperationalMetricName;
  reading: 'count' | 'mean';
  windowMinutes: number;
  limit: number;
  /**
   * What the window actually held, or `null` when it held nothing measurable —
   * no events at all, or fewer samples than a mean needs. Null is not zero: one
   * of them means "this did not happen" and the other means "nothing was
   * measured", and a ratio cannot tell you which without saying so.
   */
  observed: number | null;
  samples: number;
  breached: boolean;
}

export interface ObservabilityAssessment {
  status: ObservabilityStatus;
  /** The breached thresholds, by id. Empty when the status is `ok`. */
  alerting: string[];
  readings: ThresholdReading[];
  observedAt: Date;
}

/**
 * One threshold against one window's tally. Pure, and separate from the read,
 * because every interesting case here is arithmetic: an empty window, a mean
 * with too few samples, a count sitting exactly on its limit.
 */
export function readThreshold(
  threshold: ObservabilityThreshold,
  tally: OperationalEventTally | undefined,
): ThresholdReading {
  const samples = tally?.count ?? 0;
  const base = {
    id: threshold.id,
    metric: threshold.metric,
    reading: threshold.reading,
    windowMinutes: threshold.windowMinutes,
    limit: threshold.limit,
    samples,
  };

  if (threshold.reading === 'count') {
    // A counter's absence really is zero occurrences: every one of these
    // metrics is emitted at the moment the bad thing happens and never
    // otherwise, so "no rows" is the healthy reading rather than a gap.
    return { ...base, observed: samples, breached: samples >= threshold.limit };
  }

  const minimumSamples = threshold.minimumSamples ?? 1;
  if (samples < minimumSamples) {
    // Too little to average. Reported as unmeasured rather than as healthy —
    // a ratio built from one round would swing between 0 and 1 on the round's
    // own luck, and alerting on that would train whoever reads these to ignore
    // them.
    return { ...base, observed: null, breached: false };
  }

  const mean = (tally?.sum ?? 0) / samples;
  return { ...base, observed: mean, breached: mean >= threshold.limit };
}

/**
 * Reads every threshold, in one query per distinct window.
 *
 * Grouped by window rather than one query per threshold because this runs on a
 * monitor's schedule forever, and the cost of the endpoint should not grow with
 * the number of things it watches.
 */
export async function assessObservability(
  operationalEventRepo: IOperationalEventRepository,
  options: {
    now?: Date;
    thresholds?: readonly ObservabilityThreshold[];
  } = {},
): Promise<ObservabilityAssessment> {
  const now = options.now ?? new Date();
  const thresholds = options.thresholds ?? OBSERVABILITY_THRESHOLDS;

  const byWindow = new Map<number, ObservabilityThreshold[]>();
  for (const threshold of thresholds) {
    const group = byWindow.get(threshold.windowMinutes) ?? [];
    group.push(threshold);
    byWindow.set(threshold.windowMinutes, group);
  }

  const tallies = new Map<string, OperationalEventTally>();
  for (const [windowMinutes, group] of byWindow) {
    const since = new Date(now.getTime() - windowMinutes * 60_000);
    const windowTallies = await operationalEventRepo.tally(
      group.map((threshold) => threshold.metric),
      since,
    );
    for (const threshold of group) {
      const tally = windowTallies.get(threshold.metric);
      if (tally) tallies.set(threshold.id, tally);
    }
  }

  const readings = thresholds.map((threshold) =>
    readThreshold(threshold, tallies.get(threshold.id)),
  );
  const alerting = readings
    .filter((reading) => reading.breached)
    .map((reading) => reading.id);

  return {
    status: alerting.length > 0 ? 'alerting' : 'ok',
    alerting,
    readings,
    observedAt: now,
  };
}
