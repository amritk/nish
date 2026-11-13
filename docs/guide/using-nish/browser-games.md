# Writing a browser game

A game written in Nish runs in a browser as a WebAssembly module and a page
that calls one function. The module draws into a framebuffer, reads the keys
and the pointer from a queue, and hands the page its sounds as samples. The
page, `nish/page/game`, does everything a browser needs: it loads the module,
puts the frames on a `<canvas>` through WebGPU, WebGL 2 or Canvas 2D, turns
keyboard, mouse and touch events into the module's input, and plays its
sounds through Web Audio. Neither side knows much about the other, so the same
game runs on a 60 Hz laptop and a 240 Hz monitor, with or without a GPU.

This page builds a small game from nothing. A complete one, a paddle and a
ball, is
[`examples/game-starter`](https://github.com/amritk/nish/tree/main/examples/game-starter):
copy that directory to start your own. The rules for module storage and the
`wasm32` target are in
[LANGUAGE.md](https://github.com/amritk/nish/blob/main/docs/LANGUAGE.md);
[Calling Nish from other languages](interop.md#in-a-browser) covers wasm in a
browser in general.

## Install

The page's half comes with the `nish` package:

```console
$ npm install nish
```

It is plain JavaScript with no dependencies and no build step, imported as
`nish/page/game` (its types are `nish/page/game`'s `.d.ts`). The game's half
is three standard-library modules: `nish/host/game` (the framebuffer, input
and sound queues the page reads), `nish/raster` (drawing into the
framebuffer) and `nish/synth` (making sounds). Building needs `clang` and
`wasm-ld`, as for any wasm build ([Installing](../getting-started/installation.md)).

## The three exports

A game is a module that exports three functions; the page calls them, and
nothing else:

- **`init(seed: i32): void`** runs once, before anything else. It sets the
  framebuffer's size with `gameSetSize(width, height)` (at most 960 by 540)
  and starts the game. `seed` is the page's clock unless the page passes one.
- **`step(nowMs: f64): void`** advances the game by one fixed step, 60 times a
  second unless the page asks for another rate. It reads the input and moves
  things. `nowMs` is the step's clock: it grows by exactly one step each call.
- **`draw(alpha: f64, frameMs: f64): void`** draws one frame into
  `GAME_FRAME`, once per display frame. `alpha`, from 0 to 1, is how far the
  display is between the last step and the next; `frameMs` is the time since
  the last frame.

Two more are optional. **`sound(id: i32): i32`** makes sound `id`; the page
calls it for 0, 1, 2, ... before the first step, until it answers 0.
**`resize(width: i32, height: i32): void`** hears the canvas's size in CSS
pixels, rounded to whole ones, once at start and whenever the size or the
display's pixel ratio changes, for a game that fits its framebuffer to the
window (with `gameSetSize`, in framebuffer pixels).

The game's state lives in module storage: typed arrays declared at the top of
the module, which keep their values from call to call. This game moves a
square with the arrow keys and beeps when space is pressed:

```ts nish:ok --target wasm32
import { GAME_FRAME, gameHeight, gamePlaySound, gameReadInput, gameSetSize, gameWidth, gameWriteSamples } from "nish/host/game"
import { StepInput } from "nish/input"
import { RASTER_SOLID, rasterGradient, rasterRect, rasterText } from "nish/raster"
import { SYNTH_SQUARE, synthSilence, synthTone } from "nish/synth"
import { ACTION_PRESS, ACTION_RELEASE, EVENT_KEY, KEY_LEFT, KEY_RIGHT, KEY_SPACE, KeyState } from "nish/term"

// The square's x now and a step ago, and whether left and right are held.
const STATE = new Float64Array(2)
const HELD = new Int32Array(2)

export const init = (seed: i32): void => {
  gameSetSize(320, 180)
  STATE[0] = 150.0
  STATE[1] = 150.0
}

export const sound = (id: i32): i32 => {
  if (id !== 0) {
    return 0
  }
  const beep = synthSilence(0.1, 22050)
  synthTone(beep, 22050, 0.0, 0.1, 880.0, 660.0, SYNTH_SQUARE, 0.25, 30.0)
  return gameWriteSamples(beep, 22050)
}

export const step = (nowMs: f64): void => {
  const input = new StepInput(new KeyState())
  gameReadInput(input, nowMs)
  for (const e of input.events) {
    if (e.type === EVENT_KEY && (e.action === ACTION_PRESS || e.action === ACTION_RELEASE)) {
      const down: i32 = e.action === ACTION_PRESS ? 1 : 0
      if (e.key === KEY_LEFT) {
        HELD[0] = down
      } else if (e.key === KEY_RIGHT) {
        HELD[1] = down
      } else if (e.key === KEY_SPACE && down === 1) {
        gamePlaySound(0)
      }
    }
  }
  STATE[1] = STATE[0]
  STATE[0] = Math.min(Math.max(STATE[0] + toF64(HELD[1] - HELD[0]) * 3.0, 0.0), 300.0)
}

export const draw = (alpha: f64, frameMs: f64): void => {
  const w: i32 = gameWidth()
  const h: i32 = gameHeight()
  rasterGradient(GAME_FRAME, w, h, 0x101830, 0x302040)
  const x: i32 = toI32(STATE[1] + (STATE[0] - STATE[1]) * alpha)
  rasterRect(GAME_FRAME, w, h, x, 80, x + 20, 100, 0xffd040, RASTER_SOLID)
  rasterText(GAME_FRAME, w, h, 6, 6, 1, "arrows move, space beeps", 0xf0f0f0)
}
```

A game with more than a few numbers of state keeps it in objects instead:
module storage of a class or `null` is
[root storage](interop.md#keeping-objects-between-calls-root-storage), and
the world in it, with every array and object it reaches, lasts from `init`
through every `step` and `draw` while memory stays bounded:

```ts nish:ok --target wasm32
class Ball {
  x: f64 = 0.0
  dx: f64 = 2.0
}

class World {
  balls: Ball[]
  constructor() {
    this.balls = []
  }
}

const world = new Array<World | null>(1)

export const init = (seed: i32): void => {
  const w = new World()
  w.balls.push(new Ball())
  world[0] = w
}

export const step = (nowMs: f64): void => {
  const w = world[0]
  if (w !== null) {
    for (const b of w.balls) {
      b.x = b.x + b.dx
    }
  }
}
```

The sections below take each part in turn.

## Drawing: `nish/raster`

`GAME_FRAME` is an `Int32Array` of 0xRRGGBB pixels, row by row, `gameWidth()`
pixels wide and `gameHeight()` tall; the page shows that much of it and
scales it to the canvas with sharp, square pixels. `nish/raster` draws into it.
Each function takes the pixels, the width and the height first, and clips to
them, so a shape half off the screen is drawn half:

- `rasterGradient(pixels, w, h, top, bottom)` fills the frame from one colour
  at the top to another at the bottom; drawing starts from it, or from a
  `rasterRect` over the whole frame.
- `rasterRect(pixels, w, h, x0, y0, x1, y1, colour, alpha)` fills a rectangle;
  `RASTER_SOLID` is full opacity, out of 256.
- `rasterDisc(pixels, w, h, x, y, radius, colour, alpha)` draws an
  anti-aliased disc at a fractional position.
- `rasterText(pixels, w, h, x, y, scale, text, colour)` writes text in a
  built-in 5 by 7 font; `rasterTextWidth(text, scale)` measures it first, to
  centre or right-align it.
- `rasterGlow`, `rasterTrail` and `rasterParticles` draw a soft glow, a
  fading trail and a particle pool, for effects.

Draw the whole frame every time `draw` runs; the page does not clear it.

## Input: `gameReadInput`

The page writes each key, mouse and touch event into a queue in the module's
storage, and `gameReadInput(input, nowMs)` reads the queue into a `StepInput`
from `nish/input`, as a terminal game's input. Its `events` are `TermEvent`s
from `nish/term`:

- A key event has `type` `EVENT_KEY`, `key` (`KEY_LEFT`, `KEY_SPACE`, ...),
  and `action` `ACTION_PRESS`, `ACTION_REPEAT` or `ACTION_RELEASE`. The page
  sends a real release for every press, and releases every held key when the
  window loses focus or is hidden, so a key is never stuck down.
- A mouse event has `type` `EVENT_MOUSE`, the button, an `action`
  (`ACTION_MOVE` for a move) and `px`, `py`: the position in framebuffer
  pixels, already mapped through the scaling and the black bars around the
  frame. Moves are merged, so a step sees where the pointer is, not every
  place it passed. A held button is released when it comes up, even off the
  canvas, and when a context menu opens, the pointer is cancelled or the
  window loses focus.
- A touch holds a key down while it stays on a zone of the canvas: by default
  the left half holds `ArrowLeft` and the right half `ArrowRight`, and a short
  tap that does not move presses and releases `Enter`. A game written for the
  keyboard plays on a phone without a change.

The page reads only the keys a game uses — the arrows, space, Enter and
Escape by default — so the browser keeps the rest (a reload, a tab switch).
The page's `keys` option names others by their `KeyboardEvent.key`. A key held
with Ctrl, Alt or Meta is the browser's too (Alt+Left goes back), even one the
game reads.

`input.isDown(key, 0)` answers whether a key is held, from the `KeyState` the
input was built with. A `KeyState` cannot live in module storage, so a game
either keeps its own held flags from the events, as the game above does, or
rebuilds a `KeyState` from them each step, as `examples/game-starter` does.

## Sound: `nish/synth`

The page asks for every sound before the game starts. `sound(id)` makes the
samples, hands them over with `gameWriteSamples(samples, sampleRate)` and
returns what that returns; past its last sound it returns 0. Then any step or
draw plays one with `gamePlaySound(id)`, as often as it likes.

`nish/synth` makes the samples: `synthSilence(seconds, rate)` makes a buffer
of silence, and `synthTone(buffer, rate, start, length, fromHz, toHz, wave,
volume, decay)` adds a tone that sweeps from one pitch to another and fades
out, in a `SYNTH_SQUARE`, `SYNTH_TRIANGLE` or `SYNTH_NOISE` wave. Several
tones in one buffer make a chord or a jingle; `synthSemitone(hz, n)` steps a
pitch by semitones. All the sounds together hold at most 96,000 samples, about
four seconds at 22,050 Hz.

Browsers start sound only after the person presses a key or touches the page,
so the page holds its sounds until then; the game need not care. The game's
`muted` property on the page turns them off.

## Building

Copy `examples/game-starter` to a directory of your own, install the `nish`
package there, and build:

```console
$ npm install nish
$ node build.mjs
```

`build.mjs` writes `dist/`, one directory to serve: `game.wasm`, its loader
`game.mjs` and the loader's typings `game.d.ts`, `index.html`, and, under
`dist/nish/`, `nish/page/game` and the two files it imports. It finds the
toolchain in the installed package (`node_modules/nish`) and the `nish`
command in `node_modules/.bin`; `--nish <path>` names another compiler,
`--out <dir>` another directory and `--memory <MiB>` the memory size. The
build empties its output directory first, so `--out` must name a new or empty
directory, or one an earlier build wrote; any other flag is refused. It runs two commands, which a build of
your own can run instead (`$NISH` is `node_modules/nish`):

```console
$ nish game.ts --target wasm32 --emit-dts out/game.d.ts -o ll/
$ $NISH/scripts/build.sh ll/*.ll $NISH/runtime/runtime-wasm.c -o out/game.wasm \
    --profile wasm-host --memory 16
```

`--emit-dts` writes `game.mjs`, the loader, next to `game.d.ts`; the page
imports it from beside the `.wasm`. `--memory 16` fixes the module's memory at
16 MiB, which the framebuffer, the sound samples and a game's own state fit in
with room to spare: a fixed memory never moves, so the page reads the
framebuffer in place every frame without copying it. A game that keeps its
world in root storage needs room on top for the runtime to move it, several
times the world's size when it is many small objects. The worst-case
formula in [sizing](interop.md#keeping-objects-between-calls-root-storage) is
the safe default; to size closer, measure the peak without `--memory` through
the largest world the game reaches (the peak grows with it) and give about 1.5
times that. The break director's kept heap, the arena's offset after a keep
rather than its live objects alone, reaches 3.26 MB in 3.34 MB of memory.

## The page

The page is a canvas and one call:

```html
<canvas id="game" style="width: 100vw; height: 100vh"></canvas>
<script type="module">
  import { startGame } from "nish/page/game";

  const game = await startGame(document.getElementById("game"), "./game.wasm");
</script>
```

`startGame(canvas, wasmUrl, options?)` fetches and compiles the module while
it imports the loader, calls `init`, gathers the sounds, and starts the loop;
it resolves to the running game, or rejects when an option is malformed, the
start is aborted, or the module cannot be fetched or lacks an export it needs.
The game has:

- `presenter`, which draws the frames: `presenter.backend` is the tier in use
  and `presenter.canvas` the canvas it draws on;
- `module`, the module's exports, for a page that reads its storage (a score
  shown in HTML, say);
- `fps` and `refreshHz`, the frames drawn a second and the display's rate;
- `muted`, which turns sound off and on;
- `running`, false once the game has stopped;
- `stop()`, which ends the loop, removes every listener and closes the audio.

The options are all optional: `seed` (passed to `init`), `keys` (the keys the
game reads), `touch` (its zones and tap, or `false`), `stepsPerSecond` (60),
`maxStepsPerFrame` (8), `sound` (`false`, or `{ muted: true }` to start
muted), `prefer` and `onFallback` (below), `onError` (below), `signal` (an
`AbortSignal`: aborting it rejects a start still loading, or stops the game),
`loader` (the loader, imported yourself, for a bundler), `loaderUrl` (the
loader's URL, when it is not the `.mjs` beside a `.wasm` URL) and `imports`
(passed to the loader, such as `onPanic`). Without a bundler, an import map lets the browser find
`nish/page/game`, or the page imports the file by its path, as
`examples/game-starter` does.

A panic in `step` or `draw`, or a frame the presenter cannot show, stops the
game as `stop()` does and calls `onError(error)` once; without `onError` the
error is thrown from the animation frame, where the console shows it.

The canvas's CSS size decides how big the game looks; the page keeps its
drawing buffer at the canvas's size in device pixels and fits the frame in it,
with black bars to keep its shape.

## Serving

Any static server works. Serve the `.wasm` as `application/wasm` and the
browser compiles it while it downloads; with another type the page reads it
whole first and compiles that, which is slower to start but works. A page
opened as a `file://` URL cannot fetch the module: serve the directory, even
for a quick look:

```console
$ python3 -m http.server --directory dist
```

## Fallback tiers

The page draws with the best the browser offers: WebGPU, then WebGL 2, then
Canvas 2D. A tier that fails to start, or whose GPU is lost while the game
runs, is given up for the next one, and the game goes on without a restart.
A canvas that has had one context cannot take another, so a fallback puts a
fresh canvas in the old one's place, with its listeners moved over; read
`game.presenter.canvas` again afterwards. `onFallback(from, to, reason,
canvas)` is called each time, for a page that logs it or styles the new
canvas.

`prefer` starts lower down: `prefer: "webgl2"` never tries WebGPU, and
`prefer: "canvas2d"` uses no GPU at all. A query parameter is a handy way to
try each tier:

```js
const prefer = new URLSearchParams(location.search).get("renderer") ?? undefined;
const game = await startGame(canvas, "./game.wasm", {
  prefer,
  onFallback: (from, to, reason) => console.warn(`${from} -> ${to}: ${reason}`),
});
```

All three draw the same pixels; Canvas 2D costs more CPU for a large frame.

## 120 and 240 Hz displays

A game should move at the same speed on every display, and look smooth on a
fast one. The page does both by keeping the steps and the frames apart:

- `step` runs at a fixed rate, 60 times a second, whatever the display does.
  A game's physics count in steps, never in frame times, so the game plays the
  same everywhere, and a seeded game replays the same.
- `draw` runs once per display frame: 60 times a second on a 60 Hz display,
  240 times on a 240 Hz one. Between two steps it gets `alpha`, how far the
  display is between them, and draws each moving thing at
  `last + (now - last) * alpha`. That is why the game above keeps where the
  square was a step ago: a 240 Hz display then shows four positions between
  every two steps instead of the same one four times.

A slow frame runs the steps it missed, at most `maxStepsPerFrame` of them; a
frame over a quarter of a second, a hidden tab or a debugger's pause, counts
as a quarter second, so the game does not race to catch up. `game.refreshHz`
reads the display's rate and `game.fps` counts the frames actually drawn.
