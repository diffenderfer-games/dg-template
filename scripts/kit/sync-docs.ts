/**
 * `npm run sync-docs`: re-copy the hub's canonical docs (never edit the copies).
 * Source: dg-template scripts/kit/ (kit v1.0). Copy byte-identical; change it in the template first.
 * Docs: docs/kit/README.md § "Keeping up to date"
 *
 *   npm run sync-docs                      # from ../diffenderfer-games (or DG_HOST)
 *   npm run sync-docs -- ../path/to/hub
 *
 * Copies docs/hub.md, docs/multiplayer.md and HANDOFF.md, then warns about any
 * docs/kit/*.md link to a hub doc heading that no longer exists.
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { expandPath } from './lib/modules.ts';
import { HUB, ROOT } from './lib/paths.ts';

const SHARED = ['docs/hub.md', 'docs/multiplayer.md', 'HANDOFF.md'];
const host = resolve(process.argv[2] ?? HUB);

const missing = SHARED.filter((d) => !existsSync(join(host, d)));
if (missing.length > 0) {
  console.error(`Not a hub checkout (missing ${missing.join(', ')}): ${host}`);
  process.exit(1);
}
for (const doc of SHARED) {
  mkdirSync(dirname(join(ROOT, doc)), { recursive: true });
  copyFileSync(join(host, doc), join(ROOT, doc));
  console.log('synced', doc);
}

/** GitHub-style anchors of a markdown file's headings. */
function anchors(path: string): Set<string> {
  const out = new Set<string>();
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const m = /^#{1,6}\s+(.*)$/.exec(line);
    if (!m) continue;
    const slug = (m[1] ?? '')
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s_-]/gu, '')
      .trim()
      .replace(/\s/g, '-');
    out.add(slug);
  }
  return out;
}

let broken = 0;
const targets = new Map(SHARED.map((d) => [d.replace(/^docs\//, ''), anchors(join(ROOT, d))]));
for (const file of expandPath(ROOT, 'docs/kit').concat(expandPath(ROOT, 'docs/getting-started.md'))) {
  const text = readFileSync(join(ROOT, file), 'utf8');
  for (const m of text.matchAll(/\]\((?:\.\.\/)*(?:docs\/)?(hub\.md|multiplayer\.md|HANDOFF\.md)#([^)]+)\)/g)) {
    const doc = m[1] ?? '';
    const anchor = m[2] ?? '';
    if (!targets.get(doc)?.has(anchor)) {
      console.warn(`! ${file}: link to ${doc}#${anchor} no longer resolves`);
      broken++;
    }
  }
}
console.log(`Docs synced from ${host}${broken ? `; ${broken} kit doc link(s) to fix` : ''}`);
