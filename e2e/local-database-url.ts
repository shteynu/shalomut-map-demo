import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';

/**
 * Give this process a `DATABASE_URL` from `.env`, and nothing else from it.
 *
 * The obvious line is `import 'dotenv/config'`, and it is wrong here. The smoke
 * server is started by the Playwright runner, which does not load `.env`, so it
 * signs sessions with the fallback in `playwright.config.ts`. A worker that
 * loaded the whole `.env` would take `SESSION_SECRET` from the developer's file
 * instead, mint a token the server cannot verify, and every protected page
 * would redirect to `/login` — the exact symptom
 * `.github/workflows/browser-smoke.yml` already carries a paragraph about, and
 * it reads like a broken sign-in rather than a mismatched fixture.
 *
 * So: parse the file, take the one variable the specs need to reach the
 * database, and leave the rest of the process alone. `dotenv.parse` never
 * touches `process.env`.
 *
 * In CI there is no `.env` and `DATABASE_URL` is already on the step, so this
 * does nothing at all.
 */
if (!process.env.DATABASE_URL) {
  const envFile = path.join(process.cwd(), '.env');
  if (fs.existsSync(envFile)) {
    const parsed = dotenv.parse(fs.readFileSync(envFile));
    if (parsed.DATABASE_URL) process.env.DATABASE_URL = parsed.DATABASE_URL;
  }
}
