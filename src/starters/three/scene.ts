/**
 * three.js starter: the scene. (STARTER: build your game here.)
 *
 * TODO(game): your scene. Build meshes once (in `createScene`) and move them in
 * `draw`; the stage gives the renderer, scene, camera, lights and bloom. The
 * placeholder is a floor and a cube that turns, so you can see it run.
 */
import { BoxGeometry, Mesh, MeshStandardMaterial, PlaneGeometry } from 'three';
import type { OnlineView, Run } from '../../game/state.ts';
import type { ThreeStage } from './stage.ts';

/** The scene's objects. */
export type StarterScene = {
  draw(run: Run | null, t: number): void;
  drawOnline(view: OnlineView | null, me: number, t: number): void;
};

/** Build the scene into the stage. */
export function createScene(stage: ThreeStage): StarterScene {
  const floor = new Mesh(new PlaneGeometry(16, 10), new MeshStandardMaterial({ color: 0x1b2230, roughness: 0.9 }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  const cube = new Mesh(new BoxGeometry(1, 1, 1), new MeshStandardMaterial({ color: 0xff5f3b, roughness: 0.4 }));
  cube.position.y = 0.8;
  cube.castShadow = true;
  stage.scene.add(floor, cube);
  stage.camera.position.set(0, 6, 9);
  stage.camera.lookAt(0, 0.5, 0);
  const draw = (t: number): void => {
    cube.rotation.y = t * 0.8;
    stage.render();
  };
  return {
    draw: (_run, t) => draw(t),
    drawOnline: (_view, _me, t) => draw(t),
  };
}
