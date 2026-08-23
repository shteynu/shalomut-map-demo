import { after } from 'next/server';

import type { IOperationalEventRepository } from '@/lib/repositories/interfaces';

import {
  setDurableOperationalMetricSink,
  type OperationalMetric,
} from './ai-operational-metrics';
import {
  setDurableRequestErrorSink,
  type RequestErrorRecord,
} from './request-error-report';

/**
 * Where the product's counters and caught errors actually go.
 *
 * Until 2026-08-23 the answer was a `console` line and nothing else. The audit
 * of 2026-08-21 put it plainly: every counter in this product was written to
 * catch a failure nobody watches — a submission lost before the function ran, a
 * paid provider that stopped answering, a payload the contract rejected — and
 * every one of them landed in a scrollback with no retention, no query and no
 * alert. A counter that cannot warn anyone is a counter that does not exist.
 *
 * This module is the wiring, not the policy. It knows how to get a record into
 * the durable store without letting that cost the request; what is worth
 * alerting on lives in `observability-alerts.ts`, and where the store is lives
 * in the composition root.
 */

/**
 * Runs the write after the response, and never in front of it.
 *
 * `after()` is what makes this safe on a serverless runtime: without it a
 * floating promise races the function being frozen the moment the response is
 * sent, and the row that describes a failure would be the row most likely to be
 * lost. Outside a request scope — a script, a test, the worker's own process —
 * `after()` throws, and there the plain promise is correct, because nothing is
 * about to freeze.
 */
export function scheduleObservabilityWrite(write: () => Promise<void>): void {
  const guarded = async () => {
    try {
      await write();
    } catch (error) {
      // The console line for this record has already been written. Saying why
      // the durable copy failed is the whole of what is left to do — and it
      // must be a log line rather than a throw, because a rejection here would
      // surface as a second, invented failure.
      console.error(
        'Recording an operational event failed:',
        error instanceof Error ? error.message : 'unknown error',
      );
    }
  };

  try {
    after(guarded);
  } catch {
    void guarded();
  }
}

function metricEvent(metric: OperationalMetric) {
  return {
    kind: 'metric' as const,
    name: metric.name,
    value: metric.value,
    unit: metric.unit,
    labels: metric.labels,
    runId: metric.runId,
    roundId: metric.roundId,
  };
}

/**
 * The error's own fields go to `detail` rather than to columns.
 *
 * Only `name` is promoted, because it is the one thing this family is ever
 * grouped by. The message and the stack are what a person reads once they have
 * found the row, and in a development build the message can carry query text or
 * row contents — which is why `src/app/error.tsx` shows a digest instead. They
 * are no more exposed here than in the `console.error` line that already
 * carried them, and one degree less: this table is reachable only by someone
 * with the database, and no endpoint in the product returns its contents.
 */
function requestErrorEvent(record: RequestErrorRecord) {
  return {
    kind: 'request_error' as const,
    name: record.name,
    detail: {
      digest: record.digest,
      message: record.message,
      stack: record.stack,
      path: record.path,
      method: record.method,
      routerKind: record.routerKind,
      routeType: record.routeType,
      routePath: record.routePath,
    },
  };
}

/**
 * Points both sinks at a store. Called by the composition root, which is the
 * only module that knows which store this deployment is really talking to.
 *
 * Idempotent and cheap: it installs two closures, so calling it on every
 * entrypoint invocation costs an assignment rather than a connection.
 */
export function installObservabilitySinks(
  operationalEventRepo: IOperationalEventRepository,
): void {
  setDurableOperationalMetricSink((metric) => {
    scheduleObservabilityWrite(() =>
      operationalEventRepo.record(metricEvent(metric)),
    );
  });
  setDurableRequestErrorSink((record) => {
    scheduleObservabilityWrite(() =>
      operationalEventRepo.record(requestErrorEvent(record)),
    );
  });
}

/** Removes both durable sinks, leaving the console lines. For tests. */
export function uninstallObservabilitySinks(): void {
  setDurableOperationalMetricSink(null);
  setDurableRequestErrorSink(null);
}
