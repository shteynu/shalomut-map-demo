'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, BookOpen, FileText } from 'lucide-react';

/**
 * Swagger UI is the only third-party code this application executes at
 * runtime, and it runs inside the manager's authenticated origin.
 *
 * The version was pinned from the start; the bytes were not. Until 2026-08-22
 * whatever unpkg answered with was executed — so a compromised CDN response,
 * or anything able to answer for one, could have made same-origin calls to
 * every destructive API on this deployment using the reader's own session.
 *
 * `integrity` is what closes that: the browser hashes what it received and
 * refuses to run it unless the hash matches. `crossOrigin` is not optional
 * beside it — without it a cross-origin response is opaque, the browser cannot
 * hash what it cannot read, and the subresource is blocked rather than checked.
 *
 * The digests are of the files in `swagger-ui-dist@5.11.0` as published to the
 * npm registry, which is what unpkg serves. Recompute them from the registry
 * tarball rather than from the CDN when the version moves — taking the hash
 * from the same place the risk comes from proves nothing:
 *
 *   npm pack swagger-ui-dist@<version>
 *   openssl dgst -sha384 -binary <file> | openssl base64 -A
 */
const SWAGGER_UI_VERSION = '5.11.0';
const SWAGGER_UI_INTEGRITY = {
  script:
    'sha384-qn5tagrAjZi8cSmvZ+k3zk4+eDEEUcP9myuR2J6V+/H6rne++v6ChO7EeHAEzqxQ',
  stylesheet:
    'sha384-+yyzNgM3K92sROwsXxYCxaiLWxWJ0G+v/9A+qIZ2rgefKgkdcmJI+L601cqPD/Ut',
} as const;

export default function ApiDocsPage() {
  useEffect(() => {
    // Dynamically inject Swagger UI CSS and JS
    const cssId = 'swagger-ui-css';
    if (!document.getElementById(cssId)) {
      const link = document.createElement('link');
      link.id = cssId;
      link.rel = 'stylesheet';
      link.href = `https://unpkg.com/swagger-ui-dist@${SWAGGER_UI_VERSION}/swagger-ui.css`;
      link.integrity = SWAGGER_UI_INTEGRITY.stylesheet;
      link.crossOrigin = 'anonymous';
      document.head.appendChild(link);
    }

    const scriptId = 'swagger-ui-js';
    const initSwagger = () => {
      const openapiUrl =
        typeof window !== 'undefined' && window.location.pathname.includes('/shalomut-map-demo')
          ? '/shalomut-map-demo/openapi.json'
          : '/openapi.json';

      // @ts-expect-error SwaggerUIBundle is loaded globally from CDN
      if (window.SwaggerUIBundle) {
        // @ts-expect-error SwaggerUIBundle is loaded globally from CDN
        window.SwaggerUIBundle({
          url: openapiUrl,
          dom_id: '#swagger-ui',
          deepLinking: true,
          presets: [
            // @ts-expect-error SwaggerUIBundle is loaded globally from CDN
            window.SwaggerUIBundle.presets.apis,
            // @ts-expect-error SwaggerUIStandalonePreset is loaded globally from CDN
            window.SwaggerUIStandalonePreset,
          ],
          layout: 'BaseLayout',
        });
      }
    };

    if (!document.getElementById(scriptId)) {
      const script = document.createElement('script');
      script.id = scriptId;
      script.src = `https://unpkg.com/swagger-ui-dist@${SWAGGER_UI_VERSION}/swagger-ui-bundle.js`;
      script.integrity = SWAGGER_UI_INTEGRITY.script;
      script.crossOrigin = 'anonymous';
      script.async = true;
      script.onload = initSwagger;
      document.body.appendChild(script);
    } else {
      initSwagger();
    }
  }, []);

  return (
    <main dir="ltr" className="min-h-screen bg-[#fbf4dd] text-[#383838] p-4 md:p-8 font-sans">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <header className="bg-white/80 backdrop-blur-sm p-6 rounded-2xl border border-stone-200 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-amber-100 border border-amber-300 flex items-center justify-center text-amber-900 shadow-xs">
              <BookOpen className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-stone-900">Shalomut Map API Documentation</h1>
              <p className="text-sm text-stone-600">
                REST API &amp; Data Layer Specification (OpenAPI 3.0) — מפת שלומות
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <a
              href={
                typeof window !== 'undefined' && window.location.pathname.includes('/shalomut-map-demo')
                  ? '/shalomut-map-demo/openapi.json'
                  : '/openapi.json'
              }
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-xs font-semibold px-3 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg border border-stone-300 transition-colors"
            >
              <FileText className="w-4 h-4" />
              openapi.json
            </a>
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-xs font-semibold px-3 py-2 bg-stone-900 hover:bg-stone-800 text-white rounded-lg transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to App
            </Link>
          </div>
        </header>

        {/* Swagger Container */}
        <div className="bg-white rounded-2xl p-6 border border-stone-200 shadow-sm overflow-hidden min-h-[600px]">
          <div id="swagger-ui" className="swagger-ui-custom" />
        </div>
      </div>
    </main>
  );
}
