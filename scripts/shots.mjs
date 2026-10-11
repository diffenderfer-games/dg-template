// Screenshots of the built game (dist/) at desktop and phone sizes, into shots/.
//
//   npm run build && node scripts/shots.mjs [desk|phone]
//
// Keep this script and grow it with your game: add a step per screen you want
// to check (menus, play, win, pause...) so every later change can be checked
// the same way. Look at the PNGs after each change.
//
// It serves dist/ itself under /<slug>/ (like the catalog does) on a port the OS
// picks (listen(0)), so it never collides with other dev servers on this machine.
// Uses puppeteer-core from the sibling host checkout (../diffenderfer-games, or
// DG_HOST) and the system Chrome (CHROME_PATH). No hub runs here: /_api calls 404
// and the hub client falls back to localStorage. For hub flows (daily, races,
// the menu) use scripts/shots-hub.mjs against `npm run local` in the host.
import { createServer } from 'node:http';
import { mkdir, readFile } from 'node:fs/promises';
import { basename, dirname, extname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SLUG = basename(ROOT).toLowerCase();
const HUB = process.env.DG_HOST || resolve(ROOT, '..', 'diffenderfer-games');
const { default: puppeteer } = await import(pathToFileURL(resolve(HUB, 'node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js')).href);
const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const SIZES = {
  desk: { width: 1280, height: 800 },
  phone: { width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
};
const only = process.argv[2] || '';

// --- serve dist/ under /<slug>/ on a free port ---------------------------------
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.woff': 'font/woff', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json' };
const server = createServer(async (req, res) => {
  let path = new URL(req.url, 'http://x').pathname.replace(new RegExp(`^/${SLUG}/`), '/');
  if (path === '/') path = '/index.html';
  try {
    const body = await readFile(resolve(ROOT, 'dist', '.' + path));
    res.writeHead(200, { 'content-type': TYPES[extname(path)] ?? 'application/octet-stream' });
    res.end(body);
  } catch { res.writeHead(404); res.end(); }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r)); // 0 = any free port
const base = `http://127.0.0.1:${server.address().port}/${SLUG}/`;

// --- capture -------------------------------------------------------------------
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
await mkdir(resolve(ROOT, 'shots'), { recursive: true });
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true });
try {
  for (const size of Object.keys(SIZES)) {
    if (only && only !== size) continue;
    const page = await browser.newPage();
    page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
    await page.setViewport(SIZES[size]);
    await page.goto(base, { waitUntil: 'networkidle0' });
    await page.waitForSelector('canvas');
    await sleep(1500);
    const shot = (name) => page.screenshot({ path: resolve(ROOT, 'shots', `${size}-${name}.png`) });
    await shot('start');
    // Add your game's steps here, e.g. (with a window test hook like window.__game):
    //   await page.evaluate(() => document.getElementById('playBtn').click());
    //   await sleep(1000); await shot('play');
    await page.keyboard.down('ArrowRight'); await sleep(600); await page.keyboard.up('ArrowRight');
    await shot('moved');
    await page.close();
  }
} finally {
  await browser.close();
  server.close();
}
console.log(`screenshots in ${resolve(ROOT, 'shots')}`);
