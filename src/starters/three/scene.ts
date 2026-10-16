/**
 * three.js starter: a placeholder scene. (STARTER: replace it with your game.)
 *
 * A glowing orb over a floor that hops when the player scores, with a ring
 * of beads that fills toward the target. Online, one pillar per player grows
 * with their score.
 */
import { BoxGeometry, Group, Mesh, MeshStandardMaterial, PlaneGeometry, SphereGeometry, type Material } from 'three';
import type { OnlineView, Run } from '../../game/state.ts';
import type { ThreeStage } from './stage.ts';

/** The scene's objects. */
export type StarterScene = {
  draw(run: Run | null, t: number): void;
  drawOnline(view: OnlineView | null, me: number, t: number): void;
  pop(): void;
};

const BEADS = 24;

/** Build the scene into the stage. */
export function createStarterScene(stage: ThreeStage): StarterScene {
  const root = new Group();
  stage.scene.add(root);
  const floor = new Mesh(new PlaneGeometry(16, 10), new MeshStandardMaterial({ color: 0x1b2230, roughness: 0.9 }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  root.add(floor);
  const orb = new Mesh(
    new SphereGeometry(1, 32, 24),
    new MeshStandardMaterial({ color: 0xff5f3b, emissive: 0x80250f, emissiveIntensity: 0.8, roughness: 0.3 }),
  );
  orb.castShadow = true;
  root.add(orb);
  const lit = new MeshStandardMaterial({ color: 0x38d6ff, emissive: 0x1593b8, emissiveIntensity: 1.4 });
  const dim = new MeshStandardMaterial({ color: 0x2a3142 });
  const beadGeo = new SphereGeometry(0.16, 12, 8);
  const beads = Array.from({ length: BEADS }, (_, i) => {
    const a = (i / BEADS) * Math.PI * 2;
    const m = new Mesh(beadGeo, dim);
    m.position.set(Math.cos(a) * 2.6, 0.2, Math.sin(a) * 2.6);
    root.add(m);
    return m;
  });
  const pillarGeo = new BoxGeometry(0.8, 1, 0.8);
  const mine = new MeshStandardMaterial({ color: 0xff5f3b });
  const theirs = new MeshStandardMaterial({ color: 0xffd166 });
  const pillars: Mesh[] = [];
  const pillar = (i: number, mat: Material): Mesh => {
    let m = pillars[i];
    if (!m) {
      m = new Mesh(pillarGeo, mat);
      root.add(m);
      pillars[i] = m;
    }
    m.material = mat;
    return m;
  };
  let hop = 0;
  stage.camera.position.set(0, 7, 9);
  stage.camera.lookAt(0, 0.8, 0);
  return {
    draw(run, t) {
      hop = Math.max(0, hop - 1 / 60);
      orb.visible = true;
      orb.position.set(0, 1.2 + Math.sin(t * 2) * 0.1 + Math.sin(hop * Math.PI * 3.3) * hop * 2, 0);
      orb.rotation.y = t * 0.6;
      const filled = run === null ? 0 : run.target > 0 ? (run.score / run.target) * BEADS : run.score % (BEADS + 1);
      beads.forEach((b, i) => {
        b.visible = true;
        b.material = i < filled ? lit : dim;
      });
      pillars.forEach((p) => (p.visible = false));
      stage.render();
    },
    drawOnline(view, me) {
      orb.visible = false;
      beads.forEach((b) => (b.visible = false));
      const players = view?.players ?? [];
      players.forEach((p, i) => {
        const m = pillar(i, p.id === me ? mine : theirs);
        const height = 0.1 + (p.score / Math.max(1, view?.target ?? 1)) * 5;
        m.visible = true;
        m.scale.set(1, height, 1);
        m.position.set((i - (players.length - 1) / 2) * 2, height / 2, 0);
      });
      pillars.slice(players.length).forEach((m) => (m.visible = false));
      stage.render();
    },
    pop() {
      hop = 0.3;
    },
  };
}
