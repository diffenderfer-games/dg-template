/**
 * kit/boot: joining others: Join with a code (a live room's 5-letter code, or an online game's invite link)
 * in the online choosers, and the "Looking for a game…" sheet while Anyone / Play now finds one.
 * Source: dg-template src/kit/boot/ (kit v1.0). Copy byte-identical; change it in the template first.
 * Docs: docs/kit/playing-together.md § "Joining"
 */
import { t } from '../core/strings.ts';
import { button } from '../ui/controls.ts';
import { h } from '../ui/dom.ts';
import { openModal, type ModalHandle } from '../ui/modal.ts';
import { toast } from '../ui/toast.ts';

/** What a typed code joins. */
export type JoinTarget = { kind: 'room'; code: string } | { kind: 'turn'; key: string };

/** Which kinds this game can join: live rooms (`game.multiplayer`), online games the hub runs (`game.turns`). */
export type JoinKinds = { rooms: boolean; turns: boolean };

/** The hub's room codes: 5 letters and digits without look-alikes (no I, O, 0, 1). */
const ROOM_CODE = /^[A-HJ-NP-Z2-9]{5}$/;
/** An online game's invite link carries its key as `?hub_turn_link=` (TURN_LINK_PARAM). */
const TURN_LINK = /[?&#]hub_turn_link=([A-Za-z0-9_-]{8,})/;
/** A bare invite key (what follows `hub_turn_link=`). */
const TURN_KEY = /^[A-Za-z0-9_-]{12,}$/;

/** Read what the player typed or pasted: a room code, an invite link or its key; null when it is neither. */
export function parseJoinCode(text: string, kinds: JoinKinds): JoinTarget | null {
  const typed = text.trim();
  if (typed === '') return null;
  const code = typed.toUpperCase().replace(/[\s-]/g, '');
  if (kinds.rooms && ROOM_CODE.test(code)) return { kind: 'room', code };
  if (!kinds.turns) return null;
  const link = TURN_LINK.exec(typed);
  if (link?.[1] !== undefined) return { kind: 'turn', key: link[1] };
  return TURN_KEY.test(typed) ? { kind: 'turn', key: typed } : null;
}

/** The Join with a code row: a text box and Join (`join-code`, `join-code-go`); a bad code shakes and says so. */
export function joinCodeForm(kinds: JoinKinds, go: (target: JoinTarget) => void): HTMLElement {
  const hint = kinds.rooms && kinds.turns ? t('joinCodeAny') : kinds.rooms ? t('joinCodeRoom') : t('joinCodeLink');
  const input = h('input.kit-chat-input', {
    type: 'text',
    placeholder: hint,
    'aria-label': hint,
    autocomplete: 'off',
    autocapitalize: kinds.turns ? 'off' : 'characters',
    spellcheck: 'false',
    enterkeyhint: 'go',
    'data-nav': true,
    'data-testid': 'join-code',
  });
  const submit = (): void => {
    const target = parseJoinCode(input.value, kinds);
    if (target === null) {
      toast(t('joinCodeBad'), { kind: 'warn' });
      input.focus();
      return;
    }
    go(target);
  };
  input.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    submit();
  });
  return h(
    'div.kit-join-code',
    {},
    h('p.kit-join-label', {}, t('joinCodeLabel')),
    h('div.kit-chat-form', {}, input, button(t('join'), submit, { testid: 'join-code-go' })),
  );
}

/** "Looking for a game…" (`looking`), locked while Anyone / Play now finds a game; close it when done. */
export function lookingSheet(): ModalHandle {
  return openModal({
    title: t('lookingForGame'),
    testid: 'looking',
    locked: true,
    body: h('div.kit-looking', { 'aria-busy': 'true' }, h('span.kit-spinner', { 'aria-hidden': 'true' })),
  });
}
