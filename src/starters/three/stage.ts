/**
 * three.js starter: renderer, scene, lights, camera, resize and quality (dinodasher Stage, baseball-typer scene).
 * (STARTER: `npm run new-game -- --renderer three` copies this folder into src/game/render/.)
 *
 * - WebGLRenderer, sRGB output, ACES tone mapping, a hemisphere + a
 *   directional light (soft shadows off on `low`), a PMREM room environment.
 * - Bloom (high quality) through EffectComposer: Render → Bloom → Output.
 * - A ResizeObserver on the host (neither source game had one), and a wider
 *   lens on portrait phones (`updateFov`).
 * - The kit's loop drives frames: call `render()` once per frame.
 * - `preserveDrawingBuffer` only for screenshots (`?shot`, `__HUB_TEST__`): it costs speed.
 */
import {
  ACESFilmicToneMapping,
  Color,
  DirectionalLight,
  HemisphereLight,
  PCFShadowMap,
  PerspectiveCamera,
  PMREMGenerator,
  Scene,
  SRGBColorSpace,
  Vector2,
  WebGLRenderer,
} from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { isShotMode, isTestHarness } from '../../kit/core/env.ts';
import { AdaptiveResolution } from './adaptive.ts';
import { gpuName, guessQuality, pickQuality, PRESETS, type Quality } from './quality.ts';

/** The three.js stage. */
export type ThreeStage = {
  readonly renderer: WebGLRenderer;
  readonly scene: Scene;
  readonly camera: PerspectiveCamera;
  readonly sun: DirectionalLight;
  readonly quality: Quality;
  /** Draw one frame (and adapt the resolution). */
  render(): void;
  dispose(): void;
};

/** The base field of view; portrait screens get a wider one so the arena still fits. */
const BASE_FOV = 50;

/** A wider lens on portrait screens (dinodasher updateFov, baseball-typer fitFov). */
export function fovFor(aspect: number): number {
  if (aspect >= 1) return BASE_FOV;
  const h = 2 * Math.atan(Math.tan((BASE_FOV * Math.PI) / 360) / aspect);
  return Math.min(90, (h * 180) / Math.PI);
}

/** `navigator.deviceMemory` (Chrome only; not in the DOM types). */
function deviceMemory(): number | undefined {
  const mem: unknown = Reflect.get(navigator, 'deviceMemory');
  return typeof mem === 'number' ? mem : undefined;
}

/** Create the stage inside `host`. */
export function createThreeStage(host: HTMLElement, slug: string): ThreeStage {
  const renderer = new WebGLRenderer({
    antialias: false,
    powerPreference: 'high-performance',
    preserveDrawingBuffer: isShotMode() || isTestHarness(),
  });
  const quality = pickQuality(slug, () =>
    guessQuality({ gpu: gpuName(renderer.getContext()), touch: 'ontouchstart' in window, memoryGb: deviceMemory() }),
  );
  const preset = PRESETS[quality];
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.shadowMap.enabled = preset.shadows;
  renderer.shadowMap.type = PCFShadowMap;
  renderer.setPixelRatio(Math.min(preset.pixelRatio, window.devicePixelRatio || 1));
  host.appendChild(renderer.domElement);
  renderer.domElement.style.display = 'block';

  const scene = new Scene();
  scene.background = new Color(
    getComputedStyle(document.documentElement).getPropertyValue('--kit-bg').trim() || '#0d0f14',
  );
  const pmrem = new PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.add(new HemisphereLight(0xdde8ff, 0x202830, 0.9));
  const sun = new DirectionalLight(0xffffff, 1.6);
  sun.position.set(6, 12, 8);
  sun.castShadow = preset.shadows;
  sun.shadow.mapSize.set(1024, 1024);
  scene.add(sun);

  const camera = new PerspectiveCamera(BASE_FOV, 1, 0.1, 200);
  let composer: EffectComposer | null = null;
  let bloom: UnrealBloomPass | null = null;
  if (preset.bloom) {
    composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    bloom = new UnrealBloomPass(new Vector2(1, 1), 0.6, 0.4, 0.85);
    composer.addPass(bloom);
    composer.addPass(new OutputPass());
  }

  const resize = (): void => {
    const w = host.clientWidth || innerWidth;
    const h = host.clientHeight || innerHeight;
    renderer.setSize(w, h, false);
    renderer.domElement.style.width = `${w}px`;
    renderer.domElement.style.height = `${h}px`;
    composer?.setSize(w, h);
    bloom?.resolution.set(w, h);
    camera.aspect = w / h;
    camera.fov = fovFor(camera.aspect);
    camera.updateProjectionMatrix();
  };
  const observer = new ResizeObserver(resize);
  observer.observe(host);
  resize();

  const adaptive = new AdaptiveResolution({
    min: 0.75,
    max: Math.min(preset.pixelRatio, window.devicePixelRatio || 1),
  });
  let last = performance.now();
  return {
    renderer,
    scene,
    camera,
    sun,
    quality,
    render() {
      const now = performance.now();
      const ratio = adaptive.sample(now - last);
      last = now;
      if (ratio !== null) {
        renderer.setPixelRatio(ratio);
        resize();
      }
      if (composer) composer.render();
      else renderer.render(scene, camera);
    },
    dispose() {
      observer.disconnect();
      pmrem.dispose();
      renderer.dispose();
    },
  };
}
