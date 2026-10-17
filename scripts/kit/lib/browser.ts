/**
 * scripts/kit/lib: the system Chrome (puppeteer-core), tagged so clean:procs can find it.
 * Source: dg-template scripts/kit/ (kit v1.0). Copy byte-identical; change it in the template first.
 * Docs: docs/kit/screenshots.md
 */
import puppeteer, { type Browser, type Page } from 'puppeteer-core';
import { CHROME } from './paths.ts';
import { CHROME_TAG, forget, remember } from './procs.ts';

/** Screenshot sizes (cover is the hub's card shape, 40:21; phone is a touch device at DPR 2). */
export const SIZES = {
  desk: { width: 1280, height: 800 },
  cover: { width: 800, height: 420 },
  phone: { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  'phone-land': { width: 844, height: 390, deviceScaleFactor: 2, isMobile: true, hasTouch: true, isLandscape: true },
  tablet: { width: 820, height: 1180, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
} as const;

/** A size's name. */
export type SizeName = keyof typeof SIZES;

/** Console messages that are expected (the hub's BENIGN_CONSOLE, plus a static server's /_api 404s). */
export const BENIGN = [
  /Failed to load resource: the server responded with a status of 4\d\d/,
  /WebSocket connection to '.*\/_ws' failed/,
  /net::ERR_INTERNET_DISCONNECTED/,
];

/** Launch Chrome headless. */
export async function launch(): Promise<Browser> {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    args: [
      CHROME_TAG,
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-background-timer-throttling',
      '--disable-renderer-backgrounding',
    ],
  });
  const pid = browser.process()?.pid;
  remember(pid, 'chrome');
  browser.on('disconnected', () => forget(pid));
  return browser;
}

/** Collect a page's errors (console.error that isn't benign, uncaught exceptions). */
export function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e instanceof Error ? e.message : String(e)}`));
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const text = m.text();
    if (!BENIGN.some((re) => re.test(text))) errors.push(`console.error: ${text}`);
  });
  return errors;
}

/** Set a page to a size (viewport + touch emulation). */
export async function sizePage(page: Page, size: SizeName): Promise<void> {
  await page.setViewport(SIZES[size]);
}

/** Wait until the game mounted and installed `window.__game`. */
export async function gameReady(page: Page, timeout = 30_000): Promise<void> {
  await page.waitForFunction(() => document.body.dataset.ready === '1' && Reflect.get(window, '__game') !== undefined, {
    timeout,
  });
}
