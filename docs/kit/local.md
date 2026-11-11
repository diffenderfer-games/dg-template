# kit/local: 2–4 players on one screen

KIT doc. Local play is split-screen multiplayer at one TV or desktop. Each
player uses their own gamepad, and at most one of them may use the keyboard.
Built on the hub's seats (`hub.input.seats`, docs/hub.md "Local seats", hub
client **2.0.0-next.22**). On an older client the kit offers no local play.

## Turning it on

```ts
// src/game/hooks.ts
defineGame(hub, {
  ...,
  local: { max: 4, min: 2 },  // keyboard: false keeps the keyboard out; colors: your four seat colours
});
```

Offer it where the game sets up a game, for example a "Players" row on the setup
sheet. Show that row only when `ctx.local.available` is true. It is false on a
touch-only device, and false when the hub client has no seats. Then:

```ts
if (players > 1)
  void ctx.session.newLocal(); // the join sheet, then a game for those who joined
else void ctx.session.newGame();
```

`newLocal()` opens the join sheet. When the players start, it starts a new game
with `mode: 'local'` and `opts.local.players`. Each player has a `seat`, a
`name` ("Player 1"…), a `color`, `me` (seat 0, the signed-in player), and a
`device` and `padStyle`. If the players back out, it resolves `false`. Keep
the player list in your game state (it is JSON).

## Joining

The sheet shows one slot per seat:

- A or Start on a pad nobody has, or Enter or Space on the keyboard, takes the
  next seat.
- B gives a seated pad's seat up. Backspace does the same for the keyboard.
- When `min` players are in, Start on a seated pad, Enter from the keyboard
  player, or the Start button begins the game.
- Esc, the Back button, or B while nobody is seated cancels.

The sheet has no buttons a pad can move to. A new player's A therefore only
ever joins; it never presses something else by accident. Theme it like every
other sheet (look.md):

- `.kit-join` is the sheet.
- `.kit-join-slot[data-state="open"|"joined"]` is a slot, with `--seat-color`.
- `.kit-join-disc` is the number disc of seats 1–3. Seat 0 shows the player's
  avatar.
- `.kit-join-start` is the Start button.

## Playing

- **Inputs:** `ctx.local.input(seat)` reads the inputs you declared in
  `controls.ts`, from that player's device only. It has `vector`, `value`,
  `down`, `pressed` and `axis`. Call `step` once per player.
- **Pause:** `ctx.hub.input` (the page-wide readers) still hears every device,
  so the `pause` input pauses everyone from any pad. One pause screen serves
  all players.
- **Unplugged pads:** a pad that comes out pauses the game and shows a toast
  ("Player 2: plug your controller back in"). `ctx.local.connected(seat)` is
  false until the pad is back, and that seat reads 0 in the meantime.
- **Haptics:** `ctx.local.haptic(seat, strong?)` rumbles that player's pad
  only, if the player allows vibration. Use it instead of `ctx.haptic()` for
  one player's bumps.
- **Nothing is recorded:** a local game sends no boards, stats, profile changes
  or Continue saves (`activity.isolated()`). Play again starts a new game with
  the same players. The title, or any other mode, gives the seats back.
- **The hub menu:** Select on any pad still opens it, and every seat reads 0
  while it is open. In the world's box only Player 1's pad can hold B to leave.

## Split screen

`viewLayout(players, width, height)` returns one rect per player:

- 2 players sit side by side on a wide screen and stacked on a tall one.
- 3 and 4 players play in a 2×2 grid. With 3, the fourth cell (`standings`) is
  for the standings panel.

For three.js, render each view in turn with its own camera:

```ts
const { views } = viewLayout(n, w, h);
renderer.setScissorTest(true);
views.forEach((rect, seat) => {
  const gl = glViewport(rect, h); // bottom-left origin, CSS px (three scales by its pixel ratio itself)
  renderer.setViewport(gl.x, gl.y, gl.width, gl.height);
  renderer.setScissor(gl.x, gl.y, gl.width, gl.height);
  cameras[seat].aspect = rect.width / rect.height;
  cameras[seat].updateProjectionMatrix();
  renderer.render(scene, cameras[seat]);
});
renderer.setScissorTest(false);
```

For raw WebGL (`gl.viewport`), pass the canvas's device pixel ratio as the third argument.

- **Before each view renders:** run every pass that follows "the" camera, such
  as weather, particle culling, shadow-camera follow and level of detail.
- **Bloom:** switch bloom and other full-screen post-processing off while two
  or more players play (the owner's call). Drop one quality level per extra
  view.

`mountViewLayers(parent, players, size)` puts one DOM layer over each view and
returns its `view(seat)` element. Mount each player's HUD inside its layer.
Each layer carries `data-seat`, `--view-w` / `--view-h` and the
`--seat-color` edge, plus `standings` for three players. Pass `ctx.local.players` (each has `device`
and `padStyle`) and each layer's button chips show that player's own controller or keyboard glyphs,
whoever pressed last. Call `layout(w, h)`
on resize. Size the HUD from `--view-w`, not the window.

## Tests

The kit's suite `tests/hub-events/local.test.ts` plays a local game through the
session. In a game's own tests, `fake.input.enableSeats()` gives the FakeHub
the client's seats. The `FakeSeats` it returns can:

- seat devices (`join()`);
- hold inputs per seat (`hold`, `press`; `vector('move')` reads
  `move.x` / `move.y`);
- press raw pad buttons (`padPress`);
- unplug a pad (`plug(seat, false)`).
