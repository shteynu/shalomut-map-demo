import type { NextConfig } from "next";

/**
 * The application shipped with no security headers at all: no CSP, no
 * `frame-ancestors`, no `Referrer-Policy`, nothing. On a product whose manager
 * screens carry one-click destructive actions — close a round, reset an
 * analysis, archive — the missing one that matters most is framing: any page
 * anywhere could load these screens in an invisible iframe over its own
 * buttons, and a signed-in manager would click them.
 *
 * `frame-ancestors 'none'` is the answer to that, and `X-Frame-Options` says
 * the same thing to browsers old enough not to read the first.
 */

const isDevelopment = process.env.NODE_ENV === "development";

/**
 * `'unsafe-inline'` in `script-src` is not an oversight, and it should not be
 * removed without the rest of the change it needs.
 *
 * Next's App Router serves the RSC payload as inline `self.__next_f.push(...)`
 * script tags on every page. The only way to allow those and nothing else is a
 * per-request nonce, which Next reads from the request's CSP header and stamps
 * on its own scripts — and a per-request nonce makes every page dynamic, which
 * this build is not: `/login`, `/_not-found` and `/api-docs` are statically
 * rendered, and `/login` is the screen a manager meets first.
 *
 * So this policy does not claim to stop inline injection. What it does stop is
 * everything an injected string would want next: loading a script from another
 * origin, posting the session somewhere with `form-action`, rewriting relative
 * URLs with `base-uri`, embedding a plugin, or framing these screens. The app
 * renders no user-authored HTML — every string reaches the DOM through React —
 * so that is the shape of the real risk here.
 *
 * The follow-up, if this is ever worth tightening: middleware nonce plus
 * `strict-dynamic`, and `/login` made dynamic on purpose.
 */
function contentSecurityPolicy(): string {
  const directives = [
    "default-src 'self'",
    // Dev needs `eval` for hot reload and a websocket back to the dev server.
    // Neither is in the production policy, and this is why the header is built
    // rather than written out.
    `script-src 'self' 'unsafe-inline'${isDevelopment ? " 'unsafe-eval'" : ""}`,
    // Styles are inline in two ways that are not going anywhere: Next's own
    // injected style tags, and the `style={{ ... }}` props the survey and map
    // components use for geometry a class cannot know in advance.
    "style-src 'self' 'unsafe-inline'",
    // `next/font` self-hosts Noto Sans Hebrew at build time, so no font origin
    // is needed here — if a font ever fails to load, that is the line to read.
    "font-src 'self' data:",
    "img-src 'self' data: blob:",
    `connect-src 'self'${isDevelopment ? " ws: wss:" : ""}`,
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-src 'none'",
    "frame-ancestors 'none'",
  ];

  return directives.join("; ");
}

/**
 * `/api-docs` loads Swagger UI from unpkg at runtime
 * (`src/app/api-docs/page.tsx`), so the policy above would leave it blank.
 *
 * It gets its own header rather than unpkg being added to every route's: the
 * developer-facing documentation screen is the only place in the product that
 * runs someone else's code, and letting that fact widen the policy over the
 * manager screens would be the wrong trade. Self-hosting `swagger-ui-dist`
 * would remove the exception entirely, and is the better fix whenever the
 * screen is worth the dependency.
 */
function apiDocsContentSecurityPolicy(): string {
  return contentSecurityPolicy()
    .replace("script-src 'self'", "script-src 'self' https://unpkg.com")
    .replace("style-src 'self'", "style-src 'self' https://unpkg.com")
    .replace("font-src 'self'", "font-src 'self' https://unpkg.com");
}

const sharedSecurityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  // The share link a school hands out is a capability: whoever holds it can
  // answer the round. `strict-origin-when-cross-origin` keeps the path out of
  // the `Referer` of anything a respondent clicks through to.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  },
  // Two years, subdomains included, and deliberately not `preload`: preloading
  // is a one-way door on a domain that is still an operational staging alias.
  // Browsers ignore this header over plain HTTP, so local development is
  // unaffected.
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains",
  },
];

const nextConfig: NextConfig = {
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
  turbopack: {
    root: process.cwd(),
  },
  async headers() {
    return [
      {
        source: "/api-docs/:path*",
        headers: [
          ...sharedSecurityHeaders,
          {
            key: "Content-Security-Policy",
            value: apiDocsContentSecurityPolicy(),
          },
        ],
      },
      {
        /*
         * Everything except `/api-docs`, and the exclusion has to be here
         * rather than left to rule order. Two matching entries do not merge
         * into the stricter policy: the later one replaces the earlier one's
         * `Content-Security-Policy` outright, so a plain `/:path*` below
         * silently undid the exception above — checked with `curl -I`, which
         * showed one header carrying the strict policy on `/api-docs/`.
         */
        source: "/:path((?!api-docs).*)",
        headers: [
          ...sharedSecurityHeaders,
          { key: "Content-Security-Policy", value: contentSecurityPolicy() },
        ],
      },
    ];
  },
};

export default nextConfig;
