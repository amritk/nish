---
name: nish break — the brick breaker behind the wall
overview: Replace the `nish break` placeholder with a playable, animated brick breaker built into the compiler, drawn in true pixels on terminals that have them (kitty graphics, Sixel) and degrading to half blocks and ASCII, at up to 120 interpolated frames a second. An interactive title menu crumbles into the first level's wall, and six levels of exponentially rising difficulty follow. It stays undocumented, as the easter egg it is.
stages:
  - id: break-gfx
    title: "chore(cli): chalk for the wall"
    goal: A small, allocation-free drawing kit in src/break-gfx.ts that both scenes share — a fixed world mapped onto any Framebuffer, anti-aliased discs and glow, bevelled bricks, a pixel font, colour and easing helpers and a particle pool
    verification: npm run check && npm run lint && node tests/run.js break_gfx && node tests/run.js performance && WASI_SYSROOT=/usr node tests/run.js wasi && node tests/self/goldens.js
    status: pending
    todos:
      - id: gfx-view
        content: Add the world constants and View, which maps the 320x180 world onto a Framebuffer of any size with letterbox and shake — see break-gfx, The view
        status: pending
      - id: gfx-shapes
        content: Add fillRect, bevelBrick, disc (anti-aliased by coverage), glow and trail drawing to src/break-gfx.ts — see break-gfx, Shapes
        status: pending
      - id: gfx-font
        content: Add the 5x7 pixel font for ASCII 32 to 126 with drawText and textWidth at integer scales — see break-gfx, Text
        status: pending
      - id: gfx-colour
        content: Add rgb blending, hue-to-rgb, the easing curves and lerp — see break-gfx, Colour and motion
        status: pending
      - id: gfx-particles
        content: Add Particles, a fixed-capacity pool with spawn, step and draw that allocates nothing after construction — see break-gfx, Particles
        status: pending
      - id: gfx-tests
        content: Add tests/link/break_gfx checks pinning the view mapping at three framebuffer sizes, disc coverage, a drawn glyph, the easing endpoints and the pool's cap — see Tests
        status: pending
      - id: gfx-goldens
        content: Regenerate tests/self/goldens/checked with node tests/self/goldens.js --update and read the diff
        status: pending
  - id: break-game
    title: "chore(cli): a ball, a paddle and a wall"
    goal: A pure, deterministic brick breaker in src/break-game.ts and src/break-levels.ts — six levels on an exponential difficulty curve, swept physics at 120 steps a second, power-ups, combos, the level intro and outro scenes — drawn through break-gfx onto a Framebuffer with interpolation, with no terminal I/O
    verification: npm run check && npm run lint && node tests/run.js break_game && node tests/run.js performance && WASI_SYSROOT=/usr node tests/run.js wasi && node tests/self/goldens.js
    status: pending
    todos:
      - id: game-levels
        content: Add src/break-levels.ts with six level maps and names, and levelTuning, the exponential difficulty curve — see break-game, Levels and Difficulty
        status: pending
      - id: game-state
        content: Add BreakGame, newBreakGame and stepBreakGame to src/break-game.ts — swept physics, paddle, balls, bricks, lives and phases — see break-game, Play
        status: pending
      - id: game-juice
        content: Add power-ups, combo scoring, particles, shake and trails — see break-game, Juice
        status: pending
      - id: game-scenes
        content: Add the level intro where the wall drops in, the level-clear tally, pause, game over and victory with fireworks — see break-game, Scenes
        status: pending
      - id: game-draw
        content: Add drawBreakGame, interpolating every moving thing by alpha and laying the HUD out for the framebuffer's size — see break-game, Drawing
        status: pending
      - id: game-tests
        content: Add tests/link/break_game checks that drive stepBreakGame with scripted TermInput and pin physics, the difficulty curve, scoring, power-ups, phases and a drawn frame — see Tests
        status: pending
      - id: game-goldens
        content: Regenerate tests/self/goldens/checked with node tests/self/goldens.js --update and read the diff
        status: pending
  - id: break-menu
    title: "chore(cli): a title card under the wall"
    goal: A pure, animated, interactive title menu in src/break-menu.ts that ends in a crumble-away outro and answers what was chosen, drawn through break-gfx onto a Framebuffer with interpolation, with no terminal I/O
    verification: npm run check && npm run lint && node tests/run.js break_menu && node tests/run.js performance && WASI_SYSROOT=/usr node tests/run.js wasi && node tests/self/goldens.js
    status: pending
    todos:
      - id: menu-logo
        content: Add the NISH BREAK brick logo with a rainbow shimmer and the attract-mode ball knocking out a regrowing background wall — see break-menu, The title
        status: pending
      - id: menu-items
        content: Add BreakMenu, newBreakMenu and stepBreakMenu with Play, Start level, How to play and Quit — see break-menu, Items
        status: pending
      - id: menu-outro
        content: Add the outro where the logo's bricks come loose and fall, and the screen wipes before stepBreakMenu answers the level — see break-menu, The outro
        status: pending
      - id: menu-draw
        content: Add drawBreakMenu, interpolating by alpha and laying out for the framebuffer's size — see break-menu, Drawing
        status: pending
      - id: menu-tests
        content: Add tests/link/break_menu checks that drive stepBreakMenu with scripted TermInput and pin navigation, level choice, the outro's length and skip, and a drawn frame — see Tests
        status: pending
      - id: menu-goldens
        content: Regenerate tests/self/goldens/checked with node tests/self/goldens.js --update and read the diff
        status: pending
  - id: break-play
    title: "chore(cli): the wall comes down"
    goal: Running nish break in a terminal opens the menu at the best fidelity and frame rate the terminal can take, plays through every level and back, and quits cleanly, leaving the terminal as it was
    verification: npm run check && npm run lint && node tests/run.js break && node tests/run.js term-io && npm run test:cli && node tests/run.js performance && WASI_SYSROOT=/usr node tests/run.js wasi && node tests/self/goldens.js
    status: pending
    todos:
      - id: play-director
        content: Add src/break.ts, the scene director over runTerminal with the fidelity options, and playBreak() answering the exit code — see break-play, The director and Fidelity
        status: pending
      - id: play-framebuffer
        content: Size the framebuffer from the terminal's pixel area at open and on every resize, capped — see break-play, Fidelity
        status: pending
      - id: play-overlay
        content: Toggle the term-rate stats overlay on F3 — see break-play, Fidelity
        status: pending
      - id: play-wire
        content: Replace the placeholder in src/compile.ts main with playBreak, keep the riddle and the file-named-break rule, and update the comment there and the line in .claude/orientation.md — see break-play, Wiring
        status: pending
      - id: play-not-a-terminal
        content: Answer a pipe on stdin or stdout with one line and exit 1, and a terminal under 40x16 with a resize prompt — see break-play, Wiring
        status: pending
      - id: play-pty-test
        content: Add a pty test in tests/run.js under tests/term-io/relay.mjs and update the placeholder checks — see Tests
        status: pending
      - id: play-measure
        content: Measure binary size, build time and in-game frame cost and put them in the PR body and a Measured trailer — see break-play, Cost
        status: pending
      - id: play-goldens
        content: Regenerate tests/self/goldens/checked with node tests/self/goldens.js --update and read the diff
        status: pending
---

# nish break — the brick breaker behind the wall

## Context

`nish break` already exists as a secret. `src/compile.ts` `main` answers it,
when no file named `break` is in the working directory, with
`you found the wall. the ball is still being made; come back soon.` and exit 0.
`nearMiss` answers `brick`, `bricks`, `breakout`, `game` and `play` with a
riddle. The help's title rule (`src/cli-style.ts`, `wall`) is a course of
bricks with one knocked out, the only mark of it. `tests/run.js` (around line
20960) pins all three. `.claude/orientation.md` says to keep `nish break` out
of `docs/guide`, `llms.txt` and `docs/AI.md`.

The terminal stack this needs is in `std/` and in the seed (v0.26.0 ships
`std/term-io.ts` and the `nish:term` builtins), so `src/` may import it under
the rolling freeze:

- `std/term-io.ts` — `runTerminal(options, state, update, render)`;
  `TerminalOptions` (`stepsPerSecond`, `maxFps`, `allow120`, `prefer`,
  `framebufferWidth/Height`, `overlay`); `TermInput` (`events`,
  `isDown(key, code)`); `Frame` (`screen`, `framebuffer`, `alpha`, `stats`,
  `caps`). `present()` draws the framebuffer with the best backend the
  terminal has, capped by the refresh controller.
- `std/term-pixels.ts` — `Framebuffer` (`set`, `get`, `fill`, `resize`), and
  the kitty, Sixel, half-block and ASCII encoders behind `present()`.
- `std/term-rate.ts` — the refresh controller (`RATE_FIRST`, resolution
  divisor, backend cap) and `drawStatsOverlay`.
- `std/term-probe.ts` — `TermCaps`, including the cell size in pixels.
- `std/term.ts` — `TermEvent`, `KeyState`, the `KEY_*` / `EVENT_*` /
  `ACTION_*` constants.
- `std/random.ts` — `Rng`, seeded.
- `tests/term-io/relay.mjs` — a pseudo-terminal that answers the probe as kitty
  does and sends scripted keys after N frames.

Nish rules that shape the code (`docs/AI.md`, `.claude/selfhost.md` →
"Nish-0"): a function is not a value except as a named function passed where
a function type is declared (as `runTerminal` takes `update` and `render`); an
out-of-range index panics, so every index is guarded; `src/` is held to its
performance ratchet, so the new modules carry **zero** performance warnings
(`NL9xxx`).

## Fidelity and smoothness

The game is a show-off of what Nish does, so it runs at the best the terminal
allows and never stutters. These rules bind every stage:

- **Pixels, not cells.** Everything — world, HUD, menu text — is drawn into the
  `Framebuffer` that `term-io` presents. A kitty-graphics terminal gets true
  pixels, a Sixel terminal gets Sixel, and the rest step down to half blocks
  and then ASCII, from the same draw code. The encoders come in with
  `term-io` already, so this costs no extra binary size.
- **Fixed world, any resolution.** Simulation runs in a fixed 320×180 world
  (16:9, `f64`) that knows nothing of pixels. Drawing maps it onto whatever
  framebuffer it is given, from about 80×45 (half blocks on a small terminal)
  up to the cap (see break-play), so a resize, or the controller dropping the
  resolution divisor, never touches game state.
- **120 steps a second, interpolated frames.** `STEPS_PER_SECOND = 120`.
  Every moving thing keeps its previous and current position, and drawing
  lerps between them by `frame.alpha`, so motion is smooth at whatever rate
  the controller picks (up to 120 fps where `allow120` holds), with no judder
  when steps and frames do not line up.
- **Nothing allocates in steady state.** No allocation per step or per frame
  once a level is running: particles, trails and floating score text live in
  fixed pools made at construction. A collection pause is a dropped frame.
- **Draw cost scales with pixels.** Drawing touches each framebuffer pixel a
  bounded number of times (a clear plus what is on top). Full-screen effects
  (the wipe, the vignette) are cheap per-pixel arithmetic, never a per-pixel
  call into something that loops.
- **Looks.** Anti-aliased balls with a soft glow, bevelled bricks with a
  highlight and a shadow edge, a gradient background, trails, particles with
  gravity and fade, screen shake. On half-block and ASCII the same scene must
  stay readable: the HUD switches to a compact layout when the glyphs would be
  under 7 pixels tall at scale 1.
- **Small.** The binary-size budget is in break-play, Cost. Prefer one shared
  helper in `break-gfx` over two private ones, data tables over code, and no
  new `std` imports beyond those listed above.

## Secrecy

Nothing here reaches `docs/guide`, `llms.txt`, `docs/AI.md`, `--help` or the
README. Commit subjects are the public `CHANGELOG.md` lines, so they stay coy
(the stage titles above); PR bodies may say what they are. The code comments
say plainly what it is, as `compile.ts` already does.

## The interfaces between the stages

`break-gfx` lands first. `break-game` and `break-menu` then run in parallel,
each importing `break-gfx` and neither importing the other. `break-play`
sequences them. These signatures are fixed; a worker may add exports, not
change these.

```ts
// src/break-gfx.ts
export const STEPS_PER_SECOND: i32 = 120
export const WORLD_W: f64 = 320.0
export const WORLD_H: f64 = 180.0
export class View { /* the framebuffer, scale and offsets of the world in it, the shake offset */ }
export const viewFor = (view: View, fb: Framebuffer, shakeX: f64, shakeY: f64): void // fit the world into fb (letterboxed), reusing view

// src/break-game.ts
export const BREAK_LEVELS: i32 = 6
export const GAME_PLAYING: i32 = 0 // every phase still inside the game, intro and pause included
export const GAME_OVER: i32 = 1    // the game-over screen was dismissed
export const GAME_WON: i32 = 2     // the victory screen was dismissed
export const GAME_QUIT: i32 = 3    // q or Esc while paused
export class BreakGame { /* … */ }
export const newBreakGame = (level: i32, seed: i64): BreakGame // level clamped to 1..BREAK_LEVELS
export const stepBreakGame = (game: BreakGame, input: TermInput): i32 // a GAME_* code
export const drawBreakGame = (game: BreakGame, fb: Framebuffer, alpha: f64): void

// src/break-menu.ts
export const MENU_STAY: i32 = 0
export const MENU_QUIT: i32 = -1
export class BreakMenu { /* … */ }
export const newBreakMenu = (level: i32, seed: i64): BreakMenu
export const stepBreakMenu = (menu: BreakMenu, input: TermInput): i32 // MENU_STAY, MENU_QUIT, or the level 1..6 to play once the outro ends
export const drawBreakMenu = (menu: BreakMenu, fb: Framebuffer, alpha: f64): void
```

A step reads key presses and repeats from `input.events` and held keys from
`input.isDown`. Durations below are in seconds; code counts them in steps.

## break-gfx

**Owns:** `src/break-gfx.ts`, `tests/link/break_gfx*/**`, `tests/self/goldens/**/break-gfx*`, `tests/self/goldens/**/break_gfx*`

### The view

`View` maps world coordinates to framebuffer pixels: one uniform scale
(`min(fbW / WORLD_W, fbH / WORLD_H)`), centred, the letterbox filled by the
caller's background, plus a shake offset in world units. It exposes the
scale so drawing can pick detail (a glow radius, a font scale) from it.

### Shapes

All clipped to the framebuffer, all taking world coordinates through a `View`:
`fillRect`; `bevelBrick` (a face colour, a lighter top-left edge, a darker
bottom-right edge, the edge width scaled with the view, falling back to a flat
rect under 3 pixels); `disc` (anti-aliased: edge pixels blended by their
coverage); `glow` (an additive radial falloff); `trail` (a fading line of
discs). A `Framebuffer` holds `0xRRGGBB`, so blending reads the pixel, mixes
and writes it back.

### Text

A 5×7 font for ASCII 32–126 as a data table (one or two `i32` bitmasks per
glyph), drawn at an integer scale with an optional one-pixel shadow:
`drawText(view, x, y, scale, text, colour)`, `textWidth(text, scale)`, and
`fontScaleFor(view, worldHeight)` choosing the largest integer scale that
fits. The menu logo is not this font; it is the menu's own brick lettering.

### Colour and motion

`rgb`, `mix(a, b, t)`, `add(a, b)` (saturating), `hue(h)` for the rainbow,
`lerp`, `clamp`, and the easings `outCubic`, `outBack` and `outBounce`.

### Particles

`Particles(capacity)` — positions, velocities, colours and lifetimes in
parallel arrays made once. `spawn` overwrites the oldest when full, `step`
applies gravity and fades, `draw` interpolates by alpha. Nothing allocates
after the constructor.

## break-game

**Owns:** `src/break-game.ts`, `src/break-levels.ts`, `tests/link/break_game*/**`, `tests/self/goldens/**/break-game*`, `tests/self/goldens/**/break-levels*`, `tests/self/goldens/**/break_game*`

Depends on `break-gfx`.

### Levels

Six levels, each text rows plus a name, on a 14-column grid. Brick kinds:
`1`–`3` a normal brick of that many hits (its colour steps down as it is hit),
`S` steel (unbreakable, not counted for clearing), `X` explosive (clears its
eight neighbours, chaining), `?` always drops a power-up, `.` empty.

1. **First Light** — a short plain wall of 1s.
2. **Checkerboard** — 1s and 2s alternating, a few `?`.
3. **The Gate** — steel pillars with a gap the ball must find.
4. **Powder Keg** — explosive bricks threaded through 2s and 3s.
5. **Invaders** — space-invader silhouettes in 3s behind a steel line.
6. **NISH** — the word in 3s, walled in steel, the last stand.

### Difficulty

Difficulty rises **exponentially**: the first two levels are easy, the last is
near impossible. `levelTuning(level)` computes each level's numbers from one
curve, `k = level - 1`, rather than a hand table, so the shape is a fact a
test can check:

| | formula | 1 | 2 | 3 | 4 | 5 | 6 |
|---|---|---|---|---|---|---|---|
| ball speed (world/s) | 90 × 1.25^k | 90 | 113 | 141 | 176 | 220 | 275 |
| paddle width (world) | 48 × 0.8^k | 48 | 38 | 31 | 25 | 20 | 16 |
| speed-up per paddle hit | 1% × 1.5^k | 1% | 1.5% | 2.3% | 3.4% | 5.1% | 7.6% |
| power-up drop chance | 1/6 × 0.6^k | 17% | 10% | 6% | 3.6% | 2.2% | 1.3% |

Speed over paddle width — how hard a return is — grows by about 1.56× a level,
so level 6 asks roughly 9× what level 1 does. The speed cap rises with the
level too, so late levels cannot be slowed back to early ones. Level 6 adds
two pressures of its own: its wall advances one row every 12 seconds (the
game is lost when it reaches the paddle), and catching the slow-ball power-up
there slows the ball by less. "Near impossible" is a goal for the numbers,
not a lock: a perfect player can still clear it.

### Play

Positions are `f64` in world units. The paddle moves with ←/→, A/D or h/l
held and accelerates, so a tap is precise and a hold is fast. Space or ↑
launches a ball resting on the paddle. The outgoing angle depends on where
the ball meets the paddle (the edges send it wide, never flatter than 20° from
horizontal), so the player can aim. Collisions are **swept** against bricks,
walls and paddle, so a ball at level 6's capped speed never tunnels through a
brick. Losing the last ball costs a life; three lives; `p` pauses, and `q` or
Esc while paused quits. `stepBreakGame` draws randomness only from the `Rng`
seeded by `newBreakGame`, so the same seed and inputs give the same game.

### Juice

- **Power-ups** drop as lettered capsules the paddle catches: **W** wide
  paddle, **M** multiball (three balls), **S** slow ball, **C** catch (the
  ball sticks until Space), **F** fireball (passes through bricks, steel
  included, for 8 s), **L** extra life. Timed ones show their time left in
  the HUD.
- **Combo**: bricks broken without the ball touching the paddle multiply the
  score (×1, ×2 … capped at ×8), the points floating up where the brick was.
- **Particles**: a broken brick bursts into pixels of its colour; an explosion
  bursts more and **shakes** the view.
- A glowing **trail** behind each ball.

### Scenes

All inside `GAME_PLAYING`:

- **Intro** (about 1.5 s): the level's bricks drop in row by row with
  `outBounce`; the paddle rises into place; a banner shows `LEVEL n` and the
  name, then `press space`. Any key skips to its end.
- **Level clear**: the ball stops, the time bonus and lives tally into the
  score, then the next level's intro.
- **Pause** overlay with the controls.
- **Game over** and **victory** screens with the score; victory shoots
  fireworks from the particle pool. Enter or Space dismisses them, answering
  `GAME_OVER` or `GAME_WON`.

### Drawing

`drawBreakGame` clears to a dark gradient, draws bricks, capsules, paddle,
balls with glow and trail, particles and floating text, each moving thing at
`lerp(previous, current, alpha)`, then the HUD (score, level, lives as small
balls, active power-ups) with `drawText`, switching to a compact HUD when the
font would be too small.

## break-menu

**Owns:** `src/break-menu.ts`, `tests/link/break_menu*/**`, `tests/self/goldens/**/break-menu*`, `tests/self/goldens/**/break_menu*`

Depends on `break-gfx`.

### The title

`NISH BREAK` in brick lettering, each letter's pixels a small bevelled brick,
with a rainbow shimmer sweeping across it. Behind it, an attract-mode ball
with its glow and trail bounces around the screen, knocking bricks out of a
dim background wall that regrows.

### Items

- **Play**
- **Start level** `< 1 >` — ←/→ cycles 1 to 6
- **How to play** — an overlay with the controls and the power-up letters
- **Quit**

↑/↓, W/S or k/j move the selection with a sliding highlight; Enter or Space
picks; q or Esc quits, except that Esc closes the How to play overlay first.
A footer reads `you found the wall.`

### The outro

Picking Play starts the outro (about 1 s): the logo's bricks come loose and
fall with gravity, the items fade, and a wipe clears the screen.
`stepBreakMenu` answers the chosen level on the step the outro ends, so the
game's intro starts on a cleared screen. Any key skips the outro.

### Drawing

`drawBreakMenu` draws every moving thing at `lerp(previous, current, alpha)`,
and lays the logo out for the framebuffer: brick lettering where each logo
pixel gets at least 2 framebuffer pixels, a plain `drawText` title below that.

## break-play

**Owns:** `src/break.ts`, `src/compile.ts`, `tests/run.js`, `.claude/orientation.md`, `tests/link/break_play*/**`, `tests/self/goldens/**/break.ts*`, `tests/self/goldens/**/break_play*`, `tests/self/goldens/checked/src/compile.ts.txt`, `tests/perf-baseline.json`

Depends on `break-game` and `break-menu`.

### The director

`src/break.ts` holds a `BreakRun` (the scene, the menu, the game, a seed from
`monotonicNanos`) and the named `update` and `render` functions it hands
`runTerminal`. `update` forwards to the scene's step, moves menu → game on a
level, game → menu on `GAME_OVER`, `GAME_WON` or `GAME_QUIT` (keeping the
start level), and answers false on `MENU_QUIT`. `render` draws the scene into
`frame.framebuffer` with `frame.alpha`. `playBreak(): i32` runs it and answers
the exit code.

### Fidelity

- Options: `stepsPerSecond = STEPS_PER_SECOND` (120), `allow120 = true`,
  `maxFps = 120`, `fixedFps = 0`, `prefer = RATE_FIRST` (keep the frame rate,
  let the controller drop resolution or backend first), `mouse = 0`.
- The framebuffer is sized from the terminal's pixel area (`caps` cell size ×
  columns and rows; for half blocks, columns × 2·rows), keeping 16:9 and
  capped at 960×540, at open and again on every `EVENT_RESIZE`. If the
  framebuffer must be sized before the probe answers, start at the half-block
  size and resize once `caps` is known.
- F3 toggles the stats overlay (`drawStatsOverlay`: frame rate, backend,
  bandwidth) — the hidden show-off inside the hidden game.

### Wiring

- `main` calls `playBreak()` in place of the placeholder, under the same
  condition (no file named `break` in the working directory). The riddle and
  the rule that a real file named `break` is compiled stay.
- A pipe on stdin or stdout (`runTerminal`'s `Err`) prints one line to stderr,
  `the wall is only visible in a terminal.`, and exits 1.
- A screen under 40×16 cells shows a centred `make me bigger` until resized.
- Ctrl-C, a panic or a signal leave the terminal as it was (`runTerminal` sets
  the restore string; the pty test checks it).
- The comment above the call in `compile.ts` and the `nish break` line in
  `.claude/orientation.md` drop "the ball is still being made" and say where
  the game lives.

### Cost

Measure on `main` and on the branch, three runs each, with the spread:

- the stripped `build/nish` size, split into what `std/term*` brought and what
  the `break` modules brought;
- the stage1 build time;
- the in-game frame cost from the stats under the relay at the half-block and
  kitty backends.

**Budget**: the whole feature adds at most 10% to the stripped compiler
binary. Over it, shrink first (data tables, shared helpers), and if it is
still over, say so in the PR body with the figures rather than merging
quietly.

## Tests

- `tests/link/break_gfx`, `tests/link/break_game*` and `tests/link/break_menu*`:
  Nish programs, each a `std/testing` `Suite` (`.claude/testing.md` →
  "Testing a Nish program in Nish"), that import their module from `src/`,
  drive it with scripted `TermInput`s (`new TermInput(new KeyState())`, events
  pushed by hand) and assert on state and on pixels of a drawn `Framebuffer`.
  At least: the view mapping at 80×45, 320×180 and 960×540; disc edge
  coverage; a glyph; a ball reflecting off a wall, the paddle and a brick; a
  swept collision at level 6's capped speed hitting the brick it would
  otherwise tunnel through; the paddle angle at the edges; brick hits and an
  explosive chain; each power-up; combo scoring; losing a life and game over;
  clearing a level advancing to the next; **the difficulty curve** (each
  tuned value matches its formula, and the speed-over-width ratio grows by at
  least 1.5× a level); level 6's advancing wall; the intro and outro lengths
  and their skip; menu navigation, level cycling and Quit; interpolation (a
  draw at alpha 0.5 puts the ball between its two positions); no allocation
  growth across 1,000 steady steps where the harness can see it; one drawn
  frame of each scene pinned at a small size. Plus a negative per stage: a
  level of 0 or 7, a 0×0 or 1×1 framebuffer, a pool spawned past capacity —
  each clamped, never a panic.
- `break-play`: a pty test in `tests/run.js` under `tests/term-io/relay.mjs`
  — `nish break`, Enter to play, some frames, Space, F3, p, q, q — that the
  process exits 0, that kitty graphics frames were sent (the relay answers as
  kitty), and that the last bytes are the restore string; and the existing
  checks updated: the riddle and the real-file rule unchanged, `nish break`
  with stdin a pipe now the one line and exit 1.

## Verification

Each stage's `verification` line. CI's four `test` shards are the full-suite
gate. This repo has no coverage tool; the coverage bar, agreed at sign-off, is
that every exported function and every phase above is driven by a check, and
the PR body lists any branch that is not.
