---
name: WP89 — nish-gfx, GPU graphics and a 2D game layer in std/
overview: Nish draws only into a software framebuffer the browser page presents, and has no native window or GPU access. Add std/gpu (a safe WebGPU core) and std/gfx (an engine-style app runner, input, an instanced SpriteBatch, dynamic resolution and a framebuffer-present mode), on Linux and macOS through a C shim over SDL3 and wgpu-native linked only into programs that call it, and in the browser through host imports, with Windows gated on WP79.
priority: 260
labels: [ready]
issue: 2235
stages:
  - id: s1-design
    title: WP89 S1 — the design note, the shim's ABI and the pinned toolchain
    goal: Settle the API, the shim ABI, the frame model, the web transport and the auto-scaling controller in docs/wp89-gfx.md before any code lands
    verification: docs/wp89-gfx.md answers every question in its section of the plan, each with a citation or a measurement, and node docs/check-links.mjs passes
    issue: 2236
    todos:
      - id: s1-note
        content: Write docs/wp89-gfx.md — API surface, shim ABI, frame model, web transport, auto-scaling, budgets — see WP89 S1
        status: pending
      - id: s1-pins
        content: Pin the SDL3 and wgpu-native releases and their webgpu.h in the note, with each artifact's sha256 — see WP89 S1
        status: pending
  - id: s2-typed-buffers
    title: WP89 S2 — numeric typed arrays as buffers a declared C function borrows
    goal: A declare function takes f32[], u16[], u32[] and i32[] (and readonly) buffers with an element count, under the u8[] buffer rule, so vertex data reaches C with no copy
    verification: tests/cases for each element type round-trip through C with goldens and llvm-as, the negatives fire with their codes, and node tests/run.js ffi, wasi and performance pass
    issue: 2237
    todos:
      - id: s2-checker-emit
        content: Accept numeric typed-array buffer runs in the checker, emitter and c-import, count in elements — see WP89 S2
        status: pending
      - id: s2-rule-docs
        content: Rewrite the LANGUAGE.md buffer rule, its cookbook entry and the interop guide section — see WP89 S2
        status: pending
      - id: s2-tests
        content: Add tests/cases goldens, a native round trip and tests/link negatives for each new refusal — see WP89 S2
        status: pending
  - id: s3-shim
    title: WP89 S3 — the C shim, the link wiring, the fetch script and the CI lane
    goal: runtime/gfx/ builds against pinned SDL3 and wgpu-native, build.sh links it only for a program that declares a nishgfx_ function, and a C triangle draws on a software GPU in CI
    verification: The C triangle test reads back the expected pixels under lavapipe in the new gfx CI job, a program without nishgfx_ links none of it, and node scripts/security-scope.mjs passes
    issue: 2238
    todos:
      - id: s3-fetch
        content: Add scripts/fetch-gfx.sh to fetch the pinned SDL3 and wgpu-native into build/gfx/ with sha256 checks — see WP89 S3
        status: pending
      - id: s3-shim-c
        content: Write runtime/gfx/nish-gfx.h and nish-gfx.c — window, surface, sync adapter and device, events, readback — see WP89 S3
        status: pending
      - id: s3-build-sh
        content: Link runtime/gfx/ and SDL3 and wgpu-native in build.sh and run-cache.ts when the IR declares nishgfx_ — see WP89 S3
        status: pending
      - id: s3-c-triangle
        content: Add the C triangle test and the gfx section in tests/run.js with a SKIP line naming the missing library — see WP89 S3
        status: pending
      - id: s3-ci
        content: Add the gfx CI job with lavapipe and fetch-gfx.sh, and its ci-scope read set — see WP89 S3
        status: pending
      - id: s3-security
        content: Write docs/security/gfx.md and its index row, and extend security-scope.mjs to runtime/gfx/ — see WP89 S3
        status: pending
  - id: s4-raw-bindings
    title: WP89 S4 — raw bindings by nish c-import and the clear-screen example
    goal: std/gpu/sys.ts is generated from the shim header with nish c-import, and a Nish program opens a window and clears it every frame
    verification: The regeneration check passes, examples/gfx/clear.ts reads back the clear colour in the gfx CI job, and the reference regenerates
    issue: 2239
    todos:
      - id: s4-cimport
        content: Generate std/gpu/sys.ts from runtime/gfx/nish-gfx.h with nish c-import and add a check that it is current — see WP89 S4
        status: pending
      - id: s4-clear
        content: Add examples/gfx/clear.ts and its tests/run.js readback check — see WP89 S4
        status: pending
  - id: s5-gpu-core
    title: WP89 S5 — std/gpu, the safe WebGPU core
    goal: Handle classes closed with using for device, surface, buffers, shaders, pipelines, textures, samplers and bind groups, with resize and device-lost handled
    verification: examples/gfx/triangle.ts draws an indexed coloured triangle that matches its reference pixels in CI, every public declaration is documented, and the guide page exists
    issue: 2240
    todos:
      - id: s5-context
        content: Add std/gpu/context.ts — instance, adapter, device, surface, resize, device lost — see WP89 S5
        status: pending
      - id: s5-buffer
        content: Add std/gpu/buffer.ts — typed vertex, index and uniform buffers and writeBuffer — see WP89 S5
        status: pending
      - id: s5-pipeline
        content: Add std/gpu/pipeline.ts — WGSL modules and a render pipeline builder — see WP89 S5
        status: pending
      - id: s5-texture
        content: Add std/gpu/texture.ts — textures, uploads, samplers and bind groups — see WP89 S5
        status: pending
      - id: s5-triangle
        content: Add examples/gfx/triangle.ts, its readback check and docs/guide/using-nish/gpu.md — see WP89 S5
        status: pending
  - id: s6-target-files
    title: WP89 S6 — a module file chosen by target
    goal: A std module and a package export can offer one file for wasm32 and another for native, so std/gpu keeps one API over two backends
    verification: tests/link cases resolve the wasm32 and native files for std and for a package, the bootstrap fixed point holds, and the rule is in LANGUAGE.md
    issue: 2241
    todos:
      - id: s6-resolve
        content: Resolve a target-specific file for std modules and for a nish-wasm32 exports condition — see WP89 S6
        status: pending
      - id: s6-docs-tests
        content: Add the LANGUAGE.md rule, the package guide paragraph and tests/link cases — see WP89 S6
        status: pending
  - id: s7-web-backend
    title: WP89 S7 — std/gpu in the browser over host imports
    goal: The same std/gpu programs build for wasm32 and draw through a page-side WebGPU module that ships as nish/page/gpu
    verification: examples/gfx/triangle.ts builds for wasm32 unchanged and matches its reference pixels in headless Chromium on SwiftShader, and the guide page covers the browser
    issue: 2242
    todos:
      - id: s7-page-gpu
        content: Add runtime/page-gpu.mjs and its d.ts, the host side of std/gpu, exported as nish/page/gpu — see WP89 S7
        status: pending
      - id: s7-wasm-backend
        content: Add the wasm32 backend file of std/gpu over host imports and the per-frame command ring — see WP89 S7
        status: pending
      - id: s7-browser-test
        content: Add the headless Chromium readback check for the triangle and the browser section of the guide page — see WP89 S7
        status: pending
  - id: s8-game-layer
    title: WP89 S8 — std/gfx, the app runner, input, SpriteBatch and framebuffer present
    goal: A 2D game is written against step, update and draw hooks, input and a batched sprite renderer, and the same source runs natively and in the browser
    verification: examples/gfx/sprites.ts runs on both backends in CI, game-starter runs natively through framebuffer present, and the runner's step accounting and wait-for-events frame accounting are pinned by Nish tests
    issue: 2243
    todos:
      - id: s8-runner
        content: Add std/gfx/app.ts — optional step, update and draw hooks, accumulator, frames in flight — see WP89 S8
        status: pending
      - id: s8-input
        content: Add std/gfx/input.ts — keyboard, mouse, touch and gamepad over std/input types on both backends — see WP89 S8
        status: pending
      - id: s8-sprites
        content: Add std/gfx/sprite.ts — instanced SpriteBatch, ring vertex buffer, ortho camera, atlases — see WP89 S8
        status: pending
      - id: s8-framebuffer
        content: Add std/gfx/framebuffer.ts to present a nish/raster framebuffer, and run game-starter natively — see WP89 S8
        status: pending
      - id: s8-examples-guide
        content: Add examples/gfx/sprites.ts and docs/guide/using-nish/gfx-games.md with its scalar.config.json route — see WP89 S8
        status: pending
      - id: s8-idle
        content: Add the wait-for-events mode and requestRedraw to std/gfx/app.ts and nish/page/gfx, and its section in docs/wp89-gfx.md — see WP89 S8
        status: pending
  - id: s9-performance
    title: WP89 S9 — auto-scaling, present-mode choice and the sprite bench
    goal: The runner holds the display rate by scaling internal resolution, picks the fastest present mode, and the 10,000-sprite cost is pinned and measured
    verification: The controller test converges under synthetic load, the CI sprite and idle benches stay inside their pinned budgets, and docs/BENCHMARKS.md records a real-GPU run at 60 FPS or better
    issue: 2244
    todos:
      - id: s9-controller
        content: Add the dynamic-resolution controller in std/gfx/scale.ts and its synthetic-load test — see WP89 S9
        status: pending
      - id: s9-present
        content: Choose mailbox, immediate or fifo by what the surface offers and the runner's vsync option — see WP89 S9
        status: pending
      - id: s9-bench
        content: Add bench/gfx-sprites with a pinned CPU budget per frame in CI and a real-GPU record in docs/BENCHMARKS.md — see WP89 S9
        status: pending
      - id: s9-idle-bench
        content: Add bench/gfx-idle measuring idle CPU and redraw latency in wait-for-events mode, with pinned bounds — see WP89 S9
        status: pending
  - id: s10-windows
    title: WP89 S10 — Windows, once WP79 ships its core runtime
    goal: std/gpu and std/gfx programs cross-link for x86_64-w64-windows-gnu and draw on DX12
    verification: examples/gfx/triangle.ts cross-links from Linux and reads back its reference pixels on a Windows runner on the WARP adapter
    issue: 2245
    todos:
      - id: s10-link
        content: Fetch the Windows SDL3 and wgpu-native builds and cross-link the shim through WP79's path — see WP89 S10
        status: pending
      - id: s10-ci
        content: Run the gfx readback checks on a Windows runner on WARP — see WP89 S10
        status: pending
---

# WP89 — nish-gfx

## Context

Nish draws today only in the browser, and only in software. A wasm32 game writes 0xRRGGBB pixels into `GAME_FRAME` ([std/host/game.ts](../../std/host/game.ts), [std/raster.ts](../../std/raster.ts)). The page's presenter uploads them through WebGPU, WebGL 2 or Canvas 2D ([runtime/page-frame.mjs](../../runtime/page-frame.mjs)) and drives the fixed-step `init`/`step`/`draw` exports ([browser-games guide](../../docs/guide/using-nish/browser-games.md)). There is no native window, no GPU draw call from Nish, and no SDL, wgpu, Dawn or mobile plan or issue.

What the compiler offers this work, from the research:

| Fact | Where | Consequence |
| --- | --- | --- |
| C structs cross only by pointer, and nothing is passed by value | [LANGUAGE.md](../../docs/LANGUAGE.md) `declare class` | webgpu.h's by-value `WGPUStringView`, callback infos and `WGPUFuture` stay inside a C shim |
| C callbacks are refused: `nish c-import` refuses a function pointer, and NL2728 refuses a function reference to a declared C function; WP66 S6 is `needs-decision` | [c-import guide](../../docs/guide/using-nish/c-import.md), [wp66 plan](wp66-c-headers.plan.md) | the shim never calls back into Nish: adapter and device requests wait inside C, and Nish owns the native loop |
| The only array C takes is `u8[]` ("Only `u8` crosses") | LANGUAGE.md "A `u8[]` parameter", `tests/cases/reject_ffi_buffer_element` | vertex data in `f32[]` needs S2 |
| `nish c-import` writes bindings from a header | [c-import guide](../../docs/guide/using-nish/c-import.md) | it replaces the proposed `gen_bindings.py` |
| `build.sh` links SQLite only for a program that declares `sqlite3_`/`nishsqlite_`, and `src/run-cache.ts` (`callsSqlite`) mirrors the rule | [scripts/build.sh](../../scripts/build.sh) lines 372–440 | the same wiring for `nishgfx_`, in both places |
| Targets are Linux and macOS (x86_64, arm64), wasm32 and wasi | [src/target.ts](../../src/target.ts) | Windows waits on [WP79](wp79-windows-target.plan.md); iOS and Android need targets of their own |
| Function references (WP51 S1/S2) are built: a top-level, non-generic, non-async function passes as an argument or sits in a class field or `| null` | LANGUAGE.md "Function references" | `runApp` takes the game's hooks natively |
| Host modules turn typed TS exports into wasm imports, with `HostHandle` tables | [interop guide](../../docs/guide/using-nish/interop.md) | the browser backend of `std/gpu` |
| No module or export chooses a file by target | LANGUAGE.md packages, `nish` condition | S6 |
| `async` is refused on wasm (NL2652) | LANGUAGE.md | `std/gpu` startup is synchronous on native and page-awaited on web |

## Approach

Settled with the owner when the plan was drafted:

- **It lives in `std/`, wired the way SQLite is:** `std/gpu` and `std/gfx` in Nish, a small C shim in `runtime/gfx/`, and SDL3 and wgpu-native linked only into a program whose IR declares a `nishgfx_` function. The compiler release ships no graphics binaries. A program finds them on the system, or `scripts/fetch-gfx.sh` downloads pinned prebuilts.
- **The browser runs the same API over Nish's own host imports**, not emscripten: a page-side WebGPU module (`nish/page/gpu`), the WP50 loader, and CI's headless Chromium on SwiftShader.
- **Platforms:**
  - Linux and macOS natively, plus the browser.
  - Windows is S10, gated on WP79.
  - iOS and Android are out of scope here. Each needs its own target work package (triple, runtime port, cross-link, Xcode or Gradle template).
- **The best of both game layers:**
  - Kept from the browser layer: the fixed step decoupled from the display, `alpha` interpolation, capped catch-up, recovery from a lost GPU, `std/input`'s types, and `nish/raster` framebuffers, which `std/gfx` presents as a texture.
  - Added: native windows, GPU draw calls and an instanced `SpriteBatch`.
  - The existing `nish/host/game` page API does not change.
- **An engine-style update model** (Unity, Godot, Bevy, and "Fix Your Timestep!"). Each hook is optional:
  - `step()` at a fixed rate (60 Hz by default, configurable) for simulation;
  - `update(dt)` once per frame, for the camera, animation, particles and UI;
  - `draw(alpha)` once per frame, at display rate or uncapped.

  A game with only `update` is a plain variable-`dt` game, and the runner skips the accumulator for it.
- **Performance is a goal, not a polish item.** The levers are:
  - frames in flight, so the CPU builds frame N+1 while the GPU draws N;
  - no allocation per frame;
  - instancing from a ring buffer;
  - sprites sorted by texture;
  - the fastest present mode the surface offers;
  - a dynamic-resolution controller that holds the display's rate.

  Each is measured (S9).
- **The roadmap as written is adjusted to this repo:**
  - Files are `.ts`. `src/` is the compiler, so the bindings go in `std/gpu/sys.ts`.
  - `tools/gen_bindings.py` becomes `nish c-import` over the shim header, which is written to be c-import-clean.
  - CMake is not needed: `build.sh` compiles the shim as it compiles `runtime/sqlite/`.

## WP89 S1 — the design note, the shim's ABI and the pinned toolchain

Write `docs/wp89-gfx.md`. It answers each of these, with a citation or a measurement:

- **The shim ABI.** It uses only types c-import accepts: scalars, opaque handles, and structs by pointer. It has no unions, by-value structs, callbacks or variadics. Each webgpu.h descriptor that Nish fills in is flattened into a pointer-to-struct the shim translates.
  - Adapter and device requests block inside C, on `wgpuInstanceWaitAny` or a poll loop, so no callback reaches Nish.
  - Device-lost and uncaptured errors are queued in C and drained by a Nish poll call.
- **The surface.** It is created from SDL3's window: Metal layer on macOS, Wayland or X11 on Linux. There is also an offscreen mode that renders to a texture and reads it back, which every test uses.
- **The frame model.** How the `step`/`update`/`draw` hooks are registered:
  - natively, function references from WP51 S1/S2, passed to `runApp` and called from Nish's own loop. The note states their limits: each hook is a top-level, non-generic, non-async function, held in a class field or `| null`, never module storage; a capture-free arrow waits on WP51 S3;
  - in the browser, exports that `nish/page/gfx` drives. Today's `nish/page/game` exports are `init(seed)`, `step(nowMs)` and `draw(alpha, frameMs)`; the note says how `nish/page/gfx` maps them onto `step()`, `update(dt)` and `draw(alpha)`, and leaves the existing page API as it is.

  One game source must build for both targets without edits.
- **The web transport.** Host imports for creating resources, which happens rarely. A per-frame command ring in module storage ([std/host/ring.ts](../../std/host/ring.ts)) for encoding, which is hot. The note measures one import per call against the ring on the triangle and on 10,000 sprites, and keeps the ring only if it wins.
- **The auto-scaling controller.**
  - Input: GPU timestamp queries where the adapter has them, otherwise the CPU frame time.
  - Target: the display's refresh interval.
  - Output: an internal render scale between configured bounds, with hysteresis so it does not oscillate.
- **The budgets that S9 pins:** CPU time per frame for 10,000 sprites, and allocations per frame (zero).
- **Pins.** SDL3 and wgpu-native release tags, the webgpu.h revision wgpu-native ships, and each prebuilt's URL and sha256. Also list the differences between wgpu-native's webgpu.h and the browser's WebGPU that `std/gpu` hides.
- **Capabilities and security scope.**
  - A program using `std/gpu` reaches `ffi`.
  - The shim reads input devices and talks to the window system (another process), so it gets a record in S3.
- **Licensing.** SDL3 is zlib, wgpu-native is MIT/Apache-2.0, and webgpu.h is BSD-3. Nothing is vendored, but if a header is ever vendored it goes into [THIRD_PARTY_NOTICES.md](../../THIRD_PARTY_NOTICES.md) per [.claude/licensing.md](../licensing.md).

## WP89 S2 — numeric typed arrays as buffers a declared C function borrows

Extend the buffer rule in [docs/LANGUAGE.md](../../docs/LANGUAGE.md) ("A `u8[]` parameter: a buffer and its count") from `u8[]` to `f32[]`, `u16[]`, `u32[]` and `i32[]`, and their `readonly` forms.

- **The count is in elements**, the same for every buffer in a run, which for `u8[]` is the byte count it already is. A run that mixes element types is refused, because one count cannot mean both.
- **The borrow, the escape-analysis treatment and the `ffi` capability are those of `u8[]`.** `f64[]` and `i64[]` follow if the design note finds a caller for them.
- **Module storage.** `Float32Array` module storage already lends to a `Float32Array` parameter; the rule says whether it lends to a declared C function's `f32[]` buffer the same way.
- **`nish c-import`** emits a typed buffer run for `const float *`, `const uint16_t *`, `const uint32_t *` and `const int32_t *` followed by a count, as it does for `const uint8_t *`, so S4's generated bindings take `f32[]` directly.
- **Touches:**
  - the checker's `declare function` parameter rule and the emitter's buffer lowering (data pointer plus count);
  - the refusal text at LANGUAGE.md's FFI rule ("the only array a declared C function takes is a `u8[]`") and "Only `u8` crosses", with every `.err` golden that pins them (`tests/cases/reject_ffi_buffer_element` and friends);
  - the cookbook entry (`docs/cookbook/regen.sh`), the interop and c-import guides, and `docs/reference/` (`node scripts/gen-reference.mjs`).
- **Tests:**
  - goldens in `tests/cases/ffi_buffer_<type>` with a native round trip through a C helper, registered with `node tests/differential/goldens.js --update`;
  - `tests/cases/reject_ffi_buffer_*` cases for each new refusal (mixed element types, a count of the wrong type), and a `tests/link` negative with an `expected.err` for each new diagnostic code, checked with `node scripts/gen-diagnostic-codes.mjs --check`;
  - the existing refusal of `f64[]` checked again, and its wording updated.
- **Compiler-change rules.** This is a `src/` change, so:
  - regenerate `tests/self/goldens/checked/` with `node tests/self/goldens.js --update`;
  - run `wasi` and `performance` before pushing, and grep the old "Only `u8` crosses" wording across the docs and tests;
  - a corpus program it flips gets a `file: "exit"` `DECLARED` entry in [tests/nish-cmp.js](../../tests/nish-cmp.js);
  - `std/` can use the construct at once; `src/` cannot until the next release.

## WP89 S3 — the C shim, the link wiring, the fetch script and the CI lane

| File | Role |
| --- | --- |
| `scripts/fetch-gfx.sh` | downloads the pinned SDL3 and wgpu-native for the host into `build/gfx/<platform>/`, verifies each sha256, `--force` refetches; `NISH_GFX_PREFIX` names an existing install instead |
| `runtime/gfx/nish-gfx.h` | the shim API: `nishgfx_` functions over opaque handles, c-import-clean |
| `runtime/gfx/nish-gfx.c` | window and surface creation, sync adapter and device, event poll into a queue, surface configure and present, offscreen target and pixel readback |
| `scripts/build.sh` | when the IR declares `@nishgfx_`, compile `runtime/gfx/*.c` and add `-I`/`-L` from `NISH_GFX_PREFIX` or `build/gfx/`, `-lSDL3 -lwgpu_native`; error naming the fetch script when they are missing; refuse under `--profile wasm`/`wasm-host`/`wasi` (unlike SQLite, which builds on wasi: wasi has no window or GPU) |
| `src/run-cache.ts` | `callsGfx` beside `callsSqlite`, so `nish run`'s link cache asks for the shim's objects by the same rule; a `tests/run.js` check like the sqlite-link ones pins that the two rules agree |
| `tests/gfx/triangle.c` | a C hello-triangle against the shim, rendered offscreen and read back |
| `tests/run.js` section `gfx` | builds and runs it; a `SKIP` line names the missing library or adapter, never a silent pass |
| `.github/workflows/ci.yml` job `gfx` | ubuntu, installs Mesa lavapipe (Vulkan in software), runs `fetch-gfx.sh` and `node tests/run.js gfx`; a macOS job links and runs offscreen if a Metal adapter answers, else reports the SKIP; `scripts/ci-scope.mjs` read set traced per the CLAUDE.md rule |
| `docs/security/gfx.md` + index row | scope `runtime/gfx/`: window-system and input-device input, readback bounds, the libraries' trust boundary |
| `scripts/security-scope.mjs` | its surface lists only top-level `runtime/*.c` today, so `runtime/gfx/*.c` would pass unseen: extend the surface to it, with a `tests/run.js` check that an unscoped file under `runtime/gfx/` is refused |

`node tests/run.js c-symbols` reads `llvm-nm` over the runtime's own objects against `src/c-symbols.ts`. The stage checks whether that includes optional units such as `runtime/sqlite/`; if not, it adds the shim's objects, and reserves each libc call the shim makes.

## WP89 S4 — raw bindings by nish c-import and the clear-screen example

- **`std/gpu/sys.ts`** is generated by `nish c-import runtime/gfx/nish-gfx.h`, with a header comment naming the command. A `tests/run.js` check regenerates it and fails on a diff, the way the reference check does.
- **`examples/gfx/clear.ts`:** open a window (offscreen under test), clear to a colour that changes each frame, and exit after N frames. The `gfx` section reads back pixels and compares them with the expected colour.
- `node scripts/gen-reference.mjs` regenerates `docs/reference/` for the new module. Every public declaration carries its doc comment.

## WP89 S5 — std/gpu, the safe WebGPU core

Handle classes own their `CPtr` and are closed with `using`, which calls `wgpu*Release` through the shim.

| Module | Holds |
| --- | --- |
| `std/gpu/context.ts` | `GpuContext.open(options)`: instance, adapter, device, surface; `resize(w, h)` reconfigures; device lost is a result the frame call returns, never a panic |
| `std/gpu/buffer.ts` | `Buffer` of `f32`, `u16` or `u32` elements with vertex, index, uniform usage; `write(queue, data, offset)` over S2's buffers |
| `std/gpu/pipeline.ts` | `ShaderModule.fromWgsl(source)`, `RenderPipelineBuilder` for vertex layouts, blend states and topology |
| `std/gpu/texture.ts` | textures, `writeTexture` from `u8[]`, samplers, `BindGroupBuilder` |
| `std/gpu/frame.ts` | acquire, command encoder, render pass, submit, present |

The milestone is `examples/gfx/triangle.ts`: an indexed, coloured triangle from a vertex buffer and a WGSL shader, read back and compared with reference pixels within a tolerance. The guide page is `docs/guide/using-nish/gpu.md`, with its route in [scalar.config.json](../../scalar.config.json).

## WP89 S6 — a module file chosen by target

`std/gpu` has one API and two backends, and nothing chooses a file per target today.

- **Proposed rule:**
  - A package's `exports` may offer a `nish-wasm32` condition before `nish`, and a wasm32 build takes it.
  - A `std/` module resolves `<name>.wasm32.ts` beside `<name>.ts` under a wasm32 target.
  - The two files must export the same names and signatures, and a mismatch is a diagnostic in each build.
- The rule goes in LANGUAGE.md's package section and the package guide.
- `tests/link` covers std and package resolution on both targets, plus the mismatch negative with its new code.
- This is a `src/` change, so it gets the same gates as S2: self goldens, `wasi` and `performance`, `gen-diagnostic-codes.mjs --check` and the `docs/reference/diagnostics` page for the new code, and a `DECLARED` entry for any corpus program it moves.

## WP89 S7 — std/gpu in the browser over host imports

- **`runtime/page-gpu.mjs`** with its `.d.ts`, exported as `nish/page/gpu`. It is the host side: it keeps WebGPU objects in `HostHandle` tables, awaits `requestAdapter`/`requestDevice` before calling the module's `init`, and decodes the per-frame command ring if S1 kept it.
- **The wasm32 backend file of each `std/gpu` module** (S6) calls those host imports.
- **Test:** `examples/gfx/triangle.ts` builds with `--target wasm32 --profile wasm-host` unchanged. A headless Chromium check on SwiftShader (the setup WP50 uses, [docs/wp50-wasm-host.md](../../docs/wp50-wasm-host.md)) reads the canvas back against the same reference pixels.
- `docs/security/gfx.md` gains `runtime/page-gpu.mjs` in its scope: the page decodes handles and the command ring from module memory, so each bound it checks (handle table index, ring record length) cites the check that fails without it.
- `docs/guide/using-nish/gpu.md` gains its browser section.

## WP89 S8 — std/gfx, the app runner, input, SpriteBatch and framebuffer present

- **`std/gfx/app.ts`.** `runApp({ step?, update?, draw, stepsPerSecond, maxStepsPerFrame, framesInFlight })`.
  - The accumulator keeps the browser layer's rules: at most `maxStepsPerFrame` (8) steps per frame, and a stall counts as at most a quarter second.
  - `draw(alpha)` gets interpolation.
  - The `nish/page/gfx` page module drives the same hooks in the browser.
  - A Nish test pins the step accounting with a fake clock.
- **`std/gfx/input.ts`:** keys, mouse, touch and gamepad. SDL3 events natively, page events in the browser, both in `std/input`'s `StepInput`/`KeyState` shapes.
- **`std/gfx/sprite.ts`:**
  - `SpriteBatch` with per-instance position, rotation, scale, tint and atlas rect;
  - one instanced draw per texture run;
  - a ring vertex buffer sized for `framesInFlight`;
  - sorting by texture, an orthographic `Camera2D`, and `TextureAtlas`.
- **`std/gfx/framebuffer.ts`** presents a `nish/raster` `Int32Array` framebuffer as a nearest-sampled texture. `examples/game-starter` gains a native entry built on it.
- **Wait-for-events mode** (`runApp({ ..., mode: RunMode.WaitEvents })`, default `RunMode.Continuous`), for WP92's std/ui:
  - Natively, when nothing has asked for a frame, the runner blocks in `SDL_WaitEventTimeout` (the timeout is the next timer, or none) instead of spinning.
  - In the browser, `nish/page/gfx` stops requesting animation frames and resumes on an input event or a `requestRedraw`.
  - Any input event, a resize, or a `requestRedraw()` call (exported from `std/gfx/app.ts`, callable from any hook) schedules exactly one frame. Several requests before it coalesce into one.
  - The accumulator is reset on wake, so a long idle never runs a burst of `step` calls.
  - A Nish test with the fake clock pins it: no frames while idle, one frame per coalesced request, and no step burst after a wake.
  - `docs/wp89-gfx.md` §4 gains the mode.
- **`examples/gfx/sprites.ts`:** bouncing sprites on both backends.
- **`docs/guide/using-nish/gfx-games.md`**, with its route in `scalar.config.json`, linked from the browser-games page. `docs/reference/` is regenerated for `std/gfx`.

## WP89 S9 — auto-scaling, present-mode choice and the sprite bench

- **`std/gfx/scale.ts`.** The controller from S1: it renders to an offscreen target at the current scale and upscales it to the surface. Its test feeds synthetic frame times (a load step up, then down) and asserts that the scale converges inside its bounds without oscillating.
- **Present mode.** Use mailbox when the surface offers it, immediate when `vsync: false` asks for it, and fifo otherwise. The choice is reported on the context.
- **`bench/gfx-sprites`.** 10,000 sprites, measuring CPU time per frame and allocations per frame.
  - CI pins a CPU budget under lavapipe, and fails over it.
  - A real-GPU run is recorded in [docs/BENCHMARKS.md](../../docs/BENCHMARKS.md). It names the commit, the machine and the FPS, and gives each figure's noise band, per the CLAUDE.md benchmark rules. The commit carries a `Measured:` trailer with the same figures.

- **`bench/gfx-idle`.** An app in wait-for-events mode with one button.
  - It measures CPU time over 10 idle seconds and the latency from a synthetic input event (or `requestRedraw`) to the presented frame.
  - CI pins both bounds under lavapipe and fails over either.
  - WP92 S4 reads these figures for std/ui.

### Decided

The reference machine for the recorded real-GPU run is the owner's own machine, run by hand, as [sweep-followups](sweep-followups.plan.md) S13 does for WebGPU. CI's software GPU cannot show 60 FPS for 10,000 sprites, so the stage's agent prepares the bench and its command line, and asks the owner on the stage's issue to run it and paste the output, which the stage then records.

## WP89 S10 — Windows, once WP79 ships its core runtime

- **Blocked on [WP79](wp79-windows-target.plan.md) S2** (the triple and the core runtime).
- `fetch-gfx.sh` gains the Windows SDL3 and wgpu-native builds, and `build.sh` cross-links the shim through WP79's path.
- A Windows runner runs the `gfx` readback checks on DX12's WARP software adapter.
- The guide's platform table gains Windows.

## Out of scope

- iOS and Android targets and their packaging. Each becomes its own target work package.
- An emscripten target, emdawnwebgpu, and CMake.
- Vendoring SDL3 or wgpu-native binaries into the repository or the release.
- 3D rendering, audio beyond the existing [std/synth.ts](../../std/synth.ts), and SDF text.
- C callbacks into Nish, which stay with WP66 S6.
- Any change to the existing `nish/host/game` page API or its guide, beyond a link.

## Tests

- **`node tests/run.js gfx`:** the C triangle, clear, triangle, sprites, framebuffer present and the binding-regeneration check. Each reads back pixels and compares them with references. Each prints a SKIP line naming what is missing.
- **`tests/cases/ffi_buffer_*` and `tests/link` negatives** for S2 and S6, mirroring `tests/cases/ffi_buffer_counted_by`, `tests/cases/reject_ffi_buffer_element` and `tests/link/ffi_buffer_counted_by_form`.
- **Nish tests** for the runner's step accounting and the scale controller.
- **Headless Chromium readback** for the web backend, mirroring the WP50 presenter checks in `tests/run.js`.

## Verification

```bash
npm run check && npm run lint && npm run lint:dead && node docs/check-links.mjs
bash scripts/fetch-gfx.sh && node tests/run.js gfx
node tests/run.js ffi                                     # S2
node tests/run.js wasi && node tests/run.js performance   # S2, S6 (src/ changes; read the wasi skip line)
node tests/run.js c-symbols && node scripts/security-scope.mjs   # S3
node scripts/gen-reference.mjs --check                    # S4 onwards
NISH=build/nish bash docs/cookbook/regen.sh --check       # S2
node tests/nish-cmp.js                                    # S2, S6, and any std/ change that moves corpus IR
```

CI's `gfx` job and the nine `test` shards green on the head are the full gate. The `gfx` job's SKIP count is read like a local run.
