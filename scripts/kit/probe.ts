/**
 * `npm run probe`: open the game once and print what it says (screen, snap, errors), plus one screenshot.
 * Source: dg-template scripts/kit/ (kit v1.0). Copy byte-identical; change it in the template first.
 * Docs: docs/kit/screenshots.md § "Probe"
 *
 *   npm run probe                          # the URL in .tmp/local.json (npm run local), else dist/ served here
 *   npm run probe -- http://localhost:8490/my-game/ --size phone
 */
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gameReady, launch, sizePage, SIZES, watchErrors, type SizeName } from './lib/browser.ts';
import { ROOT, slugOf, TMP } from './lib/paths.ts';
import { serveDist } from './lib/serve.ts';

const args = process.argv.slice(2);
const si = args.indexOf('--size');
const sizeArg = si >= 0 ? args[si + 1] : 'desk';
const isSize = (x: string | undefined): x is SizeName => x !== undefined && x in SIZES;
const size: SizeName = isSize(sizeArg) ? sizeArg : 'desk';

/** The URL from the args, the local hub, or dist/ served here. */
async function target(): Promise<{ url: string; close(): void }> {
  const given = args.find((a) => a.startsWith('http'));
  if (given) return { url: given, close: () => undefined };
  const local = join(TMP, 'local.json');
  if (existsSync(local)) {
    const parsed: unknown = JSON.parse(readFileSync(local, 'utf8'));
    const game: unknown = typeof parsed === 'object' && parsed !== null ? Reflect.get(parsed, 'game') : undefined;
    if (typeof game === 'string') return { url: game, close: () => undefined };
  }
  const served = await serveDist(join(ROOT, 'dist'), slugOf());
  return { url: served.url, close: () => served.server.close() };
}

const t = await target();
const browser = await launch();
try {
  const page = await browser.newPage();
  await page.evaluateOnNewDocument(() => Reflect.set(window, '__HUB_TEST__', {}));
  await sizePage(page, size);
  const errors = watchErrors(page);
  await page.goto(t.url, { waitUntil: 'domcontentloaded' });
  await gameReady(page);
  await new Promise((r) => setTimeout(r, 1000));
  const info: unknown = await page.evaluate(() => {
    const g: unknown = Reflect.get(window, '__game');
    const call = (k: string): unknown => {
      const fn: unknown = g ? Reflect.get(Object(g), k) : undefined;
      return typeof fn === 'function' ? Reflect.apply(fn, g, []) : null;
    };
    const kit: unknown = g ? Reflect.get(Object(g), 'kit') : null;
    return {
      screen: call('screen'),
      mode: call('mode'),
      paused: call('paused'),
      snap: call('snap'),
      kit,
    };
  });
  mkdirSync(join(ROOT, 'shots'), { recursive: true });
  await page.screenshot({ path: join(ROOT, 'shots', `probe-${size}.png`) });
  console.log(JSON.stringify({ url: t.url, ...Object(info), errors }, null, 2));
  console.log(`→ shots/probe-${size}.png`);
  process.exitCode = errors.length > 0 ? 1 : 0;
} finally {
  await browser.close();
  t.close();
}
