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
  - id: docs-break
    title: Put the brick breaker behind the hero terminal on the docs site
    goal: Typing `nish break` into the landing page's hero terminal opens the game, compiled from the break-core scenes to wasm and presented through nish/page/frame, with sound, touch and persisted settings, and nothing in the guide prose mentions it.
    verification: npm run check && npm run lint && node docs/check-links.mjs && node tests/run.js break-web && node examples/break-web/build.mjs --check
    todos:
      - id: web-entry
        content: Write examples/break-web/game.ts, the wasm entry that owns the director and exposes the framebuffer, the input block and the sound queue as module storage, and examples/break-web/host.ts for the settings and seed imports — see Docs break
      - id: web-page
        content: Write examples/break-web/page.ts, which maps keyboard, pointer and touch events to the input block, runs nish/page/frame at display rate, plays the sound queue through WebAudio from soundSamples, and stores settings in localStorage — see Docs break
      - id: web-build
        content: Write examples/break-web/build.mjs to build into docs/site/break/ with an inputs manifest, and a --check mode that fails when a source the bundle was built from has changed since — see Docs break
      - id: web-trigger
        content: Make the hero terminal in docs/site/site.js accept typed input and open the game in an overlay on `nish break`, the whole game (page code, presenter, loader and wasm) arriving only then through one async dynamic import, with Escape and a close control to leave — see Docs break
      - id: web-tests
        content: Add a break-web section to tests/run.js that runs the page logic under Node for a scripted session and holds its framebuffer hash to the native tests/link/break_core run, both --deterministic — see Docs break
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

## Docs break

**Owns:** `examples/break-web/**`, `docs/site/**`, `.claude/orientation.md`, `tests/run.js`, `tests/shard-costs.json`, `.gitignore`

**Depends on:** break-core and page-frame. It consumes the director, the settings hook, the input module and `nish/page/frame`, so it starts when both have merged.

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

## Out of scope

- Moving the generic raster primitives in `src/break-gfx.ts` (rects, discs, glow, the 5×7 font) into a std module. That is a natural follow-up once a second game wants them.
- Porting `examples/wasm-arena` onto `nish/page/frame`.
- Any change to `.github/workflows/`.
- A docs page, `llms.txt` or `docs/AI.md` entry for the game.

## Verification

Each stage's `verification` line, plus CI's eight test shards, `bootstrap`, `nish-cmp` and `lint` on the PR head.
