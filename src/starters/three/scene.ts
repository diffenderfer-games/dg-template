/**
 * three.js starter: the example scene, "collect the orbs" (the coin game in 3D). (STARTER: replace it.)
 *
 * The arena is the game's (1600 × 1000 units) mapped onto a 16 × 10 plane;
 * the camera eases after the player.
 */
import {
  BoxGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  SphereGeometry,
  TorusGeometry,
  Vector3,
} from 'three';
import { ARENA } from '../../game/config.ts';
import type { Run } from '../../game/state.ts';
import type { ThreeStage } from './stage.ts';

/** Game units → world units. */
const UNIT = 0.01;

/** The scene's objects. */
export type OrbScene = { draw(run: Run | null, t: number): void; burst(at: { x: number; y: number }): void };

/** Build the scene into the stage. */
export function createOrbScene(stage: ThreeStage): OrbScene {
  const root = new Group();
  stage.scene.add(root);
  const w = ARENA.width * UNIT;
  const d = ARENA.height * UNIT;
  const floor = new Mesh(new PlaneGeometry(w, d), new MeshStandardMaterial({ color: 0x1b2230, roughness: 0.9 }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  root.add(floor);
  const rim = new Mesh(new BoxGeometry(w + 0.4, 0.2, d + 0.4), new MeshStandardMaterial({ color: 0x2a3142 }));
  rim.position.y = -0.11;
  root.add(rim);
  const player = new Mesh(
    new BoxGeometry(0.6, 0.6, 0.6),
    new MeshStandardMaterial({ color: 0xff5f3b, roughness: 0.4 }),
  );
  player.castShadow = true;
  root.add(player);
  const orb = new Mesh(
    new SphereGeometry(0.24, 24, 16),
    new MeshStandardMaterial({ color: 0x38d6ff, emissive: 0x1593b8, emissiveIntensity: 1.4, roughness: 0.2 }),
  );
  orb.castShadow = true;
  root.add(orb);
  const ring = new Mesh(
    new TorusGeometry(0.4, 0.05, 8, 32),
    new MeshStandardMaterial({ color: 0xc8f4ff, emissive: 0xc8f4ff }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.visible = false;
  root.add(ring);
  let ringLife = 0;
  const toWorld = (p: { x: number; y: number }, y: number): Vector3 =>
    new Vector3((p.x - ARENA.width / 2) * UNIT, y, (p.y - ARENA.height / 2) * UNIT);
  const look = new Vector3();
  stage.camera.position.set(0, 14, 11);
  return {
    draw(run, t) {
      const r = run ?? {
        player: { x: ARENA.width / 2 + Math.cos(t) * 200, y: ARENA.height / 2 },
        coin: { x: ARENA.width / 2, y: ARENA.height / 2 - 160 },
      };
      player.position.copy(toWorld(r.player, 0.3));
      player.rotation.y = t * 0.8;
      orb.position.copy(toWorld(r.coin, 0.45 + Math.sin(t * 3) * 0.08));
      const target = toWorld(r.player, 0).multiplyScalar(0.25);
      look.lerp(target, 0.08);
      stage.camera.position.lerp(new Vector3(look.x, 14, look.z + 11), 0.08);
      stage.camera.lookAt(look);
      if (ringLife > 0) {
        ringLife -= 1 / 60;
        ring.scale.setScalar(1 + (0.5 - ringLife) * 4);
        ring.visible = ringLife > 0;
      }
      stage.render();
    },
    burst(at) {
      ring.position.copy(toWorld(at, 0.3));
      ringLife = 0.5;
      ring.visible = true;
    },
  };
}
