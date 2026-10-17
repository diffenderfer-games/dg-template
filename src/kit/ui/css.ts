/**
 * kit/ui: the kit's CSS, themed by CSS variables the game sets (src/game/theme.css).
 * Source: dg-template src/kit/ui/ (kit v1.0). Copy byte-identical; change it in the template first.
 * Docs: docs/kit/ui.md § "Theming"
 *
 * Focus rings use the hub's `--hub-focus-*` variables (sliderush / phase10),
 * shown only for keyboard and gamepad (`data-hub-input=keys`). Controls are
 * at least 44 px. Screens keep clear of the safe area, the race HUD
 * (`--hub-race-hud-top/bottom`) and the hub menu button (none in the world's
 * box: `html[data-embed]`). Sizes follow the window (the box), width and height.
 */
export const KIT_CSS = `
:root {
  --kit-bg: #0d0f14; --kit-panel: rgba(20, 24, 33, 0.94); --kit-fg: #e8e6df; --kit-muted: #8a93a6;
  --kit-accent: #4ade80; --kit-accent-fg: #06210f; --kit-accent-2: #38d6ff; --kit-warn: #ffb547;
  --kit-radius: 14px; --kit-font: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  --kit-top: calc(max(env(safe-area-inset-top), 10px) + var(--hub-race-hud-top, 0px));
  --kit-bottom: calc(max(env(safe-area-inset-bottom), 10px) + var(--hub-race-hud-bottom, 0px));
}
.kit-ui { position: fixed; inset: 0; pointer-events: none; font-family: var(--kit-font); color: var(--kit-fg); z-index: 10; }
.kit-ui > * { pointer-events: auto; }
.kit-screen { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 14px; padding: calc(var(--kit-top) + 48px) 16px var(--kit-bottom); box-sizing: border-box; text-align: center; overflow: auto; }
html[data-embed] .kit-screen:not([data-screen="play"]) { padding-top: calc(var(--kit-top) + 12px); }
.kit-screen[data-screen="play"] { pointer-events: none; justify-content: flex-start; padding-top: calc(var(--kit-top) + 4px); }
.kit-screen[data-screen="play"] > * { pointer-events: auto; }
.kit-dim { background: rgba(5, 7, 10, 0.62); backdrop-filter: blur(3px); }
.kit-title { font-size: clamp(30px, min(9vw, 10vh), 64px); font-weight: 800; letter-spacing: 0.02em; margin: 0; line-height: 1.05; }
.kit-tagline { color: var(--kit-muted); margin: 0 0 6px; font-size: 16px; }
.kit-menu { display: flex; flex-direction: column; gap: 10px; width: min(320px, 100%); }
.kit-btn { min-height: 48px; min-width: 44px; padding: 10px 18px; border-radius: var(--kit-radius); border: 1px solid rgba(255,255,255,0.12);
  background: rgba(255, 255, 255, 0.07); color: var(--kit-fg); font: 600 17px var(--kit-font); cursor: pointer;
  display: flex; align-items: center; justify-content: center; gap: 8px; flex-wrap: wrap; touch-action: manipulation; }
.kit-btn:hover { background: rgba(255, 255, 255, 0.13); }
.kit-btn:disabled { opacity: 0.45; cursor: default; }
.kit-btn.kit-primary { background: var(--kit-accent); color: var(--kit-accent-fg); border-color: transparent; }
.kit-btn-sub { flex-basis: 100%; font-weight: 500; font-size: 13px; opacity: 0.8; }
.kit-btn:focus { outline: none; }
[data-hub-input="keys"] .kit-ui [data-nav]:focus, .kit-ui [data-nav].hub-nav-focus, .kit-ui [data-nav]:focus-visible {
  box-shadow: 0 0 0 var(--hub-focus-gap, 2px) var(--hub-focus-inner, rgba(13, 15, 20, 0.85)),
    0 0 0 calc(var(--hub-focus-gap, 2px) + var(--hub-focus-width, 3px)) var(--hub-focus-color, #fff); }
.kit-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; min-height: 48px; width: 100%; }
.kit-row-label { text-align: left; }
.kit-toggle { width: 56px; height: 32px; border-radius: 16px; border: 0; background: #3a4150; position: relative; cursor: pointer; }
.kit-toggle::after { content: ""; position: absolute; top: 4px; left: 4px; width: 24px; height: 24px; border-radius: 50%; background: #fff; transition: transform .15s; }
.kit-toggle[aria-checked="true"] { background: var(--kit-accent); }
.kit-toggle[aria-checked="true"]::after { transform: translateX(24px); }
.kit-slider { width: 50%; min-height: 32px; accent-color: var(--kit-accent); }
.kit-seg { display: flex; gap: 4px; background: rgba(255,255,255,0.06); padding: 4px; border-radius: var(--kit-radius); }
.kit-seg-item { flex: 1; min-height: 40px; border: 0; border-radius: 10px; background: transparent; color: var(--kit-fg); font: 600 15px var(--kit-font); }
.kit-seg-item[aria-checked="true"] { background: var(--kit-accent); color: var(--kit-accent-fg); }
.kit-modal { position: fixed; inset: 0; display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,0.55); padding: 16px; z-index: 30; }
.kit-modal-sheet { background: var(--kit-panel); border-radius: calc(var(--kit-radius) + 4px); padding: 20px; width: min(420px, 100%);
  max-height: calc(100% - 32px); overflow: auto; box-shadow: 0 20px 60px rgba(0,0,0,0.5); display: flex; flex-direction: column; gap: 12px; }
.kit-modal-title { margin: 0; font-size: 22px; }
.kit-modal-body { color: var(--kit-fg); text-align: left; display: flex; flex-direction: column; gap: 6px; }
.kit-modal-buttons { display: flex; gap: 10px; justify-content: flex-end; flex-wrap: wrap; }
.kit-toasts { position: fixed; left: 50%; bottom: calc(var(--kit-bottom) + 12px); transform: translateX(-50%); display: flex;
  flex-direction: column; gap: 8px; width: min(420px, calc(100% - 32px)); z-index: 40; }
/* Touch play: the on-screen controls own the bottom, so toasts go under the HUD. */
html[data-controls="touch"] #ui[data-screen="play"] .kit-toasts { bottom: auto; top: calc(var(--kit-top) + 56px); }
@media (pointer: coarse) { #ui[data-screen="play"] .kit-toasts { bottom: auto; top: calc(var(--kit-top) + 56px); } }
.kit-toast { background: var(--kit-panel); border-radius: var(--kit-radius); padding: 12px 14px; box-shadow: 0 8px 30px rgba(0,0,0,0.4);
  border-left: 4px solid var(--kit-accent-2); animation: kit-pop .18s ease-out; }
.kit-toast[data-kind="good"] { border-left-color: var(--kit-accent); }
.kit-toast[data-kind="warn"] { border-left-color: var(--kit-warn); }
.kit-toast-actions { display: flex; gap: 8px; margin-top: 8px; justify-content: flex-end; }
.kit-hud { display: flex; gap: 18px; align-items: center; justify-content: center; font: 700 18px var(--kit-font);
  text-shadow: 0 2px 6px rgba(0,0,0,0.6); padding: 6px 70px; max-width: 100%; box-sizing: border-box; flex-wrap: wrap; }
.kit-continue { display: flex; flex-direction: column; gap: 8px; width: min(320px, 100%); }
.kit-banner { position: fixed; left: 50%; top: 42%; transform: translate(-50%, -50%); font: 900 clamp(32px, 8vw, 72px) var(--kit-font);
  text-shadow: 0 4px 20px rgba(0,0,0,0.6); animation: kit-banner 1.4s ease-out forwards; pointer-events: none; z-index: 35; white-space: nowrap; }
.kit-banner[data-still="true"] { animation: none; }
.kit-confetti { position: fixed; inset: 0; pointer-events: none; overflow: hidden; z-index: 36; }
.kit-confetti i { position: absolute; top: -12px; width: 8px; height: 14px; border-radius: 2px; animation: kit-fall 2.4s linear forwards; }
.kit-in { animation: kit-pop .28s ease-out both; }
.kit-corner { position: absolute; display: flex; align-items: center; gap: 8px; }
/* People: faces, names, lobby seats, chat (kit/avatar, kit/online). */
.kit-face { display: inline-grid; place-items: center; border-radius: 50%; background: var(--kit-accent-2); color: #04202a;
  font-weight: 800; flex: none; font-size: 0.9em; }
.kit-face[data-face="silhouette"] { background: #3a4150; }
.kit-who { display: inline-flex; align-items: center; gap: 8px; }
.kit-link { background: none; border: 0; padding: 4px 2px; color: inherit; font: inherit; text-decoration: underline; cursor: pointer; }
.kit-seats { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; width: min(320px, 100%); }
.kit-seat { display: flex; align-items: center; gap: 10px; min-height: 48px; padding: 0 12px; border-radius: var(--kit-radius);
  background: rgba(255, 255, 255, 0.05); text-align: left; }
.kit-seat > .kit-btn { min-height: 40px; padding: 6px 12px; }
.kit-seat[data-connected="false"] { opacity: 0.6; }
.kit-seat .kit-tagline { margin: 0 0 0 auto; font-size: 13px; }
.kit-seat[data-due="true"] { box-shadow: inset 0 0 0 2px var(--kit-accent); }
.kit-seat > .kit-seat-remove { margin-left: auto; min-height: 40px; padding: 4px 12px; font-size: 14px; }
.kit-share { display: flex; flex-direction: column; gap: 8px; }
.kit-share-field { width: 100%; box-sizing: border-box; min-height: 44px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.2);
  background: rgba(0,0,0,0.3); color: var(--kit-fg); padding: 0 10px; font: 15px var(--kit-font); }
.kit-friends { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
.kit-friend { display: flex; align-items: center; gap: 10px; min-height: 48px; }
.kit-friend-name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.kit-friend > .kit-btn { min-height: 40px; padding: 4px 14px; }
/* An online game the hub runs (kit/turns): status, seats, the game's board, buttons, chat; scrolls on a phone. */
.kit-turns { overflow-y: auto; justify-content: flex-start; padding-top: max(var(--kit-top, 16px), 72px); padding-bottom: 24px; }
.kit-turn-status { font-size: 18px; font-weight: 700; min-height: 1.4em; }
.kit-turns[data-kind="mine"] .kit-turn-status { color: var(--kit-accent); }
.kit-turn-board { display: flex; flex-direction: column; align-items: center; gap: 10px; width: min(420px, 100%); }
.kit-turn-board:empty { display: none; }
.kit-chat { display: flex; flex-direction: column; gap: 8px; width: min(320px, 100%); text-align: left; }
.kit-chat-lines { max-height: 30vh; overflow: auto; }
.kit-chat-lines p { margin: 2px 0; }
.kit-chat-note { color: var(--kit-warn); font-size: 14px; }
.kit-chat-note:empty { display: none; }
.kit-chat-chips { display: flex; flex-wrap: wrap; gap: 6px; }
.kit-chat-chips .kit-btn { min-height: 44px; padding: 6px 12px; font-size: 15px; }
.kit-chat-form { display: flex; gap: 6px; }
.kit-chat-input { flex: 1; min-width: 0; min-height: 44px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.2);
  background: rgba(0,0,0,0.3); color: var(--kit-fg); padding: 0 10px; font: 16px var(--kit-font); }
@keyframes kit-pop { from { opacity: 0; transform: translateY(6px) scale(0.98); } to { opacity: 1; transform: none; } }
@keyframes kit-banner { 0% { opacity: 0; transform: translate(-50%, -50%) scale(0.6); } 20% { opacity: 1; transform: translate(-50%, -50%) scale(1.06); }
  80% { opacity: 1; } 100% { opacity: 0; transform: translate(-50%, -60%) scale(1); } }
@keyframes kit-fall { to { transform: translateY(110vh) rotate(720deg); } }
@media (prefers-reduced-motion: reduce) { .kit-in, .kit-toast, .kit-banner { animation: none; } }
`;
