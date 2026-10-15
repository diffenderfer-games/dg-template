/**
 * kit/settings-ui: the standard settings sheet (sound, music, volumes, vibration, motion) plus the game's rows.
 * Source: dg-template src/kit/settings-ui/ (kit v1.0). Copy byte-identical; change it in the template first.
 * Docs: docs/kit/settings-ui.md
 *
 * Settings are device-local (kit/save createSettings). "Reset game" is the
 * hub menu's (`hub:reset`); the kit only offers local preferences.
 */
import type { SettingsStore } from '../save/settings.ts';
import { t } from '../core/strings.ts';
import { h } from '../ui/dom.ts';
import { sliderRow, toggleRow } from '../ui/controls.ts';
import { openModal, type ModalHandle } from '../ui/modal.ts';
import { ui } from '../ui/root.ts';

/** The settings every kit game has. */
export type KitSettings = {
  sound: boolean;
  music: boolean;
  musicVolume: number;
  sfxVolume: number;
  haptics: boolean;
  reducedMotion: boolean;
};

/** The defaults (reduced motion follows the system's preference). */
export function kitSettingsDefaults(): KitSettings {
  const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  return { sound: true, music: true, musicVolume: 0.7, sfxVolume: 0.9, haptics: true, reducedMotion: reduced };
}

/** Open the settings sheet. `rows` adds the game's own (difficulty, colours, hints). */
export function settingsSheet(o: {
  settings: SettingsStore<KitSettings>;
  haptics?: boolean;
  rows?: () => HTMLElement[];
  onClose?: () => void;
}): ModalHandle {
  const s = o.settings;
  const body = h(
    'div.kit-settings',
    {},
    toggleRow(t('soundOn'), s.data.sound, (on) => s.set({ sound: on }), 'setting-sound'),
    sliderRow(t('sfxVolume'), s.data.sfxVolume, (v) => s.set({ sfxVolume: v }), 'setting-sfx-volume'),
    toggleRow(t('music'), s.data.music, (on) => s.set({ music: on }), 'setting-music'),
    sliderRow(t('musicVolume'), s.data.musicVolume, (v) => s.set({ musicVolume: v }), 'setting-music-volume'),
    o.haptics === false
      ? null
      : toggleRow(t('haptics'), s.data.haptics, (on) => s.set({ haptics: on }), 'setting-haptics'),
    toggleRow(
      t('reducedMotion'),
      s.data.reducedMotion,
      (on) => {
        s.set({ reducedMotion: on });
        ui().reducedMotion = on;
      },
      'setting-reduced-motion',
    ),
    ...(o.rows?.() ?? []),
  );
  return openModal({
    title: t('settings'),
    body,
    testid: 'settings',
    buttons: [{ label: t('close'), testid: 'settings-close', primary: true }],
    onClose: o.onClose,
  });
}
