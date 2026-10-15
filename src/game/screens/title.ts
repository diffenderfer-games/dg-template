/**
 * The title screen's decorations, on top of the kit's title (buttons, Continue). (GAME: yours to edit.)
 */
import type { GameContext, TitleInfo } from '../../kit/boot/index.ts';
import { h } from '../../kit/ui/dom.ts';
import type { Profile, Run } from '../state.ts';
import { HUD } from '../strings.ts';

/** TODO(game): your title art. The best score line updates when the profile loads. */
export function title(ctx: GameContext<Profile, Run>, el: HTMLElement, _info: TitleInfo): void {
  const best = h('p.kit-tagline', { 'data-testid': 'title-best' }, HUD.best(ctx.profile.data.best));
  el.querySelector('.kit-menu')?.before(best);
  const off = ctx.profile.onChange((p) => {
    if (!best.isConnected) return off();
    best.textContent = HUD.best(p.best);
  });
}
