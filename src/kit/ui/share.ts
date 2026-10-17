/**
 * kit/ui: handing a link on (an online game's invite link): the browser's share sheet, else the
 * clipboard, else a dialog with the link to copy by hand.
 * Source: dg-template src/kit/ui/ (kit v1.9). Copy byte-identical; change it in the template first.
 * Docs: docs/kit/ui.md § "Sharing a link"
 *
 * The same chain as the hub's own share buttons (the runtime's share-link.ts):
 * 1. `navigator.share` where there is one; the player closing the sheet
 *    (`AbortError`) ends there;
 * 2. otherwise, or when the sheet fails, the clipboard and a toast;
 * 3. when the clipboard is missing or refuses too, a dialog with the link in a
 *    read-only, preselected field and a Copy button (never `window.prompt`:
 *    embedded pages block it).
 */
import { t } from '../core/strings.ts';
import { h } from './dom.ts';
import { openModal } from './modal.ts';
import { toast } from './toast.ts';

/** A link to hand on. */
export type SharedLink = { url: string; title: string; text?: string };

/** How a share ended. */
export type ShareOutcome = 'shared' | 'cancelled' | 'copied' | 'manual';

/** What the share chain uses of the browser (a test passes a fake). */
export type ShareHost = {
  share?: (data: ShareData) => Promise<void>;
  writeText?: (text: string) => Promise<void>;
};

/** The browser's share sheet and clipboard, where there are any. */
function browserHost(): ShareHost {
  if (typeof navigator === 'undefined') return {};
  const nav = navigator;
  return {
    ...(typeof nav.share === 'function' ? { share: (data: ShareData) => nav.share(data) } : {}),
    ...(nav.clipboard === undefined ? {} : { writeText: (text: string) => nav.clipboard.writeText(text) }),
  };
}

/** Write `text` to the clipboard; whether it worked (none on an insecure page). */
async function copy(host: ShareHost, text: string): Promise<boolean> {
  if (host.writeText === undefined) return false;
  try {
    await host.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/** Select all of a field's text (`setSelectionRange` too: iOS ignores `select()` on a read-only field). */
function selectAll(field: HTMLInputElement): void {
  field.select();
  field.setSelectionRange(0, field.value.length);
}

/** The dialog with the link to copy by hand. */
function manualDialog(link: SharedLink, host: ShareHost): void {
  const field = h('input.kit-share-field', { type: 'text', 'data-testid': 'share-field', 'aria-label': link.title });
  field.value = link.url;
  field.readOnly = true;
  field.addEventListener('focus', () => selectAll(field));
  field.addEventListener('click', () => selectAll(field));
  const note = h('p.kit-tagline.kit-share-note', { 'aria-live': 'polite' }, t('shareSelect'));
  openModal({
    title: link.title,
    testid: 'share-dialog',
    body: h('div.kit-share', {}, note, field),
    buttons: [
      {
        label: t('shareCopy'),
        primary: true,
        keepOpen: true,
        testid: 'share-copy',
        onClick: () =>
          void copy(host, field.value).then((ok) => {
            selectAll(field);
            note.textContent = ok ? t('turnsLinkCopied') : t('shareSelect');
          }),
      },
      { label: t('close'), testid: 'share-close' },
    ],
  });
  selectAll(field);
}

/** Hand `link` on: the share sheet, else the clipboard (a toast says so), else the dialog. */
export async function shareLink(link: SharedLink, host: ShareHost = browserHost()): Promise<ShareOutcome> {
  if (host.share !== undefined) {
    try {
      await host.share(link.text === undefined ? { title: link.title, url: link.url } : { ...link });
      return 'shared';
    } catch (failure) {
      if (failure instanceof DOMException && failure.name === 'AbortError') return 'cancelled';
    }
  }
  if (await copy(host, link.url)) {
    toast(t('turnsLinkCopied'));
    return 'copied';
  }
  manualDialog(link, host);
  return 'manual';
}
