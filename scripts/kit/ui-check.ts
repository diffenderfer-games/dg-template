/**
 * `npm run ui:check`: layout rules at every size (no sideways scroll, buttons on screen and big enough to tap).
 * Source: dg-template scripts/kit/ (kit v1.0). Copy byte-identical; change it in the template first.
 * Docs: docs/kit/ui.md § "Checking the layout"
 *
 * Builds (unless --no-build), serves dist/, and on the title, play and pause
 * screens checks: the page doesn't scroll sideways; every visible kit button
 * is inside the viewport; on touch sizes buttons are at least 44 × 44 CSS px.
 */
import { execSync } from 'node:child_process';
import { join } from 'node:path';
import type { Page } from 'puppeteer-core';
import { gameReady, launch, sizePage, SIZES, watchErrors, type SizeName } from './lib/browser.ts';
import { ROOT, slugOf } from './lib/paths.ts';
import { serveDist } from './lib/serve.ts';

if (!process.argv.includes('--no-build')) execSync('npm run build', { cwd: ROOT, stdio: 'inherit' });

/** The layout problems on the current screen. */
async function problems(page: Page, touch: boolean): Promise<string[]> {
  return page.evaluate(
    (minTap) => {
      const out: string[] = [];
      const w = innerWidth;
      const h = innerHeight;
      if (document.documentElement.scrollWidth > w + 1)
        out.push(`scrolls sideways (${document.documentElement.scrollWidth} > ${w})`);
      for (const el of document.querySelectorAll<HTMLElement>('#ui button, #ui [role="button"]')) {
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0 || getComputedStyle(el).visibility === 'hidden') continue;
        const name = el.dataset.testid ?? el.textContent?.trim().slice(0, 20) ?? '?';
        if (r.left < -1 || r.top < -1 || r.right > w + 1 || r.bottom > h + 1) out.push(`"${name}" is off screen`);
        if (minTap > 0 && (r.width < minTap || r.height < minTap))
          out.push(`"${name}" is ${Math.round(r.width)}×${Math.round(r.height)} (< ${minTap})`);
      }
      return out;
    },
    touch ? 44 : 0,
  );
}

const served = await serveDist(join(ROOT, 'dist'), slugOf());
const browser = await launch();
let bad = 0;
try {
  for (const size of Object.keys(SIZES).filter((k): k is SizeName => k in SIZES)) {
    const page = await browser.newPage();
    await page.evaluateOnNewDocument(() => Reflect.set(window, '__HUB_TEST__', {}));
    await sizePage(page, size);
    const errors = watchErrors(page);
    await page.goto(served.url, { waitUntil: 'domcontentloaded' });
    await gameReady(page);
    const touch = 'hasTouch' in SIZES[size];
    const drive = (k: string): Promise<void> =>
      page.evaluate((key) => {
        const g: unknown = Reflect.get(window, '__game');
        const fn: unknown = g ? Reflect.get(Object(g), key) : undefined;
        if (typeof fn === 'function') Reflect.apply(fn, g, []);
      }, k);
    for (const [screen, go] of [
      ['title', () => Promise.resolve()],
      ['play', () => drive('newGame')],
      ['pause', () => drive('pause')],
    ] as const) {
      await go();
      await new Promise((r) => setTimeout(r, 300));
      const found = [...(await problems(page, touch)), ...errors.splice(0)];
      bad += found.length;
      console.log(`${found.length ? '✗' : '✓'} ${size} ${screen}${found.map((p) => `\n    ${p}`).join('')}`);
    }
    await page.close();
  }
} finally {
  await browser.close();
  served.server.close();
}
process.exit(bad > 0 ? 1 : 0);
