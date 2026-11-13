---
name: nish break on the docs site
overview: Play the `nish break` brick breaker in the browser on the docs site, from the same game code the terminal runs — the scenes compiled to wasm draw into a framebuffer in linear memory, and a TypeScript page host feeds it input and presents it through WebGPU, falling back to WebGL 2 and then Canvas 2D, at the display's own refresh rate.
stages:
  - id: break-core
    title: Make the break scenes host-agnostic and wasm-clean
    goal: The intro, menu and game scenes and the scene director compile for wasm32 with no terminal, file or clock import, while native `nish break` behaves exactly as before.
    verification: npm run check && npm run lint && node tests/run.js break && node tests/run.js term && node tests/run.js self && WASI_SYSROOT=/usr node tests/run.js wasi && node tests/run.js performance && build/nish tests/link/break_core/main.ts --target wasm32 -o build/break-core.ll
    todos:
      - id: core-input-module
        content: Add a pure std/input.ts with StepInput (events plus key state, no nish-colon imports) that the scenes take instead of term-io's TermInput; term-io stays as it is and the terminal shell points a reused StepInput at its input by reference each step — see Break core
      - id: core-director
        content: Split src/break.ts into a host-agnostic director (scene flow, settings record, auto-resolution decision, seed taken as a parameter) and the terminal shell that keeps runTerminal, getenv, toasts and the size prompt — see Break core
      - id: core-settings-hook
        content: Take settings persistence out of src/break-menu.ts behind a load and save pair the host supplies, and mark the terminal-only settings so a non-terminal host can hide them — see Break core
      - id: core-wasm-entry-test
        content: Add tests/link/break_core/main.ts, a pure entry that drives the director through intro, menu and a level with scripted input and prints a framebuffer hash, and check it also compiles with --target wasm32 — see Break core
      - id: core-goldens-docs
        content: Regenerate tests/self/goldens/checked and docs/reference, add the new std module to std/README.md and the standard-library guide page, and add nish-cmp DECLARED entries if any corpus IR moves — see Break core
  - id: page-frame
    title: Add nish/page/frame, a reusable framebuffer presenter and display-rate loop
    goal: Any Nish wasm program that draws into a 0xRRGGBB framebuffer can be put on a canvas through WebGPU, WebGL 2 or Canvas 2D (first that works, with runtime fallback on device loss) and driven by a fixed-step loop that renders on every animation frame.
    verification: npm run check && npm run lint && node tests/run.js page-frame
    todos:
      - id: frame-presenter
        content: Write runtime/page-frame.mjs and runtime/page-frame.d.ts with createPresenter(canvas, options) trying WebGPU, then WebGL 2, then Canvas 2D, recording each refusal and falling to the next tier on device or context loss — see Page frame
      - id: frame-loop
        content: Add runFixedStep to the same module, a requestAnimationFrame loop with an accumulator, a max-steps-per-frame guard, an interpolation alpha and a refresh-rate estimate, never capped below the display rate — see Page frame
      - id: frame-export
        content: Export it as nish/page/frame from package.json and document it in the In a browser section of docs/guide/using-nish/interop.md — see Page frame
      - id: frame-tests
        content: Add a page-frame section to tests/run.js that runs the presenter and loop under Node against fake WebGPU, WebGL 2 and Canvas 2D objects, plus the Playwright smoke recorded in the PR body — see Page frame
  - id: game-std
    title: Move the reusable game pieces into std
    goal: The software raster, the sound synthesis and the host layout a browser game shares with its page are std modules, and nish break draws and sounds through them with byte-identical output.
    verification: npm run check && npm run lint && node tests/run.js break && node tests/run.js std_raster && node tests/run.js std_synth && node tests/run.js std_host_game && node tests/run.js self && WASI_SYSROOT=/usr node tests/run.js wasi && node tests/run.js performance && node scripts/gen-reference.mjs --check
    todos:
      - id: std-raster
        content: Move the generic primitives of src/break-gfx.ts (rects, blends, discs, glow, gradients, the 5x7 font, particles) into std/raster.ts over the term-pixels Framebuffer and draw break through it — see Game std
      - id: std-synth
        content: Move the pure voice synthesis of src/break-sound.ts (square, triangle, noise, envelopes, to f64 samples) into std/synth.ts and build break's sounds through it — see Game std
      - id: std-host-game
        content: Add std/host/game.ts, the layout a game shares with its page (framebuffer, input ring, sound queue, frame size) and the Nish-side helpers over it — see Game std
      - id: std-game-tests-docs
        content: Add link cases for the three modules, regenerate goldens and docs/reference, list them in std/README.md and the standard-library guide page — see Game std
  - id: game-page
    title: Add nish/page/game, a one-call browser game harness, a starter and a guide page
    goal: A Nish file that exports init, step and draw over nish/host/game becomes a running browser game with one startGame call, with fallback rendering, input, sound and a display-rate loop handled.
    verification: npm run check && npm run lint && npm run lint:dead && node tests/run.js game-page && node docs/check-links.mjs && node tests/run.js guide
    todos:
      - id: page-game-harness
        content: Write runtime/page-game.mjs and .d.ts with startGame(canvas, wasmUrl, options) composed from nish/page/frame, the ring page half and WebAudio — see Game page
      - id: page-game-starter
        content: Add examples/game-starter, a short complete Nish game and its page that a reader copies to start a new one — see Game page
      - id: page-game-guide
        content: Add a Writing a browser game guide page with its scalar.config.json route, linked from the interop page — see Game page
      - id: page-game-tests
        content: Add a game-page section to tests/run.js that builds the starter and drives startGame under Node with a fake presenter and audio — see Game page
  - id: persist-root
    title: Let a wasm-host module keep an object root between calls
    goal: A wasm-host module can hold one object graph (a class instance and everything reachable from it) alive across exported calls, with memory that stays bounded over a long session, so an object-based game like the break director runs behind init, step and draw unchanged.
    verification: npm run check && npm run lint && node tests/run.js persist && node tests/run.js wasm-host && node tests/run.js module-storage && node tests/run.js self && WASI_SYSROOT=/usr node tests/run.js wasi && node tests/run.js performance && node scripts/gen-reference.mjs --check && node tests/nish-cmp.js
    todos:
      - id: persist-design
        content: Write the design note (docs/wp52-persistent-root.md or the next free WP number) choosing the mechanism, the language surface, the memory model across export calls and the refusals, after reading the WP6 arena and WP50 wasm-host notes — see Persist root
      - id: persist-impl
        content: Implement it in src/ (checker, emitter, interop loader) and runtime/runtime-wasm.c, with its security-record line — see Persist root
      - id: persist-tests
        content: Add the construct's golden .ll, llvm-as pass, a wasm round trip driven from a page harness over many calls showing memory stays flat, and negative tests for every refusal — see Persist root
      - id: persist-docs
        content: Add the docs/LANGUAGE.md rule, the cookbook entry and the guide changes (interop In a browser, browser-games), regenerate goldens and docs/reference — see Persist root
  - id: docs-break
    title: Put the brick breaker behind the hero terminal on the docs site
    goal: Typing `nish break` into the landing page's hero terminal opens the game, compiled from the break-core scenes to wasm and presented through nish/page/frame, with sound, touch and persisted settings, and nothing in the guide prose mentions it.
    verification: npm run check && npm run lint && node docs/check-links.mjs && node tests/run.js break-web && node examples/break-web/build.mjs --check
    todos:
      - id: web-entry
        content: Write examples/break-web/game.ts, the wasm entry that runs the director over nish/host/game, and the host imports for settings and seed — see Docs break
      - id: web-page
        content: Write examples/break-web/page.ts as a startGame call from nish/page/game plus the overlay and localStorage settings — see Docs break
      - id: web-build
        content: Write examples/break-web/build.mjs to build into docs/site/break/ with an inputs manifest, and a --check mode that fails when a source the bundle was built from has changed since — see Docs break
      - id: web-trigger
        content: Make the hero terminal in docs/site/site.js accept typed input and open the game in an overlay on `nish break`, the whole game (page code, presenter, loader and wasm) arriving only then through one async dynamic import, with Escape and a close control to leave — see Docs break
      - id: web-tests
        content: Add a break-web section to tests/run.js that runs the page logic under Node for a scripted session and holds its framebuffer hash to the native tests/link/break_core run, both --deterministic — see Docs break
      - id: web-shell
        content: Make the hero terminal answer nish, nish --help and nish --version with the real CLI output generated at build time from src/cli-style.ts, the near-miss riddle, and an in-character fallback, from a tiny shell chunk loaded on the first keypress — see Docs break
      - id: web-rule
        content: Update the nish break line in .claude/orientation.md to name the docs-site copy and keep the undocumented rule for it — see Docs break
---

## Context

`nish break` is the compiler's hidden brick breaker (`src/break.ts` and `src/break-*.ts`). Its scenes are already pure: each exports `stepX(state, input)` at a fixed 120 steps per second, plus `drawX(state, fb, alpha)`, which interpolates and software-rasterises into a `Framebuffer`. A `Framebuffer` is `{ width, height, pixels: i32[] }` of `0xRRGGBB` ([std/term-pixels.ts](../../std/term-pixels.ts)).

The terminal-specific parts are:

- The `TermInput` type imported from `nish/term-io`, which also pulls in `nish:term` and `nish:process`.
- The director's `runTerminal` loop, clock and `getenv` in [src/break.ts](../../src/break.ts).
- The settings file I/O in [src/break-menu.ts](../../src/break-menu.ts).
- The `afplay`/`aplay` spawning in [src/break-sound.ts](../../src/break-sound.ts). `soundSamples(id)` there is pure.

[examples/wasm-arena](../../examples/wasm-arena) is already a working wasm-plus-page template. It has module storage read through `views()`, a WebGPU path with a WebGL 2 fallback, and a `build.mjs` that needs no bundler. The docs site serves `docs/site/` from its root (`assetsDir`) and loads `docs/site/site.js` on every page; that script builds the landing hero, which includes a terminal window.

## Approach

- **The shared data structure is the framebuffer.** The wasm side runs the director, the scenes and the drawing unchanged. It writes pixels into module storage, and TypeScript only uploads them. Because the browser runs the same step and draw code the terminal runs, the game is the same by construction rather than by porting. The alternative was to export draw lists and redraw them in WGSL; that would duplicate every shape in `break-gfx.ts` twice and drift.
- **Presentation is a texture upload and one quad.** WebGPU uploads to a `bgra8unorm` texture: the little-endian `0x00RRGGBB` is already B,G,R,0, and the shader forces alpha to 1. WebGL 2 swizzles in its shader. Canvas 2D swizzles into an `ImageData`, and is the failsafe that needs no GPU. All three scale with nearest-neighbour inside a letterbox. The presenter falls to the next tier when a device or context is lost, rather than telling the reader to reload.
- **Frame rate.** The simulation stays at the terminal's 120 steps per second. The page renders on every `requestAnimationFrame` with the interpolation `alpha`, so a 240 Hz display gets 240 distinct frames, and nothing caps it below the display. The director's auto-resolution step keeps the software raster inside the frame budget. The approach follows the CS client's fixed-step accumulator and frame pacer; it is re-implemented, not copied, because that repository carries no licence.
- **Reusable pieces go to the library**:
  - Nish side: the pure input module, so terminal and browser hosts share key state and events.
  - Page side: `nish/page/frame`, so any browser game can use the presenter and the loop.
- **Still an easter egg.** The `.claude/orientation.md` rule keeps `nish break` out of `docs/guide`, `llms.txt` and `docs/AI.md`. Its only discovery path stays the terminal: the hero's terminal window on the landing page takes typed input, and `nish break` there opens the game. No page prose mentions it.
- **Hosting.** Scalar publishes the repository's files, and no CI job builds the site, so the built bundle (`.wasm`, `.mjs`) is committed under `docs/site/break/`. `build.mjs --check` compares a manifest of input hashes rather than bytes, so an LLVM or wasm-opt minor version cannot turn CI red while a stale bundle still can.

## Break core

**Owns:** `src/break*.ts`, `std/term-io.ts`, `std/term.ts`, `std/input.ts`, `scripts/gen-reference.mjs` (the AREAS entry), `tests/link/std_input/**`, `std/README.md`, `docs/reference/**`, `scalar.config.json`, `docs/guide/using-nish/standard-library.md`, `tests/link/break_*/**`, `tests/self/goldens/checked/**`, `tests/nish-cmp.js`, `scripts/undocumented.txt`

The rules for this stage:

- **Native behaviour is frozen.** The `break` pty test, `tests/link/break_game` and its expected output pass unchanged. This stage is a refactor of where code lives.
- **Input module.** `std/input.ts` (`nish/input`) is pure: no `nish:` import, so it compiles for `wasm32`. It holds `StepInput`: the events and the key state, whose types and constants already live in the pure `nish/term`.
  - **Why not re-export from term-io.** The language cannot make term-io's `TermInput` satisfy an imported interface. `implements` resolves only local structs, and `export {} from` is refused. A checker fix would not help `src/` under the rolling freeze either.
  - **How the hosts share it.** `nish/term-io` and its `TermInput` are unchanged, so this is no public API break. The terminal shell points one reused `StepInput` at term-io's events and keys by reference each step.
  - **Tests.** `tests/link/break_{game,intro,menu}` may switch their drivers to `StepInput`, but their `expected.out` stays byte-identical.
  - **Extra files.** `scripts/gen-reference.mjs` needs an `AREAS` entry for the module, and `tests/link/std_input` is its link case.
- **Director.**
  - The host-agnostic part takes the seed, the settings record and the help text as inputs. It returns the scene answer each step, and the draw call takes the framebuffer and `alpha`.
  - Auto-resolution is a decision the director makes from frame times the host reports, so both hosts share it.
  - The terminal shell stays in `src/break.ts`.
- **Settings.** The host supplies a load and save pair over a small fixed record. Native keeps the existing file. Settings that only mean something in a terminal (pixel backend, terminal fps) carry a flag so a browser host can leave them off the menu.
- **Freeze rules.**
  - `src/` is built by the seed under the rolling freeze, so no construct newer than the seed is allowed.
  - Follow `.claude/selfhost.md`: regenerate the goldens with `node tests/self/goldens.js --update`, and run `wasi` and `performance` before pushing.
  - A new std module lands with doc comments, a `@param` per parameter and a `@returns` per non-void return, a regenerated `docs/reference/`, and a `tests/link` importer.
- **`tests/run.js`.** This stage does not edit it; the page-frame stage owns it while both run at once. The `wasm32` compile of `tests/link/break_core` is proved by the verification command here, and the break-web section guards it for good.

## Page frame

**Owns:** `runtime/page-frame.mjs`, `runtime/page-frame.d.ts`, `package.json`, `tests/page-frame/**`, `tests/run.js`, `tests/shard-costs.json`, `docs/guide/using-nish/interop.md`

```ts
type Backend = "webgpu" | "webgl2" | "canvas2d"
interface Presenter {
  readonly backend: Backend
  readonly attempts: readonly { backend: Backend; reason: string }[]
  present(pixels: Int32Array, width: number, height: number): void  // 0xRRGGBB, row-major
  resize(cssWidth: number, cssHeight: number, devicePixelRatio: number): void
  destroy(): void
}
function createPresenter(canvas: HTMLCanvasElement, options?: { prefer?: Backend; onFallback?(from: Backend, to: Backend, reason: string): void }): Promise<Presenter>
function runFixedStep(options: { stepsPerSecond: number; maxStepsPerFrame?: number; step(): void; render(alpha: number, frameMs: number): void }): { stop(): void; readonly refreshHz: number; readonly fps: number }
```

- **WebGPU path.**
  - `requestAdapter` returning null, `requestDevice` rejecting and `getContext("webgpu")` returning null are each a recorded refusal.
  - `device.lost` and `webglcontextlost` cause a rebuild on the next tier, through the existing canvas or a replacement canvas, because a canvas keeps the first context type it was given.
  - Every refusal is reported through `onFallback`, so a fallback is never silent.
- **Loop.** The `?renderer=webgl2|canvas2d`-style override is the caller's to read; the module takes `prefer`. The loop clamps a long frame (a hidden tab) to a quarter second and allows 8 steps per frame at most.
- **Plain ESM.** The file has no imports, like `runtime/page.mjs`, so a page can serve it as-is.
- **Tests.** Node-side fakes check tier order, every refusal path, a lost device moving to the next tier, the Canvas 2D swizzle, and the loop's step count and alpha over a scripted clock. Run a Playwright smoke in the pre-installed Chromium for each tier: WebGPU, `navigator.gpu` hidden, and both GPU contexts refused. Paste its output into the PR body; CI has no browser, so it is not a `tests/run.js` gate.

## Where the library pieces live

The standard library has two halves:

- **The Nish side, in `std/`.** It compiles into the game's wasm: `nish/input`, `nish/raster`, `nish/synth` and `nish/host/game`.
- **The page side, in `runtime/`.** It is shipped as `nish/page/*` and is plain JavaScript, because WebGPU, WebGL, Canvas, WebAudio and DOM events only exist in the page. `nish/page/frame` holds the presenter with its fallback and the loop. `nish/page/game` holds `startGame`.

This is the pattern `nish/host/ring` and its page half `ringOver` in `nish/page` already follow. JavaScript does not go under `std/`, which is Nish source end to end (the `./*` export, gen-reference, the checker).

## Game std

**Owns:** `std/raster.ts`, `std/synth.ts`, `std/host/game.ts`, `src/break*.ts`, `std/README.md`, `docs/reference/**`, `scalar.config.json`, `docs/guide/using-nish/standard-library.md`, `scripts/gen-reference.mjs` (AREAS), `tests/link/std_raster/**`, `tests/link/std_synth/**`, `tests/link/std_host_game/**`, `tests/link/break_*/**`, `tests/self/goldens/checked/**`, `tests/nish-cmp.js`, `scripts/undocumented.txt`

**Depends on:** break-core (start), because it owns `src/break*.ts` until it merges.

- **Library pieces.** Everything moved is general: names and doc comments say nothing about bricks. Game-specific drawing, such as `bevelBrick`, stays in `src/break-gfx.ts`, built on `nish/raster`.
- **Behaviour.** `tests/link/break_*` expected outputs and the `break` pty test stay byte-identical.
- **`nish/host/game`.**
  - It documents the module-storage names and shapes a game declares:
    - a framebuffer of at most 960×540 `i32` words;
    - the current width and height;
    - an input ring of key events and held-key bits;
    - a sound queue ring of sound ids.
  - It provides the helpers that read input into a `StepInput` and push sounds.
  - `nish/page/game` reads the same names through `views().storage`.
  - If module storage cannot be declared inside an imported module, the program declares the arrays and passes them in, as `nish/host/ring` does.

## Game page

**Owns:** `runtime/page-game.mjs`, `runtime/page-game.d.ts`, `package.json`, `examples/game-starter/**`, `docs/guide/using-nish/browser-games.md`, `scalar.config.json`, `docs/guide/using-nish/interop.md`, `tests/game-page/**`, `tests/run.js`, `tests/shard-costs.json`

**Depends on:** game-std and page-frame (start).

- **`startGame(canvas, wasmUrl, { seed, prefer, keys, touch, sound, onFallback })`.** It returns `{ stop, presenter, module, fps, refreshHz }`.
  - **Loading.** It loads the module asynchronously with streaming instantiation.
  - **Presenting.** It builds the presenter through `nish/page/frame`.
  - **Input.** It maps keyboard events, and pointer and touch zones, onto the input ring, releasing held keys on blur and when the page is hidden.
  - **Sound.** It plays the sound queue through WebAudio once the user has interacted.
  - **Loop.** It runs `step` and `draw` through `runFixedStep` at the display's rate.
  - **Framebuffer.** It presents the framebuffer view without copying.
- **The starter.** `examples/game-starter/` is a complete small game, under about 150 lines of Nish, plus an `index.html` of a few lines and a build script. A reader copies it to begin. The guide page walks through it.
- **Not the game.** Neither the page nor the starter mentions `nish break`.

## Persist root

**Owns:** `src/**`, `runtime/runtime-wasm.c`, `runtime/page.mjs`, `runtime/page.d.ts`, `docs/LANGUAGE.md`, `docs/IR_COOKBOOK.md`, `docs/cookbook/**`, `docs/wp52-*.md` (the next free WP number), `docs/roadmap/**`, `docs/security/**` (the record covering runtime-wasm.c), `docs/guide/using-nish/interop.md`, `docs/guide/using-nish/browser-games.md`, `docs/reference/**`, `scalar.config.json`, `tests/cases/**`, `tests/ir/**`, `tests/link/**`, `tests/differential/**`, `tests/self/goldens/checked/**`, `tests/run.js`, `tests/shard-costs.json`, `tests/nish-cmp.js`, `tests/persist/**`, `std/host/game.ts`, `scripts/undocumented.txt`

**Depends on:** game-page (start). It edits files game-page owns (`tests/run.js`, `runtime-wasm.c`, the guide pages).

This stage was added after sign-off. docs-break found that a wasm-host module cannot keep the break director between `step()` calls: module storage holds only flat arrays and structs (LANGUAGE.md, "Module storage"), and the loader releases each call's arena allocations when the call returns. The user chose to fix that in the compiler rather than work around it.

- **Requirement.** One object root survives across export calls, and anything the game links into it during a call survives too. Memory stays bounded over hours at 120 steps per second.
- **Constraint.** The surface is minimal and refusable at compile time: the native build, the TS reading and `--deterministic` behave as specified.
- **Design note first.** The worker writes it, then implements.

## Docs break

**Owns:** `examples/break-web/**`, `docs/site/**`, `.claude/orientation.md`, `tests/run.js`, `tests/shard-costs.json`, `.gitignore`

**Depends on:** persist-root (start), and through it every other stage. Break is one more game on the kit: the entry runs the director over `nish/host/game`, and the page is a `startGame` call plus the overlay, the trigger and the `localStorage` settings.

- **Entry, `game.ts`.**
  - It holds the framebuffer at its largest size (960×540, the kitty ceiling) and an input block in module storage. The input block has held-key bits and a small press-event ring through `nish/host/ring`.
  - It also holds a sound queue of `SOUND_*` ids drained per frame.
  - It exports `init(seed)`, `step()`, `draw(alpha, frameMs)` and the current `width()` and `height()`.
  - It is compiled with `--deterministic --target wasm32` and linked `--profile wasm-host --memory <N>`, so `memory.buffer` never detaches.
- **Page, `page.ts`.**
  - **Keys.** The same keys the terminal reads: arrows, A/D and H/L, Space and Enter, Escape, P, and the F keys the menu uses.
  - **Touch.** Left and right halves steer, and a tap serves or confirms.
  - **Events.** It calls `preventDefault` only while the game is open, and releases all held keys on `blur` and `visibilitychange`.
  - **Sound.** WebAudio buffers are built once from `soundSamples(id)` through the wasm export. Sound starts muted until the first keypress (autoplay policy) and follows the menu's sound setting.
  - **Settings.** They persist in `localStorage`.
- **Trigger.**
  - `site.js` makes the hero terminal focusable. After its animation, a caret waits, and typing `nish break` then Enter opens a full-viewport overlay holding the canvas.
  - **Lazy, async, and small for everyone else.** `site.js` gains only the hero-terminal input handler: a few hundred bytes, with no game code, no presenter and no wasm loader. Everything else comes in through a single dynamic `import()` of `docs/site/break/break.mjs`, issued only on `nish break` + Enter:
    - the overlay;
    - the page host;
    - `nish/page/frame`;
    - the generated loader.

    That module fetches the `.wasm` as its own file with `WebAssembly.instantiateStreaming`, falling back to `fetch` plus `instantiate` when the server's MIME type is wrong. It does not use `loadSync`, inlined base64 bytes, a `<link rel=preload>` or a prefetch. Readers who never type the command download nothing extra.
  - A loading line shows in the hero terminal while the import is in flight. A failed load prints an error line there and leaves the page usable.
  - Escape on the title, or the close control, removes the overlay and stops the loop.
  - The guide markdown is not touched.
- **Tests and build.**
  - The `break-web` section builds the bundle into `build/`. It runs `page.ts`'s loop under Node with a fake presenter for a scripted session, the way `examples/wasm-arena/node-run.mjs` does, and compares the framebuffer hash at fixed steps to the native `tests/link/break_core` binary built `--deterministic`.
  - It also runs `build.mjs --check` against the committed bundle.
  - It asserts that `site.js` reaches the game only through one dynamic `import()`: no static import, no preload and no reference to the `.wasm`. It also asserts that the gzipped growth of `site.js` stays under 1 KB against a baseline recorded in the test. The PR body gives the before and after sizes of `site.js` and the size of the lazy bundle.
  - Record in the PR body the Playwright run against `docs/site/` served locally: all three tiers, the measured per-frame cost of `draw` plus `present` at 960×540, and a screenshot.

### The hero shell (added after sign-off)

The user asked for the hero terminal to answer a few real commands. They come from a tiny chunk, `docs/site/break/shell.mjs`, which is imported on the first keypress in the hero and is separate from the game bundle, so `site.js` stays under its 1 KB growth budget.

- **`nish` and `nish --help`.** They print the CLI's real help. `build.mjs` generates the text from `src/cli-style.ts` by running the built compiler's `--help`, and records it in the input manifest, so `--check` fails when it drifts. The wall under the title stays.
- **`nish --version`.** It prints the real version.
- **Near-miss words** (`game`, `play`, `brick`, `bricks`, `breakout`). They print the same riddle `src/compile.ts` prints.
- **`nish break`.** It opens the game.
- **Anything else.** It gets one in-character line pointing at `nish --help`.
- **Tests.** The `break-web` section asserts that the shell's help equals the CLI's `--help`, that the riddle matches, and that `site.js` still reaches the shell and the game only through dynamic imports.

## Out of scope

- A full in-browser compiler playground in the hero, such as `nish compile` showing the example's IR through the `web/` wasm build. That is a follow-up run.

- Porting `examples/wasm-arena` onto `nish/page/frame`.
- Any change to `.github/workflows/`.
- A docs page, `llms.txt` or `docs/AI.md` entry for the game.

## Verification

Each stage's `verification` line, plus CI's eight test shards, `bootstrap`, `nish-cmp` and `lint` on the PR head.
