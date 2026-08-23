/**
 * The other half of the digest a manager reads off the error screen.
 *
 * `src/app/error.tsx` deliberately prints no message — in a development build
 * that string carries whatever the throw site put in it, which can be query
 * text or row contents — and offers the digest instead, so support can find the
 * same failure in the log. Until this file existed there was no such log entry
 * to find: the framework's own line goes wherever the runtime sends it, in a
 * shape nothing can search by digest, and the product had no error tracking of
 * any kind.
 *
 * So one structured line per failed request, in the same shape as
 * `ai-operational-metrics.ts`: a marker key first, so a future sink can select
 * both families with one filter and neither has to be reformatted when one
 * arrives.
 *
 * Deliberately no third party and no dependency. Wiring Sentry or an equivalent
 * means replacing the sink below and nothing else — which is the point of it
 * being a sink.
 *
 * Since 2026-08-23 there is a second sink beside the line: the composition root
 * points it at `operational_events`, so a digest a manager reads off the screen
 * can still be found next month rather than only for as long as a deployment
 * keeps its log. The line stays, and not out of caution — this family's worst
 * case is an error *caused by* the database, and then the durable copy is the
 * one write that cannot land.
 */

export interface RequestErrorRecord {
  observability: 'shalomut_request_error';
  /** The identifier the manager can read off the screen. */
  digest?: string;
  name: string;
  message: string;
  stack?: string;
  path?: string;
  method?: string;
  /** `render` or `route`, and which router — what Next.js knows about the throw. */
  routerKind?: string;
  routeType?: string;
  routePath?: string;
}

type RequestErrorSink = (record: RequestErrorRecord) => void;

const defaultSink: RequestErrorSink = (record) => {
  console.error(JSON.stringify(record));
};

let sink: RequestErrorSink = defaultSink;

/**
 * The durable receiver, installed by the composition root beside the metrics
 * one. The console line stays: this family's worst case is an error *caused by*
 * the database, and the row describing it is then the one write that cannot
 * land. That case is exactly why the line above is not replaced.
 */
let durableSink: RequestErrorSink | null = null;

export function setRequestErrorSinkForTests(next: RequestErrorSink | null) {
  sink = next ?? defaultSink;
}

export function setDurableRequestErrorSink(next: RequestErrorSink | null) {
  durableSink = next;
}

/**
 * What Next.js hands `onRequestError`, narrowed to what this file reads. The
 * framework's own types are not importable from a plain module, and pinning the
 * shape here keeps the instrumentation file to one line of logic.
 */
export interface RequestErrorContext {
  path?: string;
  method?: string;
  routerKind?: string;
  routeType?: string;
  routePath?: string;
}

/**
 * Builds the record without emitting it, which is what makes this testable:
 * everything interesting is the flattening of an unknown throw into fields, and
 * an unknown throw is exactly what a route handler produces.
 */
export function describeRequestError(
  error: unknown,
  context: RequestErrorContext = {},
): RequestErrorRecord {
  const isError = error instanceof Error;
  // Next.js attaches `digest` to the error object rather than to a type, so it
  // is read off the value and not asserted onto it.
  const digest = (error as { digest?: unknown } | null)?.digest;

  return {
    observability: 'shalomut_request_error',
    // The only field that ties this line to what the manager is looking at.
    digest: typeof digest === 'string' ? digest : undefined,
    name: isError ? error.name : typeof error,
    // A thrown string, a rejected object, `undefined` — a route handler can
    // produce any of them, and a report that only understands `Error` goes
    // blank exactly when something unusual happened.
    message: isError ? error.message : String(error),
    stack: isError ? error.stack : undefined,
    path: context.path,
    method: context.method,
    routerKind: context.routerKind,
    routeType: context.routeType,
    routePath: context.routePath,
  };
}

export function reportRequestError(
  error: unknown,
  context: RequestErrorContext = {},
): RequestErrorRecord {
  const record = describeRequestError(error, context);
  sink(record);
  if (durableSink) {
    // The report of a failure must not become a second failure. Whatever the
    // durable half cannot do, the line above has already done.
    try {
      durableSink(record);
    } catch {
      // Deliberately silent: the console line already carries this record, and
      // an error raised here would surface as a second `onRequestError`.
    }
  }
  return record;
}

/**
 * A failure a route handler caught itself.
 *
 * `onRequestError` only fires for what escapes a handler, so every one of these
 * `catch` blocks was invisible to the product's error tracking: the sole trace
 * was whatever the handler chose to put in the response body, which for a while
 * was the raw `error.message` — a database error, a Prisma constraint name or a
 * configuration string, crossing the API boundary to a browser (2026-08-21
 * audit). Taking that out of the body would have left nothing at all, so it
 * goes here instead, where the digest a manager reads and the caught failures
 * end up in the same place.
 *
 * `path` is parsed rather than taken, because `Request.url` is the only thing a
 * handler holds and a report that throws while describing a failure is worse
 * than one field missing.
 */
export function reportRouteFailure(error: unknown, request?: Request): void {
  let path: string | undefined;
  try {
    if (request) path = new URL(request.url).pathname;
  } catch {
    path = undefined;
  }

  reportRequestError(error, {
    path,
    method: request?.method,
    routerKind: 'App Router',
    routeType: 'route',
  });
}
