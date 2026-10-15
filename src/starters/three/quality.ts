/**
 * three.js starter: quality presets, picked from the device (dinodasher render/quality.ts).
 * (STARTER: tune the presets for your scene.)
 *
 * Order: `?q=low|medium|high` → the player's saved choice → a guess from the
 * GPU name, touch and memory.
 */
import { localStore } from '../../kit/core/store.ts';

/** A quality level. */
export type Quality = 'low' | 'medium' | 'high';

/** What each level turns on. */
export type QualityPreset = { pixelRatio: number; shadows: boolean; antialiasPass: boolean; bloom: boolean };

export const PRESETS: Record<Quality, QualityPreset> = {
  low: { pixelRatio: 1, shadows: false, antialiasPass: true, bloom: false },
  medium: { pixelRatio: 1.5, shadows: true, antialiasPass: false, bloom: false },
  high: { pixelRatio: 2, shadows: true, antialiasPass: false, bloom: true },
};

const isQuality = (x: string | null | undefined): x is Quality => x === 'low' || x === 'medium' || x === 'high';

/** A guess from the device: weak GPUs, phones with little memory → low. */
export function guessQuality(o: { gpu: string; touch: boolean; memoryGb: number | undefined }): Quality {
  const gpu = o.gpu.toLowerCase();
  if (/swiftshader|llvmpipe|basic render|mali-4|adreno \(tm\) [3-5]\d\d|powervr/.test(gpu)) return 'low';
  if (o.touch && (o.memoryGb ?? 4) <= 4) return 'low';
  if (o.touch || /intel/.test(gpu)) return 'medium';
  return 'high';
}

/** The GPU's name, when the browser tells (WEBGL_debug_renderer_info). */
export function gpuName(gl: WebGLRenderingContext | WebGL2RenderingContext): string {
  const ext = gl.getExtension('WEBGL_debug_renderer_info');
  const name: unknown = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : '';
  return typeof name === 'string' ? name : '';
}

/** The quality to use: `?q=`, the saved choice, else the guess. */
export function pickQuality(slug: string, guess: () => Quality, search: string = location.search): Quality {
  const q = new URLSearchParams(search).get('q');
  if (isQuality(q)) return q;
  const saved = localStore.getText(`${slug}:quality`);
  return isQuality(saved) ? saved : guess();
}

/** Remember the player's choice. */
export function saveQuality(slug: string, q: Quality): void {
  localStore.setText(`${slug}:quality`, q);
}
