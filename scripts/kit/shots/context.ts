/**
 * scripts/kit/shots: the context each scenario runs with (pages, players, drivers).
 * Source: dg-template scripts/kit/ (kit v1.0). Copy byte-identical; change it in the template first.
 * Docs: docs/kit/screenshots.md
 */
import type { Browser, BrowserContext, Page } from 'puppeteer-core';
import { gameReady, sizePage, watchErrors, type SizeName } from '../lib/browser.ts';
import type { ShotContext, ShotPlayer, ShotTarget } from './types.ts';

/** A username the hub's filter accepts (letters only). */
function safeName(n: number): string {
  const letters = 'abcdefghijklmnopqrstuvwxyz';
  let s = '';
  let x = Date.now() + n * 7919;
  for (let i = 0; i < 6; i++) {
    s += letters[x % 26] ?? 'a';
    x = Math.floor(x / 26);
  }
  return `Shot${s}`;
}

/** Find (and optionally click) an element through the hub's shadow roots, by selector and text. */
async function deep(
  page: Page,
  selector: string,
  text: string | undefined,
  click: boolean,
  timeout = 15_000,
): Promise<void> {
  await page.waitForFunction(
    (sel, txt, doClick) => {
      const [hostSel, inner] = sel.includes(' >>> ') ? sel.split(' >>> ') : [null, sel];
      const roots: ParentNode[] = [];
      if (hostSel) {
        const host = document.querySelector(hostSel);
        if (host?.shadowRoot) roots.push(host.shadowRoot);
      } else roots.push(document);
      for (const root of roots) {
        for (const el of root.querySelectorAll<HTMLElement>(inner ?? sel)) {
          if (txt !== null && !(el.textContent ?? '').includes(txt)) continue;
          if (doClick) el.click();
          return true;
        }
      }
      return false;
    },
    { timeout, polling: 100 },
    selector,
    text ?? null,
    click,
  );
}

/** Let entrance animations finish (at most a second). */
async function settle(page: Page): Promise<void> {
  await page.evaluate(() =>
    Promise.race([
      Promise.all(
        document
          .getAnimations()
          .filter((a) => a.effect?.getTiming().iterations !== Infinity)
          .map((a) => a.finished.catch(() => undefined)),
      ),
      new Promise((r) => setTimeout(r, 1000)),
    ]),
  );
}

/** Build the context for one scenario at one size. */
export async function makeContext(o: {
  browser: Browser;
  target: ShotTarget;
  size: SizeName;
  origin: string;
  base: string;
}): Promise<{ ctx: ShotContext; errors: () => string[]; close: () => Promise<void> }> {
  const contexts: BrowserContext[] = [];
  const pageErrors: string[][] = [];
  let n = 0;
  const newPage = async (): Promise<Page> => {
    const bc = await o.browser.createBrowserContext();
    contexts.push(bc);
    const page = await bc.newPage();
    await page.evaluateOnNewDocument(() => Reflect.set(window, '__HUB_TEST__', {}));
    await sizePage(page, o.size);
    pageErrors.push(watchErrors(page));
    return page;
  };
  /** Sign a page up as a claimed player (hub only). */
  const signUp = async (page: Page): Promise<ShotPlayer> => {
    await page.goto(`${o.origin}/`, { waitUntil: 'domcontentloaded' });
    const name = safeName(n++);
    const id = await page.evaluate(async (username) => {
      const r = await fetch('/_api/auth/signup', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ username, password: 'password1' }),
      });
      const body: unknown = await r.json();
      const user: unknown = Reflect.get(Object(body), 'user');
      const uid: unknown = Reflect.get(Object(user), 'id');
      return typeof uid === 'number' ? uid : -1;
    }, name);
    return { page, id, name };
  };
  const page = await newPage();
  let mine: ShotPlayer | null = null;
  const ctx: ShotContext = {
    target: o.target,
    size: o.size,
    origin: o.origin,
    base: o.base,
    page,
    async open(query = '', p = page) {
      await p.goto(`${o.base}${query}`, { waitUntil: 'domcontentloaded' });
      await gameReady(p);
      await p.waitForFunction(() => document.querySelector('#ui')?.getAttribute('data-screen') !== 'loading', {
        timeout: 20_000,
      });
      await settle(p);
    },
    async player() {
      if (o.target !== 'hub') throw new Error('a second player needs the hub target');
      return signUp(await newPage());
    },
    async me() {
      mine ??= o.target === 'hub' ? await signUp(page) : { page, id: 0, name: 'Player' };
      return mine;
    },
    async befriend(a, b) {
      await a.page.evaluate(
        (id) =>
          fetch('/_api/social/friends', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ userId: id }),
          }),
        b.id,
      );
      await b.page.evaluate((id) => fetch(`/_api/social/friends/${id}/accept`, { method: 'POST' }), a.id);
    },
    async drive(path, ...args) {
      await page.evaluate(
        (p, a) => {
          let target: unknown = Reflect.get(window, '__game');
          const parts = p.split('.');
          const fnName = parts.pop() ?? '';
          for (const k of parts) target = Reflect.get(Object(target), k);
          const fn: unknown = Reflect.get(Object(target), fnName);
          if (typeof fn !== 'function') throw new Error(`no __game.${p} driver`);
          Reflect.apply(fn, target, a);
        },
        path,
        args,
      );
    },
    async screen(name, p = page) {
      await p.waitForFunction(
        (s) => document.querySelector('#ui')?.getAttribute('data-screen') === s,
        { timeout: 15_000 },
        name,
      );
    },
    async press(testid, p = page) {
      const el = await p.waitForSelector(`[data-testid="${testid}"]:not([disabled])`, {
        visible: true,
        timeout: 15_000,
      });
      await el?.click();
    },
    hubClick: (sel, text, p = page) => deep(p, sel, text, true),
    hubFind: (sel, text, p = page) => deep(p, sel, text, false),
    wait: (ms) => new Promise((r) => setTimeout(r, ms)),
  };
  if (o.target === 'hub') await ctx.me();
  return {
    ctx,
    errors: () => pageErrors.flat(),
    close: async () => {
      for (const bc of contexts) await bc.close().catch(() => undefined);
    },
  };
}
