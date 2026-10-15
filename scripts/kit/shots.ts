/**
 * `npm run shots` / `npm run shots:hub`: named screenshot scenarios at phone and desktop sizes, then a contact sheet.
 * Source: dg-template scripts/kit/ (kit v1.0). Copy byte-identical; change it in the template first.
 * Docs: docs/kit/screenshots.md
 *
 *   npm run shots                          # build, serve dist/ under /<slug>/, every static scenario, phone + desk
 *   npm run shots:hub                      # hub scenarios against a test host (or --url http://localhost:PORT)
 *   npm run shots -- title pause --size phone
 *   npm run shots -- --size phone-land,tablet --no-build
 *
 * Output: shots/<scenario>-<size>.png, shots/manifest.json (scenario, size,
 * URL, errors, __game.snap()) and shots/sheet.png + shots/index.html. Any
 * console error fails the run (the hub's benign list allowed). Look at the
 * sheet with Read instead of guessing.
 */
import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { launch, SIZES, type SizeName } from './lib/browser.ts';
import { hubHost } from './lib/hub-host.ts';
import { ROOT, slugOf } from './lib/paths.ts';
import { serveDist } from './lib/serve.ts';
import { makeContext } from './shots/context.ts';
import { KIT_SCENARIOS } from './shots/scenarios.ts';
import type { Scenario, ShotTarget } from './shots/types.ts';
import { buildSheet } from './sheet.ts';

/** One shot's record. */
export type ShotRecord = {
  scenario: string;
  size: SizeName;
  target: ShotTarget;
  file: string | null;
  url: string;
  checks: string;
  errors: string[];
  snap: unknown;
  skipped?: string;
};

const args = process.argv.slice(2);
const flag = (name: string): string | undefined => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : args.find((a) => a.startsWith(`${name}=`))?.split('=')[1];
};
const target: ShotTarget = args.includes('--hub') ? 'hub' : 'static';
const sizes = (flag('--size') ?? 'phone,desk').split(',').filter((s): s is SizeName => s in SIZES);
const values = new Set([flag('--size'), flag('--url'), flag('--diff')].filter((v) => v !== undefined));
const names = args.filter((a) => !a.startsWith('--') && !values.has(a));

/** The game's own scenarios (scripts/shots.config.ts), when it has any. */
async function gameScenarios(): Promise<{ scenarios: Scenario[]; exclude: string[] }> {
  const file = join(ROOT, 'scripts', 'shots.config.ts');
  if (!existsSync(file)) return { scenarios: [], exclude: [] };
  const mod: unknown = await import(pathToFileURL(file).href);
  const scenarios: unknown = typeof mod === 'object' && mod !== null ? Reflect.get(mod, 'scenarios') : [];
  const exclude: unknown = typeof mod === 'object' && mod !== null ? Reflect.get(mod, 'exclude') : [];
  const isScenario = (x: unknown): x is Scenario =>
    typeof x === 'object' &&
    x !== null &&
    typeof Reflect.get(x, 'name') === 'string' &&
    typeof Reflect.get(x, 'run') === 'function';
  return {
    scenarios: Array.isArray(scenarios) ? scenarios.filter(isScenario) : [],
    exclude: Array.isArray(exclude) ? exclude.filter((x): x is string => typeof x === 'string') : [],
  };
}

const slug = slugOf();
const extra = await gameScenarios();
const all = [...KIT_SCENARIOS.filter((s) => !extra.exclude.includes(s.name)), ...extra.scenarios];
const chosen = all.filter((s) => s.target === target && (names.length === 0 || names.includes(s.name)));
if (chosen.length === 0) {
  console.error(
    `no ${target} scenarios match ${names.join(', ') || '(all)'}; known: ${all.map((s) => `${s.name} (${s.target})`).join(', ')}`,
  );
  process.exit(1);
}

const outDir = join(ROOT, 'shots');
mkdirSync(outDir, { recursive: true });
/** Where the game is served: dist/ here, or a hub. */
async function serve(): Promise<{ origin: string; base: string; stop: () => Promise<void> }> {
  if (target === 'static') {
    if (!args.includes('--no-build')) execSync('npm run build', { cwd: ROOT, stdio: 'inherit' });
    const served = await serveDist(join(ROOT, 'dist'), slug);
    return {
      base: served.url,
      origin: new URL(served.url).origin,
      stop: () => new Promise((r) => served.server.close(() => r())),
    };
  }
  const url = flag('--url');
  const host = await hubHost(slug, {
    ...(url === undefined ? {} : { url }),
    env: { HUB_LIMITS_JSON: JSON.stringify({ raceCountdownMs: 1200 }) },
  });
  return { origin: host.url, base: `${host.url}/${slug}/`, stop: host.stop };
}
const { origin, base, stop } = await serve();

const browser = await launch();
const records: ShotRecord[] = [];
let failed = 0;
try {
  for (const s of chosen) {
    for (const size of sizes) {
      const file = `${s.name}-${size}.png`;
      if (s.skip) {
        records.push({
          scenario: s.name,
          size,
          target,
          file: null,
          url: base,
          checks: s.checks,
          errors: [],
          snap: null,
          skipped: s.skip,
        });
        console.log(`- ${s.name} ${size}: skipped (${s.skip})`);
        continue;
      }
      const { ctx, errors, close } = await makeContext({ browser, target, size, origin, base });
      let problem: string | null = null;
      try {
        await s.run(ctx);
        await ctx.page.screenshot({ path: join(outDir, file) });
      } catch (e) {
        problem = e instanceof Error ? (e.message.split('\n')[0] ?? e.message) : String(e);
        await ctx.page.screenshot({ path: join(outDir, file) }).catch(() => undefined);
      }
      const snap: unknown = await ctx.page
        .evaluate(() => {
          const g: unknown = Reflect.get(window, '__game');
          const fn: unknown = g ? Reflect.get(Object(g), 'snap') : undefined;
          const out: unknown = typeof fn === 'function' ? Reflect.apply(fn, g, []) : null;
          return out;
        })
        .catch(() => null);
      const errs = [...(problem ? [`scenario: ${problem}`] : []), ...errors()];
      await close();
      if (errs.length > 0) failed++;
      records.push({ scenario: s.name, size, target, file, url: base, checks: s.checks, errors: errs, snap });
      console.log(`${errs.length ? '✗' : '✓'} ${s.name} ${size}${errs.length ? `\n    ${errs.join('\n    ')}` : ''}`);
    }
  }
} finally {
  await browser.close();
  await stop();
}

const manifestFile = join(outDir, `manifest${target === 'hub' ? '-hub' : ''}.json`);
writeFileSync(manifestFile, JSON.stringify(records, null, 2));
const others = join(outDir, `manifest${target === 'hub' ? '' : '-hub'}.json`);
const merged: unknown[] = [...records];
if (existsSync(others)) {
  const prev: unknown = JSON.parse(readFileSync(others, 'utf8'));
  if (Array.isArray(prev)) {
    const list: readonly unknown[] = prev;
    merged.push(...list);
  }
}
await buildSheet(outDir, merged, flag('--diff'));
console.log(`\n${records.length} shot(s), ${failed} with problems → shots/sheet.png, shots/index.html`);
process.exit(failed > 0 ? 1 : 0);
