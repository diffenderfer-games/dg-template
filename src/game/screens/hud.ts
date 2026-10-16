/**
 * The HUD over play (DOM, in the kit's play screen). (GAME: yours to edit.)
 *
 * Update text only when it changes: this runs every frame.
 */
import type { HudHooks } from '../../kit/boot/index.ts';
import { h } from '../../kit/ui/dom.ts';
import type { Profile, Run } from '../state.ts';
import { HUD } from '../strings.ts';

let score: HTMLElement | null = null;

/** TODO(game): what your HUD shows (time left, lives, the level…). */
export const hud: HudHooks<Profile, Run> = {
  mount(_ctx, el) {
    score = h('span', { 'data-testid': 'hud-score' });
    el.append(score);
  },
  update(_ctx, run) {
    const s = HUD.score(run.score);
    if (score && score.textContent !== s) score.textContent = s;
  },
};
