/**
 * kit/core: where the game is running (dev, test, localhost, hub or standalone).
 * Source: dg-template src/kit/core/ (kit v1.0). Copy byte-identical; change it in the template first.
 * Docs: docs/kit/core.md
 */

declare global {
  interface Window {
    /** Set by the hub's e2e kit before load (`evaluateOnNewDocument`); turns on test drivers. */
    __HUB_TEST__?: object;
  }
}

/** Is this a Vite dev build (`npm run dev`)? */
export function isDev(): boolean {
  return typeof import.meta.env === 'object' && import.meta.env.DEV;
}

/** Is the page on this machine (localhost, 127.0.0.1, [::1])? */
export function isLocalhost(hostname: string = typeof location === 'undefined' ? '' : location.hostname): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]' || hostname === '::1';
}

/** Is a test harness driving the page (`window.__HUB_TEST__` pre-defined)? */
export function isTestHarness(): boolean {
  return typeof window !== 'undefined' && window.__HUB_TEST__ !== undefined;
}

/** May test drivers (setState, solveNow…) be installed? Dev, localhost or a test harness. */
export function driversAllowed(): boolean {
  return isDev() || isTestHarness() || isLocalhost();
}

/** Does the URL ask for screenshot mode (`?shot`)? */
export function isShotMode(search: string = typeof location === 'undefined' ? '' : location.search): boolean {
  return new URLSearchParams(search).has('shot');
}
