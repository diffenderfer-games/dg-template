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

/**
 * Is the page served from a private network address (a local hub on the Wi-Fi, which phones test on:
 * 192.168.x, 10.x, 172.16–31.x)? The site itself never is.
 */
export function isLocalNetwork(hostname: string = typeof location === 'undefined' ? '' : location.hostname): boolean {
  return /^(192\.168\.|10\.\d{1,3}\.|172\.(1[6-9]|2\d|3[01])\.)\d{1,3}\.\d{1,3}$/.test(hostname);
}

/** May test drivers (setState, solveNow…) be installed? Dev, localhost, the local network or a test harness. */
export function driversAllowed(): boolean {
  return isDev() || isTestHarness() || isLocalhost() || isLocalNetwork();
}

/** Does the URL ask for screenshot mode (`?shot`)? */
export function isShotMode(search: string = typeof location === 'undefined' ? '' : location.search): boolean {
  return new URLSearchParams(search).has('shot');
}

/** Is the page inside a frame (the world's box, or any other page's iframe)? */
export function inFrame(win: Window | undefined = typeof window === 'undefined' ? undefined : window): boolean {
  if (win === undefined) return false;
  try {
    return win.self !== win.top;
  } catch {
    return true; // a cross-origin parent: reading `top` threw
  }
}

/**
 * Is the game playing in the world's box over Adventure Mode (hub.md "Playing over
 * the world")? In a frame, and opened with `?hub_embed=1` (the host also notes it
 * as `window.__hubEmbed` before the game can rewrite its URL).
 */
export function isEmbedded(
  win: Window | undefined = typeof window === 'undefined' ? undefined : window,
  search: string = typeof location === 'undefined' ? '' : location.search,
): boolean {
  if (win === undefined || !inFrame(win)) return false;
  return Reflect.get(win, '__hubEmbed') === 1 || new URLSearchParams(search).get('hub_embed') === '1';
}
