// @vitest-environment jsdom
// kit/ui share: the share sheet, else the clipboard and a toast, else the dialog with the link to copy by hand.
import { beforeEach, describe, expect, it } from 'vitest';
import { mountUi } from '../../../src/kit/ui/root.ts';
import { shareLink } from '../../../src/kit/ui/share.ts';

const link = { url: 'https://example.test/game/?hub_turn_link=k', title: 'My Game', text: 'Come play!' };

describe('kit/ui share', () => {
  beforeEach(() => {
    document.body.replaceChildren();
    mountUi();
  });

  it('uses the share sheet when there is one; closing it is not a failure', async () => {
    const shared: ShareData[] = [];
    expect(
      await shareLink(link, {
        share: (d) => {
          shared.push(d);
          return Promise.resolve();
        },
      }),
    ).toBe('shared');
    expect(shared[0]?.url).toBe(link.url);
    const abort = (): Promise<void> => Promise.reject(new DOMException('no', 'AbortError'));
    expect(await shareLink(link, { share: abort, writeText: () => Promise.resolve() })).toBe('cancelled');
  });

  it('falls back to the clipboard (and says so), then to a dialog with the link selected', async () => {
    const copied: string[] = [];
    const broken = (): Promise<void> => Promise.reject(new Error('not allowed'));
    expect(
      await shareLink(link, {
        share: broken,
        writeText: (text) => {
          copied.push(text);
          return Promise.resolve();
        },
      }),
    ).toBe('copied');
    expect(copied).toEqual([link.url]);
    expect(document.querySelector('.kit-toast')?.textContent).toContain('copied');
    expect(await shareLink(link, { writeText: broken })).toBe('manual');
    const field = document.querySelector<HTMLInputElement>('[data-testid="share-field"]');
    expect(field?.value).toBe(link.url);
    expect(field?.readOnly).toBe(true);
  });
});
