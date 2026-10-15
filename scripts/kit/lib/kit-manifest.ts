/**
 * scripts/kit/lib: kit.json, the kit's version and a hash per file.
 * Source: dg-template scripts/kit/ (kit v1.0). Copy byte-identical; change it in the template first.
 * Docs: docs/kit/README.md § "Keeping up to date"
 *
 *   { "kitVersion": "1.0", "modules": { "core": { "version": "1.0", "files": { "src/kit/core/clock.ts": "<sha256>" } } } }
 *
 * Hashes are of the text with line endings normalised to LF, so a Windows
 * checkout (CRLF) and the template agree.
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { isRecord, readJsonFile, str, type JsonRecord } from './json-file.ts';

/** One module's version and file hashes. */
export type KitModuleEntry = { version: string; files: Record<string, string> };

/** The whole manifest. */
export type KitManifest = { kitVersion: string; modules: Record<string, KitModuleEntry> };

/** sha256 of a file's text with CRLF normalised to LF. */
export function hashText(text: string): string {
  return createHash('sha256').update(text.replace(/\r\n/g, '\n')).digest('hex');
}

/** sha256 of a file on disk (LF-normalised), or null when missing. */
export function hashFile(path: string): string | null {
  return existsSync(path) ? hashText(readFileSync(path, 'utf8')) : null;
}

/** Read `kit.json` from `root` (null when there is none). */
export function readKitManifest(root: string): KitManifest | null {
  const path = join(root, 'kit.json');
  if (!existsSync(path)) return null;
  return toKitManifest(readJsonFile(path));
}

/** Parse kit.json text (null when it isn't a JSON object). */
export function parseKitManifest(text: string): KitManifest | null {
  const raw: unknown = JSON.parse(text);
  return isRecord(raw) ? toKitManifest(raw) : null;
}

function toKitManifest(raw: JsonRecord): KitManifest {
  const modules: Record<string, KitModuleEntry> = {};
  const rawModules = raw.modules;
  if (isRecord(rawModules)) {
    for (const [name, m] of Object.entries(rawModules)) {
      if (!isRecord(m) || !isRecord(m.files)) continue;
      const files: Record<string, string> = {};
      for (const [file, hash] of Object.entries(m.files)) if (typeof hash === 'string') files[file] = hash;
      modules[name] = { version: str(m.version) ?? '0.0', files };
    }
  }
  return { kitVersion: str(raw.kitVersion) ?? '0.0', modules };
}

/** Write `kit.json` (sorted, stable, LF). */
export function writeKitManifest(root: string, manifest: KitManifest): void {
  const modules: Record<string, KitModuleEntry> = {};
  for (const name of Object.keys(manifest.modules).sort()) {
    const m = manifest.modules[name];
    if (!m) continue;
    const files: Record<string, string> = {};
    for (const f of Object.keys(m.files).sort()) {
      const h = m.files[f];
      if (h !== undefined) files[f] = h;
    }
    modules[name] = { version: m.version, files };
  }
  writeFileSync(join(root, 'kit.json'), `${JSON.stringify({ kitVersion: manifest.kitVersion, modules }, null, 2)}\n`);
}

/** Compare `a.b` versions numerically (-1, 0, 1). */
export function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return Math.sign(d);
  }
  return 0;
}

/** The files of a module whose hash differs from the manifest (edited) or that are missing. */
export function driftedFiles(root: string, entry: KitModuleEntry): { edited: string[]; missing: string[] } {
  const edited: string[] = [];
  const missing: string[] = [];
  for (const [file, hash] of Object.entries(entry.files)) {
    const actual = hashFile(join(root, file));
    if (actual === null) missing.push(file);
    else if (actual !== hash) edited.push(file);
  }
  return { edited, missing };
}
