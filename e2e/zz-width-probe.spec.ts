import { test } from '@playwright/test';
import { signIn } from './manager-session';

const CASES: Array<[string, number]> = [
  ['/round', 1440], ['/round', 900], ['/round', 760], ['/round', 600], ['/round', 430], ['/round', 390],
  ['/survey', 1440], ['/survey', 760], ['/survey', 390],
];

for (const [screen, width] of CASES) {
  test(`probe ${screen} @${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await signIn(page, screen);
    await page.waitForTimeout(2500);
    const out = await page.evaluate(() => {
      const r = (s: string) => {
        const el = document.querySelector(s);
        if (!el) return null;
        const b = el.getBoundingClientRect();
        return { l: Math.round(b.left * 10) / 10, r: Math.round(b.right * 10) / 10, w: Math.round(b.width * 10) / 10 };
      };
      return {
        vw: window.innerWidth,
        header: r('.site-header'),
        page: r('.page'),
        slot: r('.survey-builder-history-slot'),
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      };
    });
    console.log('PROBE ' + JSON.stringify(out));
  });
}
