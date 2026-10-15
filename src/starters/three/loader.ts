/**
 * three.js starter: loading models and textures under `/<slug>/`, and warming shaders up.
 * (STARTER: the four 3D games so far are procedural; this is the example for when you add art.)
 */
import { TextureLoader, type Camera, type Scene, type Texture, type WebGLRenderer } from 'three';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';

/** A URL under the game's base (works at `/<slug>/`; HANDOFF.md § Path-handling). */
export const asset = (path: string): string => `${import.meta.env.BASE_URL}${path.replace(/^\//, '')}`;

/** Load a glTF model (`asset('models/hero.glb')`), reporting progress 0..1. */
export function loadModel(path: string, onProgress: (p: number) => void = () => undefined): Promise<GLTF> {
  return new GLTFLoader().loadAsync(asset(path), (e) => onProgress(e.total > 0 ? e.loaded / e.total : 0));
}

/** Load a texture. */
export function loadTexture(path: string): Promise<Texture> {
  return new TextureLoader().loadAsync(asset(path));
}

/** Compile every material now, so the first frame of play doesn't stutter (dinodasher Game.warmup). */
export async function warmup(renderer: WebGLRenderer, scene: Scene, camera: Camera): Promise<void> {
  await renderer.compileAsync(scene, camera);
}
