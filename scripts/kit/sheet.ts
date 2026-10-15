/**
 * `npm run shots:sheet`: one labelled contact sheet of the last run (bfme ta-contact / art-sheet).
 * Source: dg-template scripts/kit/ (kit v1.0). Copy byte-identical; change it in the template first.
 * Docs: docs/kit/screenshots.md § "The contact sheet"
 *
 *   npm run shots:sheet                    # from shots/manifest*.json → shots/sheet.png + shots/index.html
 *   npm run shots:sheet -- --diff old-shots # mark shots that changed since a saved run
 *
 * One card per scenario (its sizes side by side), wrapped and zoomed to fit 2048 × 2048.
 * Rendered by Chrome from an HTML grid, so no image library is needed.
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { launch } from './lib/browser.ts';
import { ROOT } from './lib/paths.ts';

/** What the sheet needs from a shot record. */
type Row = { scenario: string; size: string; file: string | null; checks: string; errors: string[]; skipped?: string };

const esc = (s: string): string =>
  s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] ?? c);
const hashOf = (file: string): string | null =>
  existsSync(file) ? createHash('sha1').update(readFileSync(file)).digest('hex') : null;

function isRow(x: unknown): x is Row {
  return (
    typeof x === 'object' &&
    x !== null &&
    typeof Reflect.get(x, 'scenario') === 'string' &&
    typeof Reflect.get(x, 'size') === 'string'
  );
}

/** Build shots/sheet.png and shots/index.html from shot records. */
export async function buildSheet(dir: string, records: readonly unknown[], diffDir?: string): Promise<void> {
  const rows = records.filter(isRow);
  const scenarios = [...new Set(rows.map((r) => r.scenario))];
  const sizes = [...new Set(rows.map((r) => r.size))];
  const cell = 320;
  const changed = (r: Row): boolean => {
    if (!diffDir || !r.file) return false;
    return hashOf(join(dir, r.file)) !== hashOf(join(resolve(diffDir), r.file));
  };
  const td = (r: Row | undefined, inline: boolean): string => {
    if (!r) return '';
    const label = `${esc(r.size)}${r.errors.length ? ' ✗' : ''}${changed(r) ? ' (changed)' : ''}`;
    if (!r.file) return `<div class="shot skip"><b>${label}</b><br>${esc(r.skipped ?? 'skipped')}</div>`;
    const path = join(dir, r.file);
    const src = inline && existsSync(path) ? `data:image/png;base64,${readFileSync(path).toString('base64')}` : r.file;
    return `<div class="shot${r.errors.length ? ' bad' : ''}${changed(r) ? ' changed' : ''}"><b>${label}</b><br><img src="${src}"><div class="err">${esc(r.errors.join(' · '))}</div></div>`;
  };
  const html = (inline: boolean): string => `<!doctype html><meta charset="utf-8"><title>Shots</title>
<style>body{margin:0;padding:8px;background:#111;color:#ddd;font:12px system-ui;width:2032px}.cards{display:flex;flex-wrap:wrap;gap:8px;align-items:flex-start}
.card{border:1px solid #333;padding:4px;background:#181818}.card h3{margin:0 0 2px;font-size:14px}.card .why{color:#888;margin-bottom:4px;max-width:${cell * 2}px}.row{display:flex;gap:4px;align-items:flex-start}
.shot img{max-width:${cell}px;max-height:${cell}px;display:block}.bad{background:#401818}.changed{outline:2px solid #fc0}.skip{color:#888;max-width:160px}.err{color:#f88;max-width:${cell}px}
input{margin:4px 0 8px;padding:4px}</style>
${inline ? '' : '<input placeholder="filter" oninput="for(const r of document.querySelectorAll(\'.card[data-s]\'))r.hidden=!r.dataset.s.includes(this.value)">'}
<div class="cards">${scenarios
    .map((s) => {
      const first = rows.find((r) => r.scenario === s);
      return `<div class="card" data-s="${esc(s)}"><h3>${esc(s)}</h3><div class="why">${esc(first?.checks ?? '')}</div><div class="row">${sizes
        .map((z) =>
          td(
            rows.find((r) => r.scenario === s && r.size === z),
            inline,
          ),
        )
        .join('')}</div></div>`;
    })
    .join('')}</div>`;
  writeFileSync(join(dir, 'index.html'), html(false));
  const browser = await launch();
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 2048, height: 2048 });
    await page.setContent(html(true), { waitUntil: 'load' });
    // Zoom out (with a proportionally wider layout) until everything fits in 2048 × 2048.
    const height = await page.evaluate(() => {
      let z = 1;
      for (let i = 0; i < 20; i++) {
        document.body.style.width = `${2032 / z}px`;
        document.body.style.zoom = String(z);
        const h = document.body.getBoundingClientRect().height;
        if (h <= 2048) return Math.ceil(h);
        z *= Math.max(0.5, Math.sqrt(2048 / h));
      }
      return 2048;
    });
    await page.screenshot({
      path: join(dir, 'sheet.png'),
      clip: { x: 0, y: 0, width: 2048, height: Math.min(2048, Math.max(1, height)) },
    });
  } finally {
    await browser.close();
  }
}

// `npm run shots:sheet` on its own: rebuild from the last manifests.
if (import.meta.filename === process.argv[1] || process.argv[1]?.endsWith('sheet.ts')) {
  const dir = join(ROOT, 'shots');
  const records: unknown[] = [];
  for (const f of ['manifest.json', 'manifest-hub.json']) {
    const p = join(dir, f);
    if (!existsSync(p)) continue;
    const parsed: unknown = JSON.parse(readFileSync(p, 'utf8'));
    if (Array.isArray(parsed)) {
      const list: readonly unknown[] = parsed;
      records.push(...list);
    }
  }
  const i = process.argv.indexOf('--diff');
  await buildSheet(dir, records, i >= 0 ? process.argv[i + 1] : undefined);
  console.log('shots/sheet.png, shots/index.html');
}
