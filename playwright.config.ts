import { defineConfig, devices } from '@playwright/test';

/**
 * One smoke path through the real application, in a real browser.
 *
 * Everything else in this repository is verified without a browser: 733 unit
 * and API tests, 26 database integration tests, and the AI service's own
 * suite. What none of them can see is the half of the product that only exists
 * once a page renders — a school selector that disappeared, a reading order
 * that flipped, a server component that throws on the server and shows a blank
 * screen. Until now that half was checked by hand, once per session, by the
 * owner with a signed-in browser.
 *
 * So this is deliberately one path and not a suite. It answers "is the app
 * standing?", not "is every rule correct" — that is what the other tests are
 * for, and a broad end-to-end suite over screens that are still changing would
 * cost more than it catches.
 *
 * It runs against a production build, on a server of its own, with credentials
 * generated for the run. Two dead ends led here, and both are worth knowing
 * before someone "simplifies" this back:
 *
 * - `next dev` cannot be used: Next 16 refuses a second development server in
 *   a directory that already has one, and reusing the developer's server made
 *   the run flaky in a way that looked like a product bug. The login page's
 *   client chunk is compiled lazily, so the first click submitted the form
 *   natively — a GET to `/login`, fields reset, no error shown.
 * - `next start` alone cannot be used either: `NODE_ENV=production` makes
 *   `ManagerAuthenticationService` treat the run as deployed and demand
 *   `SESSION_SECRET`, `MANAGER_ADMIN_PASSWORD` and `MANAGER_ORGANIZATION_ID`.
 *
 * So the run supplies those three itself. The password and session secret are
 * random per run and exist only in this process — the repository's real
 * secrets are never read, and CI needs none configured. The organization id is
 * the local development one that `scripts/seed-local.ts` seeds, because a
 * manager signed into an organization with no data proves very little.
 */

const PORT = Number(process.env.SMOKE_PORT ?? 3100);

/**
 * Throwaway credentials for the smoke server. Not secrets, and deliberately
 * constant rather than generated: this file is evaluated once in the runner
 * and again in every worker process, so a random value would differ between
 * the server that was started and the browser that tries to sign in — which
 * fails as "wrong password" and reads like a broken login screen.
 *
 * They authenticate a browser against a server this config just started, both
 * of which die with the run, and they are overridable for anyone who wants to
 * point the smoke somewhere else.
 */
export const SMOKE_PASSWORD = process.env.SMOKE_PASSWORD ?? 'smoke-run-password';
const SMOKE_SESSION_SECRET =
  process.env.SESSION_SECRET ?? 'smoke-run-session-secret-not-a-real-secret';
const SMOKE_ORGANIZATION_ID =
  process.env.MANAGER_ORGANIZATION_ID ?? 'local-dev-organization';

export default defineConfig({
  testDir: './e2e',
  // The path is a story: sign in, read the share link, answer as a respondent.
  // Running its steps in parallel would only prove they cannot be.
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    locale: 'he-IL',
    // A failure here is usually visual, and a screenshot is the difference
    // between "the smoke failed" and knowing why.
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    /*
     * The respondent path, again, on a phone.
     *
     * Only that file. The manager screens are a desk product — a school opens
     * the map and the builder on a laptop — and running their specs at 393px
     * would spend minutes proving something nobody has asked the product to
     * do. The questionnaire is the opposite: it is a link in a staffroom
     * message, opened on the way home, and until this project existed no phone
     * had ever rendered it in CI. The one defect already found there, scale
     * anchors at `display: none`, was found by hand.
     *
     * Pixel 5 rather than an iPhone because its `defaultBrowserType` is
     * chromium, which CI already installs. WebKit would be the more honest
     * choice for an Israeli staffroom and it costs another browser download in
     * every run; the viewport and the touch input are what catch layout, and
     * that much is free.
     */
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 5'] },
      testMatch: /respondent-answers\.spec\.ts/u,
    },
  ],
  webServer: {
    // `npm run test:e2e` builds first; this serves what the build produced.
    command: `npx next start --port ${PORT}`,
    url: `http://127.0.0.1:${PORT}/login`,
    // Never reuse: a server started with other credentials would refuse every
    // password, and the failure would read as a broken login screen.
    reuseExistingServer: false,
    env: {
      SESSION_SECRET: SMOKE_SESSION_SECRET,
      MANAGER_ADMIN_PASSWORD: SMOKE_PASSWORD,
      MANAGER_ORGANIZATION_ID: SMOKE_ORGANIZATION_ID,
    },
    timeout: 180_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
});
