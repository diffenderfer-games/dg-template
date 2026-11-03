/**
 * kit/boot: the Rematch panel on an online game's result screen.
 * Source: dg-template src/kit/boot/ (kit v1.35). Copy byte-identical; change it in the template first.
 * Docs: docs/kit/online.md § "Rematch"
 *
 * Rematch (`rematch`) joins the ended room's rematch room, or starts it (the first to press hosts it).
 * Once someone started one it reads Join rematch, with who started it and how many are in. When the
 * hub closes the old room the panel says so and the button goes.
 */
import type { RoomInfo, RoomSeat } from '@diffenderfer-games/hub';
import { t } from '../core/strings.ts';
import { errText } from '../online/errors.ts';
import { rematchOf } from '../online/ready.ts';
import { button } from '../ui/controls.ts';
import { h } from '../ui/dom.ts';
import { toast } from '../ui/toast.ts';

/** The panel and how to keep it current. */
export type RematchPanel = {
  readonly el: HTMLElement;
  /** The old room changed (null: it closed). */
  update(info: RoomInfo | null): void;
};

/** A seat's name in the old room, or "Someone". */
export function nameIn(seats: readonly RoomSeat[], userId: number): string {
  return seats.find((s) => s.userId === userId)?.name ?? t('someone');
}

/** The panel; `press` joins (or starts) the rematch and moves the player to its lobby. */
export function rematchPanel(o: { me: number; seats: readonly RoomSeat[]; press: () => Promise<void> }): RematchPanel {
  let label = t('rematch');
  let busy = false;
  const line = h('p.kit-rematch-line', { 'data-testid': 'rematch-line', 'aria-live': 'polite' });
  const btn = button(
    label,
    () => {
      if (busy) return;
      busy = true;
      paint(t('rematchJoining'), true);
      o.press().then(
        () => undefined,
        (e: unknown) => {
          busy = false;
          paint(label, false);
          toast(errText(e), { kind: 'warn' });
        },
      );
    },
    { cls: 'kit-primary kit-rematch-btn', testid: 'rematch', sub: t('rematchSub') },
  );
  const paint = (words: string, disabled: boolean): void => {
    const el = btn.querySelector('.kit-btn-label');
    if (el) el.textContent = words;
    btn.disabled = disabled;
  };
  const el = h('div.kit-rematch', { 'data-testid': 'rematch-panel' }, line, btn);
  return {
    el,
    update(info) {
      if (info === null) {
        line.textContent = t('rematchClosed');
        btn.remove();
        el.dataset.closed = 'true';
        return;
      }
      const r = rematchOf(info);
      const joinIt = r !== null && !r.userIds.includes(o.me);
      label = joinIt ? t('rematchJoin') : t('rematch');
      line.textContent =
        r === null ? '' : t('rematchStarted', { name: nameIn(o.seats, r.hostId), n: r.userIds.length });
      if (!busy) paint(label, false);
    },
  };
}
