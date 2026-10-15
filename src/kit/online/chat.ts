/**
 * kit/online: room chat, the kid-safe way (phase10 chat.ts, clue online/chat.ts).
 * Source: dg-template src/kit/online/ (kit v1.0). Copy byte-identical; change it in the template first.
 * Docs: docs/kit/online.md § "Chat"; the rules: multiplayer.md §10
 *
 * - Only delivered text is shown (the line the hub sends back, maybe softened ✨),
 *   always as text, never HTML.
 * - A rejected message keeps the draft and shows the hub's hint, with a
 *   countdown when it says when to try again.
 * - `chatMode`: `on` (text box + quick chips), `quick` (chips only), `off` (hidden).
 */
import type { ChatMode, HubRoom } from '@diffenderfer-games/hub';
import { numField, strField } from '../core/json.ts';
import { t } from '../core/strings.ts';
import { h } from '../ui/dom.ts';

/** The quick-chat phrases (the hub's ids). */
export const QUICK_PHRASES: readonly { id: string; label: string }[] = [
  { id: 'gg', label: 'Good game!' },
  { id: 'nice', label: 'Nice!' },
  { id: 'hi', label: 'Hi!' },
  { id: 'e:👍', label: '👍' },
];

/** What a send did. */
export type SendResult = { ok: true; softened: boolean } | { ok: false; hint: string; retryAfterMs: number };

/** Send `text` (null draft: a quick phrase). */
export async function sendChat(room: Pick<HubRoom, 'chat'>, text: string): Promise<SendResult> {
  try {
    const delivered = await room.chat(text);
    return { ok: true, softened: delivered !== text };
  } catch (e) {
    const hint = strField(e, 'hint') || t('chatRejected');
    return { ok: false, hint, retryAfterMs: numField(e, 'retryAfterMs') };
  }
}

/** A chat panel for a room: lines, the text box (mode `on`) and quick chips (`on`/`quick`); nothing for `off`. */
export function chatPanel(
  room: Pick<HubRoom, 'chat' | 'quick' | 'on'>,
  mode: ChatMode,
  nameOf: (userId: number) => string,
): HTMLElement {
  const lines = h('div.kit-chat-lines', { 'data-testid': 'chat-lines', role: 'log' });
  const note = h('div.kit-chat-note', { 'data-testid': 'chat-note', 'aria-live': 'polite' });
  const panel = h('div.kit-chat', { 'data-testid': 'chat', 'data-mode': mode }, lines, note);
  if (mode === 'off') {
    panel.hidden = true;
    return panel;
  }
  room.on('chat', (line) => {
    lines.append(h('p', {}, h('strong', {}, `${nameOf(line.from)}: `), line.text));
  });
  const chips = h(
    'div.kit-chat-chips',
    {},
    ...QUICK_PHRASES.map((q) =>
      h(
        'button.kit-btn',
        { type: 'button', 'data-nav': true, 'data-testid': `quick-${q.id}`, onclick: () => void room.quick(q.id) },
        q.label,
      ),
    ),
  );
  panel.append(chips);
  if (mode === 'on') {
    const input = h('input.kit-chat-input', {
      type: 'text',
      maxlength: 200,
      placeholder: t('chatPlaceholder'),
      'data-testid': 'chat-input',
      'data-nav': true,
    });
    const send = async (): Promise<void> => {
      const text = input.value.trim();
      if (text === '') return;
      const r = await sendChat(room, text);
      if (r.ok) {
        input.value = '';
        note.textContent = r.softened ? t('chatSoftened') : '';
      } else {
        note.textContent =
          r.retryAfterMs > 0 ? `${r.hint} ${t('chatRetry', { seconds: Math.ceil(r.retryAfterMs / 1000) })}` : r.hint;
      }
    };
    panel.append(
      h(
        'form.kit-chat-form',
        {
          onsubmit: (e: Event) => {
            e.preventDefault();
            void send();
          },
        },
        input,
        h('button.kit-btn', { type: 'submit', 'data-nav': true, 'data-testid': 'chat-send' }, t('chatSend')),
      ),
    );
  }
  return panel;
}
