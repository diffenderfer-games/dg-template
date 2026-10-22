/**
 * kit/ui: modal sheets (settings, confirm, how to play), lockable.
 * Source: dg-template src/kit/ui/ (kit v1.0). Copy byte-identical; change it in the template first.
 * Docs: docs/kit/ui.md § "Modals"
 *
 * The topmost `[data-modal]` is what menu navigation targets (kit/input
 * `navTargets`). Escape and the back button close it, unless it is `locked`
 * (phase10 locked modals: a choice the game is waiting on).
 */
import { button } from './controls.ts';
import { h, type Child } from './dom.ts';
import { ui } from './root.ts';

/** A button in a modal's footer. */
export type ModalButton = {
  label: string;
  onClick?: () => void;
  testid?: string;
  primary?: boolean;
  keepOpen?: boolean;
  /** The action it answers to, with its prompt chip (kit/input/glyphs.ts): `'confirm'`, `'back'`… */
  action?: string;
};

/** An open modal. */
export type ModalHandle = {
  readonly el: HTMLElement;
  readonly locked: boolean;
  /** Close it (runs `onClose` once). */
  close(): void;
  /** Lock or unlock (a locked modal ignores Escape and back). */
  setLocked(locked: boolean): void;
};

const open: ModalHandle[] = [];

/** Open a modal. */
export function openModal(o: {
  title: string;
  body?: Child;
  buttons?: ModalButton[];
  locked?: boolean;
  onClose?(): void;
  testid?: string;
}): ModalHandle {
  let locked = o.locked === true;
  let closed = false;
  const footer = h('div.kit-modal-buttons');
  const sheet = h(
    'div.kit-modal',
    {
      role: 'dialog',
      'aria-modal': 'true',
      'aria-label': o.title,
      'data-modal': true,
      'data-testid': o.testid ?? 'modal',
    },
    h('div.kit-modal-sheet', {}, h('h2.kit-modal-title', {}, o.title), h('div.kit-modal-body', {}, o.body), footer),
  );
  const handle: ModalHandle = {
    el: sheet,
    get locked() {
      return locked;
    },
    close() {
      if (closed) return;
      closed = true;
      sheet.remove();
      const i = open.indexOf(handle);
      if (i >= 0) open.splice(i, 1);
      o.onClose?.();
    },
    setLocked(v) {
      locked = v;
    },
  };
  for (const b of o.buttons ?? []) {
    footer.appendChild(
      button(
        b.label,
        () => {
          b.onClick?.();
          if (b.keepOpen !== true) handle.close();
        },
        { cls: b.primary === true ? 'kit-primary' : undefined, testid: b.testid, action: b.action },
      ),
    );
  }
  ui().root.appendChild(sheet);
  open.push(handle);
  sheet.querySelector<HTMLElement>('[data-nav]')?.focus();
  return handle;
}

/** The topmost open modal, or null. */
export function topModal(): ModalHandle | null {
  return open.at(-1) ?? null;
}

/** Close the topmost modal if it isn't locked (Escape / back). True when one was closed. */
export function closeTopModal(): boolean {
  const top = topModal();
  if (!top || top.locked) return false;
  top.close();
  return true;
}

/** A yes/no question; resolves true for yes. */
export function confirm(o: { title: string; body?: string; yes: string; no: string }): Promise<boolean> {
  return new Promise((resolve) => {
    let answer = false;
    openModal({
      title: o.title,
      body: o.body,
      testid: 'confirm',
      buttons: [
        { label: o.no, testid: 'confirm-no' },
        { label: o.yes, testid: 'confirm-yes', primary: true, onClick: () => (answer = true) },
      ],
      onClose: () => resolve(answer),
    });
  });
}
