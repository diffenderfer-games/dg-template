// Screenshots against a running local diffenderfer.games (the real hub: menu,
// daily, races, saves), into shots/.
//
//   1. Pick a FREE port first (this machine often has many dev servers running):
//        node scripts/shots-hub.mjs --free-port         → prints one, e.g. 8137
//   2. In ../diffenderfer-games:  npm run local -- --only <slug> --port 8137
//   3. node scripts/shots-hub.mjs http://localhost:8137
//
// Keep this script and add a step per hub flow your game uses. Each player gets
// its own browser context (its own guest account), so two contexts can race or
// play together.
import { mkdir } from 'node:fs/promises';
import { createServer } from 'node:net';
import { basename, dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SLUG = basename(ROOT).toLowerCase();

/** True when nothing listens on `port` (on any address). */
function portFree(port) {
  return new Promise((done) => {
    const s = createServer().once('error', () => done(false)).once('listening', () => s.close(() => done(true)));
    s.listen(port);
  });
}

if (process.argv[2] === '--free-port') {
  // npm run local uses a block of ports next to the one you give it, so check a few.
  for (let p = 8101; p < 8999; p += 10) {
    const block = await Promise.all([0, 1, 2, 3].map((k) => portFree(p + k)));
    if (block.every(Boolean)) { console.log(p); process.exit(0); }
  }
  console.error('no free port found'); process.exit(1);
}

const host = process.argv[2];
if (!host) { console.error('usage: node scripts/shots-hub.mjs <http://localhost:PORT> | --free-port'); process.exit(1); }
const HUB = process.env.DG_HOST || resolve(ROOT, '..', 'diffenderfer-games');
const { default: puppeteer } = await import(pathToFileURL(resolve(HUB, 'node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js')).href);
const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const SIZES = { desk: { width: 1280, height: 800 }, phone: { width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

await mkdir(resolve(ROOT, 'shots'), { recursive: true });
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true });
/** A fresh player (own cookies → own guest account) on the game page. */
async function player(size) {
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
  await page.setViewport(SIZES[size]);
  await page.goto(`${host}/${SLUG}/`, { waitUntil: 'networkidle2' });
  await page.waitForSelector('canvas');
  await sleep(1500);
  return page;
}
try {
  for (const size of Object.keys(SIZES)) {
    const a = await player(size);
    await a.screenshot({ path: resolve(ROOT, 'shots', `hub-${size}-start.png`) });
    // Add your game's hub flows here, e.g. a race between two players:
    //   const b = await player('desk');
    //   await a.evaluate(() => document.getElementById('raceStart').click());
    //   await a.waitForFunction(() => window.HubSDK?.hub.race.current()?.code);
    //   const code = await a.evaluate(() => window.HubSDK.hub.race.current().code);
    //   await b.evaluate((c) => window.HubSDK.hub.race.join(c), code);
  }
} finally {
  await browser.close();
}
console.log(`screenshots in ${resolve(ROOT, 'shots')}`);
