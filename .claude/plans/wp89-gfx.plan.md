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
  - id: s3b-export-bindings
    title: WP89 S3b — a module exports its C bindings
    goal: A module may export an opaque declare class and a declare function, and an importing module calls them and carries ffi, so std/gpu/sys.ts stays the one generated binding the other std/gpu modules import
    verification: tests/link cases import an exported opaque declare class and declare function and run natively, the refusals that remain fire with their codes, and node tests/run.js ffi, c-import, wasi and performance pass
    todos:
      - id: s3b-export
        content: Accept export on an opaque declare class and a declare function, resolve them in an importing module, and carry ffi to it — see WP89 S3b
        status: pending
      - id: s3b-cimport-docs
        content: Carry a header declaration's doc comment onto the binding nish c-import writes — see WP89 S3b
        status: pending
      - id: s3b-rule-tests
        content: Rewrite the LANGUAGE.md export rule and the interop and c-import guide pages, and add tests/link cases and negatives — see WP89 S3b
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
  - id: s5a-owned-handles
    title: WP89 S5a — owned handles, a std class owns its native object, is exported, and closes with using
    goal: A std class can hold an opaque declare class, a CPtr or a HostHandle, own several of them, be exported, come from a factory, move into an owning field and close with using, at the cost of a direct declare function call
    verification: A tests/link case exports an owned handle class from one module, builds it in another through a factory, moves it into an owning class and closes it with using, and C counts the releases in order. The golden .ll shows a method call is one field load and the C call. Each remaining refusal has a negative, and node tests/run.js ffi, link, wasi and performance pass
    issue: 2379
    todos:
      - id: s5a-rule
        content: Widen the handle-class rule in src/handles.ts and the checker, covering field types, several owned fields, export, factories, moves into an owning field, and cross-module lending — see WP89 S5a
        status: pending
      - id: s5a-tests
        content: Add the tests/link round trip with release counting, the golden .ll, and a negative per refusal left — see WP89 S5a
        status: pending
      - id: s5a-docs
        content: Rewrite the LANGUAGE.md handle-class rule, its cookbook entry, docs/AI.md and the interop guide page — see WP89 S5a
        status: pending
  - id: s5a-standard
    title: WP89 S5a-standard — write the owned-handle resource standard into the agent files
    goal: CLAUDE.md, .claude/architecture.md, AGENTS.md and docs/AI.md state that a std resource closes with using and holds its native object directly unless it is shared
    verification: node docs/check-links.mjs and npm run lint pass, and each file's wording links the LANGUAGE.md rule S5a adds
    issue: 2380
    todos:
      - id: s5a-standard-text
        content: Write the standard into the agent files, linking the LANGUAGE.md rule — see WP89 S5a-standard
        status: pending
  - id: s5-gpu-core
    title: WP89 S5 — std/gpu, the safe WebGPU core
    goal: Owned handle classes, built on S5a and closed with using, for device, surface, buffers, shaders, pipelines, textures, samplers and bind groups, with resize and device-lost handled
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
    verification: examples/gfx/sprites.ts runs on both backends in CI, game-starter runs natively through framebuffer present, and the runner's step accounting is pinned by a Nish test
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
  - id: s9-performance
    title: WP89 S9 — auto-scaling, present-mode choice and the sprite bench
    goal: The runner holds the display rate by scaling internal resolution, picks the fastest present mode, and the 10,000-sprite cost is pinned and measured
    verification: The controller test converges under synthetic load, the CI bench stays inside its pinned CPU budget per frame, and docs/BENCHMARKS.md records a real-GPU run at 60 FPS or better
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

**Owns:** `docs/wp89-gfx.md`. **Depends on:** nothing. **Runs with:** S2.

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

**Owns:** `src/checker*.ts`, `src/declarations.ts`, `src/emit*.ts`, `src/c-import*.ts`, `src/codes.ts`, `src/diagnostics.ts`, `src/types*.ts`, `src/escape*.ts`, `docs/LANGUAGE.md`, `docs/guide/**` (interop and c-import pages), `docs/cookbook/**`, `docs/IR_COOKBOOK.md`, `docs/reference/**`, `tests/cases/ffi_buffer_*`, `tests/cases/reject_ffi_*`, `tests/link/ffi_buffer_*`, `tests/ffi-buffer.js`, `tests/wordings/**`, `tests/nish-cmp.js`, `tests/differential/**`, `tests/self/goldens/checked/src/**` except `run-cache.ts.txt` and `c-symbols.ts.txt`, `tests/self/goldens/checked/{std,tests,examples,bench,docs}/**`. **Not** `tests/run.js`: a new native round-trip check goes in `tests/ffi-buffer.js`, which `tests/run.js` already calls. **Depends on:** nothing. **Runs with:** S1, S3.

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

**Owns:** `runtime/gfx/**`, `scripts/fetch-gfx.sh`, `scripts/build.sh`, `src/run-cache.ts`, `src/c-symbols.ts`, `tests/self/goldens/checked/src/{run-cache,c-symbols}.ts.txt`, `tests/gfx/**`, `tests/gfx.js` (the `gfx` section's checks, imported by `tests/run.js` the way `tests/ffi-buffer.js` is), `tests/run.js` (that import and call, and the security-scope and sqlite-link-agreement checks), `tests/shard-costs.json`, `.github/workflows/ci.yml`, `scripts/ci-scope.mjs`, `tests/ci-scope*`, `docs/security/gfx.md`, `docs/security/README.md`, `scripts/security-scope.mjs`, `examples/break-web/help.ts`, `docs/site/break/**`, `docs/wp7-runtime.md`, `tests/runtime-budgets.js`, `.gitignore`. **Depends on:** S1 (the pins and the ABI). **Runs with:** S2, S6. **Sensitive:** `.github/workflows/ci.yml` is a CODEOWNERS path (`/.github/`), so this stage ends as a reviewed PR awaiting a human merge.

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

## WP89 S3b — a module exports its C bindings

**Decided by the owner on #2239 (2026-11-26):** let a module export its C bindings, as a stage before S4. S4 found that the compiler refuses every route from a second module to `std/gpu/sys.ts`: `export declare function` (`src/declarations.ts`, "cannot be exported: it is a C function this program calls"), `export declare class` (`src/structs.ts`, "a C struct layout is used in the module that declares it"), and redeclaring a handle class in a second module (class names are program-unique).

**Owns:** `src/checker*.ts`, `src/declarations.ts`, `src/structs.ts`, `src/emit*.ts`, `src/module*.ts`, `src/program.ts`, `src/compilation.ts`, `src/capabilities.ts`, `src/capability-report.ts`, `src/c-import*.ts`, `src/codes.ts`, `src/diagnostics.ts`, `src/types*.ts`, `src/escape*.ts`, `docs/LANGUAGE.md`, `docs/AI.md`, `docs/guide/**` (the interop and c-import pages), `docs/cookbook/**`, `docs/IR_COOKBOOK.md`, `docs/reference/**`, `tests/cases/reject_ffi_export*`, `tests/cases/ffi_export_*`, `tests/link/*export_declare*/**`, `tests/link/*c_binding*/**`, `tests/c-import/**`, `tests/wordings/**`, `tests/nish-cmp.js`, `tests/differential/**`, `tests/self/goldens/checked/src/**` except `run-cache.ts.txt` and `c-symbols.ts.txt`, `tests/self/goldens/checked/{std,tests,examples,bench,docs}/**`. **Not** `tests/run.js` or `std/`. **Depends on:** nothing unmerged (S2 and S6 own the same compiler files and are merged). **Blocks:** S4.

- **An opaque `declare class`** (no members, no heritage clause: the C type a library hands out and takes back) may be exported, and an importing module names it in a type and passes it to the exported `declare function`s that take it. A `declare class` with fields stays refused across modules unless its layout carries to the importer unchanged; the rule says which, and the refusal keeps its code.
- **A `declare function` may be exported.** An importing module calls it as it calls the declaring module's own call: the same buffer and count rules, the same escape treatment, the same IR at the call site. The importer **reaches `ffi`**, so `--deny ffi`, the capability report and `tests/link/*/expected.caps.json` see it. Whether a module may re-export one it imported is decided and tested.
- **`nish c-import` carries doc comments.** A `/** … */` comment directly before a declaration in the header lands on the binding it writes, so a generated module documents its exported constants and functions (`node scripts/gen-reference.mjs --check`, whose `scripts/undocumented.txt` only shrinks). S4 writes the comments in `runtime/gfx/nish-gfx.h`. It is in this stage because it is a `src/` change with the same gates.
- **Rolling freeze.** `src/` may not use an exported C binding until the next release ships the rule; `std/` may.
- **Tests:** `tests/link` cases where one module exports an opaque handle and a C function and another imports and calls them, run natively against a small C file, with `expected.caps.json` showing `ffi` on the importer; a negative for each refusal left (a field-carrying layout, and whatever the re-export decision refuses); `reject_ffi_export` flips to a positive or is rewritten for what stays refused, with `file: "exit"` `DECLARED` entries for any nish-cmp corpus program that flips; a `tests/c-import` case for the doc comment.
- **Compiler-change rules**, as for S2 and S6: self goldens, `node tests/run.js wasi` and `performance`, `gen-diagnostic-codes.mjs --check` and `docs/reference/diagnostics` for any new code, nish-cmp `DECLARED` entries, and a grep of `docs/wp*.md`, `docs/MASTER_PLAN.md` and `tests/**` comments for the old rule's wording.

## WP89 S4 — raw bindings by nish c-import and the clear-screen example

**Owns:** `std/gpu/sys.ts`, `examples/gfx/clear.ts`, `tests/gfx.js`, `tests/gfx/**`, `runtime/gfx/nish-gfx.h` (doc comments only), `runtime/gfx/nish-gfx.overrides.json`, `scripts/gen-reference.mjs` (the `gpu` area), `biome.json` (a naming-convention override for generated C bindings only), `tests/smoke/gfx-*`, `docs/reference/**`, `scalar.config.json`, `tests/self/goldens/checked/{std,examples}/**`. **Depends on:** S2, S3, S3b, S6.

- **Folded in by the #2239 decision:** the `gpu` area in `scripts/gen-reference.mjs`, doc comments on every exported `NISHGFX_*` constant and binding (written in the header, carried by S3b's c-import), and Biome's `useNamingConvention` errors on the generated C names (an override scoped to `std/gpu/sys.ts`, not a rule change). Draft PR #2333 holds the generated `sys.ts` and its currency check; S4 resumes on its branch once S3b merges.

- **`std/gpu/sys.ts`** is generated by `nish c-import runtime/gfx/nish-gfx.h`, with a header comment naming the command. A `tests/run.js` check regenerates it and fails on a diff, the way the reference check does.
- **`examples/gfx/clear.ts`:** open a window (offscreen under test), clear to a colour that changes each frame, and exit after N frames. The `gfx` section reads back pixels and compares them with the expected colour.
- `node scripts/gen-reference.mjs` regenerates `docs/reference/` for the new module. Every public declaration carries its doc comment.

## WP89 S5a — owned handles: a std class owns its native object, is exported, and closes with using

**Decided by the owner on #2240 (2026-11-27): option 1.** A compiler stage lands first, and S5 is built on it. The owner's priority is performance first, then one standard, with one design for both targets. S5 found the language refuses its signed-off design:
- an opaque `declare class` cannot be a field or a parameter of a Nish function;
- a handle class holds exactly one `CPtr`, cannot be exported, and lives only in a `using` block or as a parameter it is lent to (`docs/LANGUAGE.md` handle classes, `src/handles.ts`);
- `using` takes only handle classes, scope, lock and arena.

**Owns:** `src/handles.ts`, `src/checker*.ts`, `src/structs.ts`, `src/declarations.ts`, `src/emit*.ts`, `src/module*.ts`, `src/program.ts`, `src/compilation.ts`, `src/capabilities.ts`, `src/capability-report.ts`, `src/codes.ts`, `src/diagnostics.ts`, `src/types*.ts`, `src/escape*.ts`, `src/region-rules.ts`, `src/generics.ts`, `src/attributes.ts`, `src/module-storage.ts`, `src/interop*.ts`, `docs/LANGUAGE.md`, `docs/AI.md`, `docs/guide/**` (the interop and handles pages), `docs/cookbook/**`, `docs/IR_COOKBOOK.md`, `docs/reference/**`, `docs/wp53-ffi-buffers-handles.md`, `tests/cases/ffi_handle_*`, `tests/cases/reject_ffi_handle_*`, `tests/link/*handle*/**`, `tests/wordings/**`, `tests/nish-cmp.js`, `tests/differential/**`, `tests/self/goldens/checked/src/**` except `run-cache.ts.txt` and `c-symbols.ts.txt`, `tests/self/goldens/checked/{std,tests,examples,bench,docs}/**`. **Not** `tests/run.js` or `std/`. **Depends on:** nothing unmerged. **Blocks:** S5, S5a-standard.

- **The owned field** is a `CPtr`, an opaque `declare class` (local or imported), or, in a `std/<name>.wasm32.ts` twin, a `HostHandle<"kind">`. A class may own several, and dispose closes them in reverse declaration order. `GpuContext` holds an instance, an adapter, a device and a surface.
- **Export.** A handle class may be exported, and an importing module follows the same rules as the declaring one.
- **Factories.** A function or a static method may return a handle as `H`, `H | null` or `Result<H, E>`. The caller binds the result with `using`, or moves it into an owning field of another handle class, which then closes it.
- **One owner, no copy.** Copies, arrays, object literals, captures, builtin arguments and comparisons stay refused, so the compiler proves there is no use after close, with no runtime check. Lending to a parameter works across modules.
- **Cost.** A method call is one field load and the C call, the same as a direct `declare function` call. A golden `.ll` shows it.
- **Left open for S8:** an array of handles stays refused. S8's many textures use an id table or a pool, decided there.
- **Tests:** a `tests/link` case where one module exports an owned handle class and another imports it, builds it through a factory, moves it into an owning class and closes it with `using`, run natively against a small C file that counts releases and prints their order. A golden `.ll` for the method call. A negative for each refusal left, and `file: "exit"` `DECLARED` entries for any nish-cmp corpus program that flips.
- **The construct checklist** (`docs/ARCHITECTURE.md`, "How to add a construct"): golden `.ll`, `llvm-as`, a native round trip, negatives, the `docs/LANGUAGE.md` rule, a cookbook entry and the guide page.
- **Compiler-change rules**, as for S3b: self goldens, `node tests/run.js wasi` and `performance`, `gen-diagnostic-codes.mjs --check` and `docs/reference/diagnostics` for any new code, nish-cmp `DECLARED` entries, and a grep of `docs/wp*.md`, `docs/MASTER_PLAN.md` and `tests/**` comments for the old rule's wording.
- **Rolling freeze.** `src/` may not use the wider rule until the next release ships it; `std/` may.

## WP89 S5a-standard — write the owned-handle resource standard into the agent files

**Decided by the owner on #2240 (2026-11-27):** the rule becomes the repository standard, written where agents read first, once S5a lands. Until then the compiler refuses it.

**Owns:** `CLAUDE.md`, `.claude/architecture.md`, `AGENTS.md`, `docs/AI.md`. **Depends on:** S5a. **Sensitive:** every file but `docs/AI.md` is a CODEOWNERS path, so this stage ends as a reviewed PR awaiting the owner's merge.

> A `std/` resource that must be released closes with `using`. When it has a single owner, it holds its native object directly: a pointer natively, and a `HostHandle` on `wasm32`. It holds an id into a table only when the object is shared, kept in collections, or owned by the JS side. A bare `close()` alone is not the standard for new modules.

The wording links the `docs/LANGUAGE.md` rule S5a adds. It names `std/sqlite.ts` as the id case: a use after close answers `MISUSE` there. Moving the other closeable `std/` modules onto `using` is a follow-up outside WP89.

## WP89 S5 — std/gpu, the safe WebGPU core

**Owns:** `std/gpu/**`, `examples/gfx/**`, `tests/gfx.js`, `tests/gfx/**`, `docs/guide/using-nish/gpu.md`, `docs/guide/**` index links, `docs/reference/**`, `scalar.config.json`, `scripts/undocumented.txt`, `tests/self/goldens/checked/{std,examples}/**`, `tests/nish-cmp.js`. **Depends on:** S4, S5a.

The classes are S5a's owned handles. Each holds its shim object directly and is closed with `using`, which calls `wgpu*Release` through the shim, so a method call costs one field load and the C call. A factory such as `GpuContext.open` returns a `Result`. Child objects a context creates are moved into the class that owns them. The `std/gpu/*.wasm32.ts` twins (S6) keep the same API and hold a `HostHandle<"kind">` instead, which S7 serves from the page.

| Module | Holds |
| --- | --- |
| `std/gpu/context.ts` | `GpuContext.open(options)`: instance, adapter, device, surface; `resize(w, h)` reconfigures; device lost is a result the frame call returns, never a panic |
| `std/gpu/buffer.ts` | `Buffer` of `f32`, `u16` or `u32` elements with vertex, index, uniform usage; `write(queue, data, offset)` over S2's buffers |
| `std/gpu/pipeline.ts` | `ShaderModule.fromWgsl(source)`, `RenderPipelineBuilder` for vertex layouts, blend states and topology |
| `std/gpu/texture.ts` | textures, `writeTexture` from `u8[]`, samplers, `BindGroupBuilder` |
| `std/gpu/frame.ts` | acquire, command encoder, render pass, submit, present |

The milestone is `examples/gfx/triangle.ts`: an indexed, coloured triangle from a vertex buffer and a WGSL shader, read back and compared with reference pixels within a tolerance. The guide page is `docs/guide/using-nish/gpu.md`, with its route in [scalar.config.json](../../scalar.config.json).

## WP89 S6 — a module file chosen by target

**Owns:** `src/paths.ts`, `src/program.ts`, `src/compilation.ts`, `src/manifest.ts`, `src/module*.ts`, `src/nish-modules.ts`, `src/branding.ts`, `src/codes.ts`, `src/diagnostics.ts`, `docs/LANGUAGE.md`, `docs/guide/**` (the packages page), `docs/reference/**`, `tests/link/*target*/**`, `tests/link/*wasm32*/**`, `tests/wordings/**`, `tests/nish-cmp.js`, `tests/differential/**`, `tests/self/goldens/checked/src/**` except `run-cache.ts.txt` and `c-symbols.ts.txt`, `tests/self/goldens/checked/{std,tests,examples,bench,docs}/**`. **Not** `tests/run.js`. **Depends on:** S2 (the same compiler files and generated pages). **Runs with:** S3.

`std/gpu` has one API and two backends, and nothing chooses a file per target today.

- **Proposed rule:**
  - A package's `exports` may offer a `nish-wasm32` condition before `nish`, and a wasm32 build takes it.
  - A `std/` module resolves `<name>.wasm32.ts` beside `<name>.ts` under a wasm32 target.
  - The two files must export the same names and signatures, and a mismatch is a diagnostic in each build.
- The rule goes in LANGUAGE.md's package section and the package guide.
- `tests/link` covers std and package resolution on both targets, plus the mismatch negative with its new code.
- This is a `src/` change, so it gets the same gates as S2: self goldens, `wasi` and `performance`, `gen-diagnostic-codes.mjs --check` and the `docs/reference/diagnostics` page for the new code, and a `DECLARED` entry for any corpus program it moves.

## WP89 S7 — std/gpu in the browser over host imports

**Owns:** `runtime/page-gpu.mjs`, `runtime/page-gpu.d.ts`, `package.json` (`exports`), `std/gpu/**`, `tests/gfx.js`, `tests/run.js`, `docs/security/gfx.md`, `docs/security/README.md`, `docs/guide/using-nish/gpu.md`, `docs/reference/**`, `tests/self/goldens/checked/std/**`. **Depends on:** S5, S6. **Sensitive:** `package.json` is a CODEOWNERS path.

- **`runtime/page-gpu.mjs`** with its `.d.ts`, exported as `nish/page/gpu`. It is the host side: it keeps WebGPU objects in `HostHandle` tables, awaits `requestAdapter`/`requestDevice` before calling the module's `init`, and decodes the per-frame command ring if S1 kept it.
- **The wasm32 backend file of each `std/gpu` module** (S6) calls those host imports.
- **Test:** `examples/gfx/triangle.ts` builds with `--target wasm32 --profile wasm-host` unchanged. A headless Chromium check on SwiftShader (the setup WP50 uses, [docs/wp50-wasm-host.md](../../docs/wp50-wasm-host.md)) reads the canvas back against the same reference pixels.
- `docs/security/gfx.md` gains `runtime/page-gpu.mjs` in its scope: the page decodes handles and the command ring from module memory, so each bound it checks (handle table index, ring record length) cites the check that fails without it.
- `docs/guide/using-nish/gpu.md` gains its browser section.

## WP89 S8 — std/gfx, the app runner, input, SpriteBatch and framebuffer present

**Owns:** `std/gfx/**`, `runtime/page-gfx.mjs`, `runtime/page-gfx.d.ts`, `package.json` (`exports`), `examples/gfx/**`, `examples/game-starter/**`, `tests/gfx.js`, `tests/nish/**`, `docs/guide/using-nish/gfx-games.md`, `docs/guide/**` (the browser-games link), `scalar.config.json`, `docs/reference/**`, `tests/self/goldens/checked/{std,examples}/**`. **Depends on:** S7. **Sensitive:** `package.json`.

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
- **`examples/gfx/sprites.ts`:** bouncing sprites on both backends.
- **`docs/guide/using-nish/gfx-games.md`**, with its route in `scalar.config.json`, linked from the browser-games page. `docs/reference/` is regenerated for `std/gfx`.

## WP89 S9 — auto-scaling, present-mode choice and the sprite bench

**Owns:** `std/gfx/**`, `std/gpu/context.ts`, `bench/gfx-sprites/**`, `tests/gfx.js`, `.github/workflows/ci.yml`, `docs/BENCHMARKS.md`, `docs/reference/**`, `tests/self/goldens/checked/{std,bench}/**`. **Depends on:** S8. **Sensitive:** `.github/workflows/ci.yml`. **Needs the owner:** the real-GPU run below is the owner's, so the stage cannot finish unattended.

- **`std/gfx/scale.ts`.** The controller from S1: it renders to an offscreen target at the current scale and upscales it to the surface. Its test feeds synthetic frame times (a load step up, then down) and asserts that the scale converges inside its bounds without oscillating.
- **Present mode.** Use mailbox when the surface offers it, immediate when `vsync: false` asks for it, and fifo otherwise. The choice is reported on the context.
- **`bench/gfx-sprites`.** 10,000 sprites, measuring CPU time per frame and allocations per frame.
  - CI pins a CPU budget under lavapipe, and fails over it.
  - A real-GPU run is recorded in [docs/BENCHMARKS.md](../../docs/BENCHMARKS.md). It names the commit, the machine and the FPS, and gives each figure's noise band, per the CLAUDE.md benchmark rules. The commit carries a `Measured:` trailer with the same figures.

### Decided

The reference machine for the recorded real-GPU run is the owner's own machine, run by hand, as [sweep-followups](sweep-followups.plan.md) S13 does for WebGPU. CI's software GPU cannot show 60 FPS for 10,000 sprites, so the stage's agent prepares the bench and its command line, and asks the owner on the stage's issue to run it and paste the output, which the stage then records.

## WP89 S10 — Windows, once WP79 ships its core runtime

**Not in a run until WP79 S2 merges.**

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

## Acceptance criteria

Derived from the stage goals above, not given separately. Each is a result a user of Nish checks, not a todo.

1. A `declare function` that takes an `f32[]`, `u16[]`, `u32[]` or `i32[]` (or its `readonly` form) and an element count compiles, and the C function reads exactly the elements Nish wrote: a native round trip prints them.
2. A buffer run that mixes element types, an `f64[]` buffer, or a count of the wrong type is refused with a coded diagnostic whose wording `docs/LANGUAGE.md` states.
3. `nish c-import` on a header declaring `const float *p, size_t n` (and the `uint16_t`, `uint32_t`, `int32_t` forms) emits a binding whose parameter is the typed buffer.
4. `docs/wp89-gfx.md` exists, answers each S1 question, and pins SDL3, wgpu-native and webgpu.h with a URL and sha256 each.
5. A program that declares no `nishgfx_` function builds and links exactly as before; the C triangle reads back its expected pixels on a software GPU in CI; a missing library prints a SKIP line, never a silent pass.
6. A `std/` module with a `<name>.wasm32.ts` sibling, and a package with a `nish-wasm32` export condition, resolve to the wasm32 file under `--target wasm32` and to the plain one natively; the two files disagreeing on an export is a coded diagnostic.
7. A Nish program opens a window (offscreen under test) and clears it each frame, and the readback matches the colour.
8. `examples/gfx/triangle.ts` matches its reference pixels natively and, built unchanged for wasm32, in headless Chromium.
9. `examples/gfx/sprites.ts` runs on both backends, and `examples/game-starter` runs natively through framebuffer present.
10. The sprite bench stays inside its CI budget, and `docs/BENCHMARKS.md` records a real-GPU run.

A run covers the criteria of the stages it merges and names the rest as not attempted. Nothing here has a browser surface until S7, so acceptance for S1 to S6 is static plus the CI jobs' own runs.
