import {
  reportRequestError,
  type RequestErrorContext,
} from '@/lib/server/request-error-report';

/**
 * Next.js calls this for every server-side error it catches — a route handler
 * that throws, a server component that fails to render — with the same error
 * object whose digest the manager sees on `src/app/error.tsx`.
 *
 * It is the whole of this product's error tracking, and one line of it, because
 * the shape and the decisions live in `request-error-report.ts`. This file
 * exists only so the framework has something to call.
 */
export function onRequestError(
  error: unknown,
  request: { path?: string; method?: string },
  context: RequestErrorContext,
) {
  reportRequestError(error, {
    path: request?.path,
    method: request?.method,
    routerKind: context?.routerKind,
    routeType: context?.routeType,
    routePath: context?.routePath,
  });
}
