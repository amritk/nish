# WP89: GPU graphics — `std/gpu`, `std/gfx` and the `runtime/gfx/` shim

**Status:** open; this note is the plan, written in S1. Nothing here is built
yet. The work is the parent issue
[#2281](https://github.com/amritk/nish/issues/2281) under the
[Roadmap issue](https://github.com/amritk/nish/issues/1849); where this note
and [LANGUAGE.md](LANGUAGE.md) disagree, LANGUAGE.md wins.

A Nish program draws with the GPU through one source that builds two ways:
natively, through a small C shim (`runtime/gfx/`) over SDL3 for the window and
input and wgpu-native for WebGPU; and in the browser, through a page module
(`nish/page/gpu`, then `nish/page/gfx`) over the browser's own WebGPU. `std/gpu`
is the WebGPU layer both targets share; `std/gfx` is the game layer on top
(the app loop, sprites, a framebuffer, the scale controller).

S1 settles six questions, each below with the citation or the measurement
that answers it: the shim's ABI (§2), the surface (§3), the frame model (§4),
the web transport (§5), the auto-scaling controller (§6) and the budgets S9
pins (§7). §1 pins the toolchain; §8 and §9 are the capability, security and
licensing consequences.

## 1. Pins

Every artifact below was downloaded on 2026-11-25 and hashed with
`sha256sum`; S3's `scripts/fetch-gfx.sh` refuses a download whose hash is not
the one here.

### wgpu-native v29.0.1.1

The newest tag, commit `6aed50955d934ac36049ba8d002034841633ae02`
(2026-06-22), building the `wgpu` crates at 29.0.1. Assets are under
`https://github.com/gfx-rs/wgpu-native/releases/download/v29.0.1.1/`:

| Asset | Used by | sha256 |
| --- | --- | --- |
| `wgpu-linux-x86_64-release.zip` | Linux x86-64 (CI) | `95a4d90c071005a98d03eab348beaa6b07e16eb00d1dcdb9f8348f75eb97ec5a` |
| `wgpu-linux-aarch64-release.zip` | Linux arm64 | `015fcdf1dbae82e614a783cc38017e5399ae0927a889fe9b69c9b664bc61b47a` |
| `wgpu-macos-x86_64-release.zip` | macOS x86-64 | `8e2f7378548ddd0e2cf21e7d864dda46e953f0af724855a33778b85ead206d41` |
| `wgpu-macos-aarch64-release.zip` | macOS arm64 | `a5797a37b1adf720bcd5dcffb291edbbd5b7b14be0a3874c28e6393a655a7a3e` |
| `wgpu-windows-x86_64-gnu-release.zip` | Windows (S10, on WP79) | `d471e3614733c1d4ddd61bfd19868356477d0d37bf531bf8c6cb64a7f579bd2a` |

Each zip holds `include/webgpu/webgpu.h`, `include/webgpu/wgpu.h` (the
native extensions), `lib/libwgpu_native.a` beside the shared library, and
`wgpu-native-meta/`. The shim links the static archive, so a built program
needs no `libwgpu_native.so` beside it.

**The webgpu.h it ships** is
[webgpu-native/webgpu-headers](https://github.com/webgpu-native/webgpu-headers)
at commit `673658bc2bd70ec39fc55ebe6bb0173cf6d0a603` (2026-05-07, "Add
missing setImmediates method (#588)"): the tag's `ffi/webgpu-headers`
submodule points there, and the header in the Linux x86-64 zip is
byte-identical to that commit's `webgpu.h`, sha256
`a483031c3fed05ea5dd1c74082a71676c46c5b2b820ccca10da515c033efc997`
(259,569 bytes). `wgpu.h` is
`7bd23656d394f620a804b1f174444ea17082b6d330a2fca0c0e6b1121ec4b284`
(55,926 bytes). Line numbers this note cites, `webgpu.h:N` and `wgpu.h:N`,
are in those two files.

### SDL 3.4.20

Tag `release-3.4.20`, commit `f00dc919ca35b9756316e86c4777392de442f9b2`
(2026-11-03), the newest 3.4.x. Assets are under
`https://github.com/libsdl-org/SDL/releases/download/release-3.4.20/`:

| Asset | Used by | sha256 |
| --- | --- | --- |
| `SDL3-3.4.20.tar.gz` | Linux (source) | `f3bb06f55bed9557227a700af2ea62e49497ebdf58037732a731a5fb3ef8581f` |
| `SDL3-3.4.20.tar.gz.sig` | its signature | `776200b5c71f8c0168c0e89d8fb78103623dc15e284e9daf0a0eceb4e43d5533` |
| `SDL3-3.4.20.dmg` | macOS (framework) | `36b7e4cefcf7d55d227b3df5e686f8f33ab34193173a976445d1b57c80009e44` |
| `SDL3-devel-3.4.20-mingw.tar.gz` | Windows (S10) | `d2d3bf3fb97a90b22e908a306d7362631ef1bab229d988fe6669595dc29cd9ed` |

SDL publishes no Linux binary, so `fetch-gfx.sh` builds the tarball with
SDL's own CMake (`cmake` and `ninja` are on the ubuntu runners) into
`build/gfx/`, as a static library with the video drivers Linux needs
(Wayland, X11) and the offscreen one the tests use. A user with a distro
SDL 3.4 points `NISH_GFX_PREFIX` at it instead.

### What `std/gpu` hides of webgpu.h

The two targets meet at `std/gpu`. These are the places the pinned
webgpu.h and the browser's WebGPU differ, and what `std/gpu` gives a program
instead:

| webgpu.h (native) | Browser WebGPU | `std/gpu` |
| --- | --- | --- |
| Strings are `WGPUStringView` structs passed by value (`webgpu.h:193`, `WGPU_STRLEN` at 152) | JS strings | a Nish `string`; the shim builds the view in C |
| Every request ends in a callback chosen by a `WGPUCallbackMode` (`webgpu.h:462`–`478`) and answers a `WGPUFuture` (`webgpu.h:2233`) | a `Promise` | a call that returns the handle (native: blocks in C, §2.2; browser: awaited before `init`, §5) |
| `wgpuInstanceWaitAny` (`webgpu.h:6423`) is `unimplemented!()` in wgpu-native (`src/unimplemented.rs:227`), and timed waits are reported unsupported (`src/lib.rs:653`–`680`) | `await` | not used at all |
| `wgpuDevicePoll` (`wgpu.h:1489`) drives the device | the event loop drives it | called by the shim at map and present, never by Nish |
| Uncaptured errors and device loss go to callbacks in the device descriptor (`webgpu.h:4589`, `4598`); wgpu-native's defaults `panic!` (`src/lib.rs:413`–`441`) | `uncapturederror` event, `device.lost` promise | a queue the program drains (§2.3) |
| A surface is made from a chained `WGPUSurfaceSource*` struct (`webgpu.h:3201`, `3227`, `3327`) | `canvas.getContext("webgpu")` | made by `runApp` from the window or the canvas |
| Present modes `Fifo`, `FifoRelaxed`, `Immediate`, `Mailbox` (`webgpu.h:803`–`819`) | none (the browser composites) | the `vsync` option, ignored in the browser |
| `wgpuSurfaceGetCurrentTexture` answers a status, `SuccessOptimal` through `Error` (`webgpu.h:975`–`995`) | `getCurrentTexture()` throws or answers | `beginFrame` answers a texture or "skip this frame" |
| Timestamp queries are `WGPUFeatureName_TimestampQuery` (`webgpu.h:650`), and inside passes a native feature (`wgpu.h:525`, `545`) | the `"timestamp-query"` feature, pass `timestampWrites` only | the pass-boundary form only (§6) |
| Buffer reads map through `wgpuBufferMapAsync` (`webgpu.h:6119`) plus a poll | `mapAsync` promise | the offscreen readback only, native and test-side |

## 2. The shim's ABI

`std/gpu/sys.ts` (S4) is generated by `nish c-import` from
`runtime/gfx/nishgfx.h`, so the header uses only what
[c-import binds](guide/using-nish/c-import.md#what-is-not-bound): scalars,
opaque handles, and structs through a pointer. It has no union, no struct by
value, no callback (a function pointer, which c-import does not bind, and
which Nish could not pass anyway: a reference to a declared C function is
refused, NL2728, `reject_fnref_ffi`, [LANGUAGE.md](LANGUAGE.md#function-references)),
and nothing variadic. Every exported name starts `nishgfx_`, which is how
`scripts/build.sh` decides to link the shim, the rule it already has for
SQLite's `nishsqlite_` (`scripts/build.sh` beside `callsSqlite` in
`src/run-cache.ts`).

webgpu.h itself breaks every one of those rules: `wgpuAdapterRequestDevice`
(`webgpu.h:6020`) takes its callback info by value and answers a
`WGPUFuture` by value, descriptors chain through `WGPUChainedStruct`
(`webgpu.h:1511`), and labels are `WGPUStringView` values. So Nish never
calls webgpu.h; it calls the shim, and the shim calls webgpu.h.

### 2.1 Descriptors

A descriptor Nish fills in is a flat C struct of scalars the shim reads
through a pointer and translates into the webgpu.h descriptor, filling the
string views, chains and defaults itself:

```c
typedef struct NishGfxBufferDesc {
  uint64_t size;
  uint32_t usage;            /* WGPUBufferUsage bits */
  uint32_t mapped_at_creation;
} NishGfxBufferDesc;

WGPUBuffer nishgfx_buffer_create(WGPUDevice device, const NishGfxBufferDesc *desc,
                                 const char *label);
```

A descriptor that holds a list (a pipeline's vertex attributes, a bind
group's entries, a pass's colour attachments) is built by calls rather than
handed as an array of structs: `nishgfx_pipeline_desc_new`, one
`nishgfx_pipeline_desc_attribute(desc, format, offset, location)` per
attribute, then `nishgfx_pipeline_create(device, desc)`, which frees the
builder. Creation is rare (§5), so the extra calls cost nothing a frame sees.
WGSL source and labels cross as NUL-terminated strings
([wp27](wp27-ffi.md), S3); data for `nishgfx_queue_write` crosses as a `u8[]`
borrowed for the call, the one buffer type that crosses to C today, which S2
widens to `f32[]`, `u16[]`, `u32[]` and `i32[]`.

The per-frame calls take scalars and handles only:
`nishgfx_pass_begin(encoder, view, load, r, g, b, a)`,
`nishgfx_pass_set_pipeline(pass, pipeline)`,
`nishgfx_pass_set_bind_group(pass, index, group)`,
`nishgfx_pass_set_vertex_buffer(pass, slot, buffer, offset, size)`,
`nishgfx_pass_draw(pass, vertices, instances, first_vertex, first_instance)`,
`nishgfx_pass_end(pass)`. None allocates on the Nish side.

### 2.2 Adapter and device requests block in C

The brief allowed `wgpuInstanceWaitAny` or a poll loop. It is the poll loop:
in the pinned wgpu-native, `wgpuInstanceWaitAny` is `unimplemented!()`
(`src/unimplemented.rs:227`), so calling it aborts the process.

`nishgfx_adapter_request(instance, surface, power)` calls
`wgpuInstanceRequestAdapter` (`webgpu.h:6417`) with
`WGPUCallbackMode_AllowProcessEvents` (`webgpu.h:468`) and a C callback that
writes the status and the adapter into a struct on the shim's own stack.
wgpu-native runs that callback before `wgpuInstanceRequestAdapter` returns
(`src/lib.rs`, `wgpuInstanceRequestAdapter`, near line 2849: the request,
then the callback, then the return); the shim does not rely on that alone
and calls `wgpuInstanceProcessEvents` (`webgpu.h:6416`) in a bounded loop
until the struct says done, answering a null handle and queueing an error if
it never does. `nishgfx_device_request` is the same over
`wgpuAdapterRequestDevice` (`webgpu.h:6020`; `src/lib.rs:824`). No callback
reaches Nish, and Nish sees a handle or null.

### 2.3 Errors are queued in C and drained by Nish

wgpu-native's default uncaptured-error and device-lost handlers `panic!`
(`src/lib.rs:413`–`441`, "Handling wgpu uncaptured errors as fatal by
default"), which would end a Nish program from inside Rust. So
`nishgfx_device_request` always installs both callbacks in the device
descriptor (`webgpu.h:4589`, `4598`). The uncaptured-error callback may fire
at any time, like `AllowSpontaneous`, and webgpu.h forbids calling back into
the API from it, so each callback only copies the kind and up to 255 bytes
of the message into a fixed 16-entry ring in the shim's static storage, and
counts what did not fit. Nish drains it:

```c
/* Answers 0 when the queue is empty, else the kind
 * (1 validation, 2 out of memory, 3 internal, 4 device lost),
 * and copies the message, NUL-terminated, into msg. */
int32_t nishgfx_error_next(WGPUDevice device, uint8_t *msg, uint32_t cap);
uint32_t nishgfx_errors_dropped(WGPUDevice device);
```

`std/gpu` calls it once per frame inside `endFrame` and answers a
`Result` for a device loss, so a lost device is a value the game handles,
never a panic.

## 3. The surface

`runApp` makes the window with SDL3 and hands the shim its native handle;
the shim chains the matching source onto a `WGPUSurfaceDescriptor`:

| Platform | From SDL3 | Into |
| --- | --- | --- |
| macOS | `SDL_WINDOW_METAL`, `SDL_Metal_CreateView`, `SDL_Metal_GetLayer` (`SDL_metal.h:75`, `103`) | `WGPUSurfaceSourceMetalLayer` (`webgpu.h:3201`) |
| Linux, Wayland | `SDL_PROP_WINDOW_WAYLAND_DISPLAY_POINTER`, `..._SURFACE_POINTER` (`SDL_video.h:1653`, `1654`) | `WGPUSurfaceSourceWaylandSurface` (`webgpu.h:3227`) |
| Linux, X11 | `SDL_PROP_WINDOW_X11_DISPLAY_POINTER`, `..._X11_WINDOW_NUMBER` (`SDL_video.h:1662`, `1664`) | `WGPUSurfaceSourceXlibWindow` (`webgpu.h:3327`) |

The shim reads the video driver SDL chose (`SDL_GetCurrentVideoDriver`) and
takes the Wayland row or the X11 row from it. `wgpuSurfaceConfigure`
(`webgpu.h:6654`) picks the present mode from the `vsync` option: `Mailbox`
when the surface offers it, `Immediate` when `vsync: false`, else `Fifo`,
which every surface offers. A frame takes `wgpuSurfaceGetCurrentTexture`
(`webgpu.h:6680`): on `SuccessOptimal` or `SuccessSuboptimal` it draws and
presents (`wgpuSurfacePresent`, `webgpu.h:6688`); on `Timeout` or `Outdated`
it reconfigures at the window's new size and skips the frame; on `Lost` it
makes the surface again; on `Error` it queues an error (§2.3).

**Offscreen.** `runApp({ offscreen: { width, height, frames } })`, and every
test, make no window and initialise no SDL video at all: the shim renders
into an `RGBA8Unorm` texture of that size, copies it to a buffer whose rows
are padded to WebGPU's 256-byte `bytesPerRow` multiple, maps it
(`wgpuBufferMapAsync`, `webgpu.h:6119`, completed by `wgpuDevicePoll` with
`wait` true, `wgpu.h:1489`) and copies the unpadded rows into the program's
`u8[]`. That is what S3's CI job runs on lavapipe, and what a test compares
with a checked-in image.

## 4. The frame model

A game is three hooks and its settings. The same source builds for both
targets with no edit:

```typescript
import { runApp } from "nish/gfx";

export const step = (): void => { /* one fixed step: physics, input */ };
export const update = (dt: f64): void => { /* once a frame, dt in seconds */ };
export const draw = (alpha: f64): void => { /* once a frame */ };

export const main = (): void => {
  runApp({ step, update, draw, stepsPerSecond: 60 });
};
```

**Natively** the hooks are function references
([LANGUAGE.md](LANGUAGE.md#function-references), WP51 S1/S2), held in the
fields of `runApp`'s options class and called from a loop written in Nish in
`std/gfx/app.ts`. Their limits are the language's: each hook names a
top-level function that is not generic (NL2725), not `async` (NL2727), not
declared in C (NL2728), and whose arrow captures nothing (NL2731); an
optional hook is a field typed `Hook | null`, which a class field may be but
module storage may not (NL2686, `reject_fnref_storage_nullable`); a module
constant may not hold a reference at all. An arrow written inline at the
call, even one capturing nothing, is refused today (NL2336,
`reject_fnarg_arrow_value`) and waits on WP51 S3, which is why the hooks
above are top-level `const`s.

The loop is the one the browser page already runs
([browser-games.md](guide/using-nish/browser-games.md#120-and-240-hz-displays)):
`step` at a fixed rate, at most `maxStepsPerFrame` of them a frame (8 by
default, `runtime/page-frame.mjs:646`), a frame longer than a quarter of a
second counted as a quarter second (`LONGEST_FRAME_MS = 250`,
`runtime/page-frame.mjs:617`), then `update(dt)` once and `draw(alpha)` once.

**In the browser** the module is compiled for wasm32 and the page drives its
exports; no function reference crosses, because the page calls `step`,
`update` and `draw` by their export names. `nish/gfx` resolves on wasm32 to
its `.wasm32.ts` variant (S6), whose `runApp` stores the scalar settings
(`stepsPerSecond`, `maxStepsPerFrame`, `framesInFlight`, the scale bounds)
in module storage, where the page reads them from the module's `layout`,
and returns. That is why the hooks must be exported: S7's
`nish/page/gfx` refuses to start a module with no `draw` export.

`nish/page/game` is left as it is. A `nish/page/game` game exports
`init(seed)`, `step(nowMs)` and `draw(alpha, frameMs)`
([browser-games.md](guide/using-nish/browser-games.md#the-three-exports));
`nish/page/gfx` maps the same clock onto the new hooks:

| `nish/page/game` | `nish/page/gfx` |
| --- | --- |
| `init(seed)` once | `main()` once, after the adapter and device are awaited; a seed is the program's own (`nish:random`) |
| `step(nowMs)` per fixed step | `step()`: the step's time is its count times the interval, so it is not passed |
| — | `update(dt)` once per frame, `dt` the clamped frame time in seconds |
| `draw(alpha, frameMs)` per frame | `draw(alpha)`; the frame time is `update`'s `dt` |

## 5. The web transport

Two kinds of call cross from the wasm module to the page. **Creating
resources** (a buffer, a texture, a pipeline, a bind group) is rare and goes
through host imports, one per object, the object kept in a `HostTable`
(`runtime/page.mjs:20`) and named in Nish by a `HostHandle<"kind">`
([wp50](wp50-wasm-host.md#4-w4-host-handles-hosthandlekind)). Data goes as
a buffer window `(view, at, n)` over module storage
([wp50 §5.3](wp50-wasm-host.md#53-a-buffer-argument-to-an-import-a-window-view-at-n)),
so a sprite batch's 10,000 instances are one `writeBuffer` import, not
10,000. Requests the browser answers with a promise (`requestAdapter`,
`requestDevice`, shader compilation) are awaited by the page before it calls
`main`, because `async` is refused on wasm (NL2652).

**Encoding** is the hot path, and the plan offered two transports: one host
import per encoder call, or a per-frame command ring in module storage
(`nish/host/ring`, `std/host/ring.ts`) the page decodes at the end of the
frame. **Measured: the ring loses, so `std/gpu` encodes with one import per
call, and S7's `runtime/page-gpu.mjs` has no command decoder.**

The bench encodes `n` commands of four `i32` words each (an opcode and three
operands, the shape of `draw(vertices, instances, first)`) three ways, and
the page side hands each to the same JavaScript dispatcher:

- **imports**: one host import per command, `draw(7, i, i + 1, i + 2)`;
- **ring**: four `ringPush` calls per command, then one `flush()` import
  whose JavaScript walks the slots once and publishes the head once (the
  fast way to drain it; `ringOver`'s word-at-a-time `shift`,
  `runtime/page.mjs:119`, measured about 3.5 times slower again: 2,665,471 ns
  for 10,000);
- **array**: the best case for any batching transport, four plain stores
  per command into an `Int32Array` in module storage, then one
  `flushArray(k)` import that walks the `k` words.

Built with the 0.46.0 seed, `nish cmds.ts --target wasm32 --host
web/host.ts --allow-panics -o out/` then
`bash scripts/build.sh out/cmds.ll out/ring.ll -o out/cmds.wasm --profile wasm-host`,
and run under Node v22.23.5 (V8, the engine of Chromium's WebGPU) on one
core of an Intel Xeon at 2.10 GHz. Each figure is the median of 7 runs, each
the mean over 500 frames (200,000 for `n = 8`), after one warm-up run:

| Commands a frame | imports | array | ring |
| --- | --- | --- | --- |
| 8 (the triangle's pass, with headroom) | 54 ns | 96 ns | 672 ns |
| 10,000 (10,000 sprites, one draw each: the worst case) | 80,954 ns | 88,889 ns | 757,492 ns |
| 20,000 | 163,960 ns | 183,249 ns | 1,538,305 ns |

Across the runs the spread (min to max of the 7) was 50–59 ns, 79,909–83,550
ns and 159,643–211,944 ns for imports, and 95–103 ns, 86,948–90,827 ns and
176,768–204,602 ns for the array. An import costs about 8 ns a call (80,954 /
10,000 = 8.1); the ring costs about 76 ns a command (757,492 / 10,000 = 75.7),
nine times as much, because each of its four `ringPush` calls reduces both
counts modulo twice the capacity and bounds-checks the slot
(`std/host/ring.ts`). Even the plain array, which no ring can beat, is
slower than imports at every size (by 10% at 10,000 commands), since it pays
a store in wasm and a load in JavaScript where the import pays one call. A
batched sprite frame (§7) is a handful of commands, where the table's first
row says the transport costs well under a microsecond either way.

## 6. The auto-scaling controller

`std/gfx/scale.ts` (S9) renders the scene into an offscreen target at an
internal scale `s` of the surface's size and upscales it to the surface. The
target is allocated once at the largest scale and drawn through a viewport,
so changing `s` allocates nothing.

- **Input.** GPU time per frame where the adapter has
  `WGPUFeatureName_TimestampQuery` (`webgpu.h:650`; `"timestamp-query"` in
  the browser): a pair of timestamp writes at the scene pass's start and end,
  resolved into a buffer (`wgpuCommandEncoderResolveQuerySet`,
  `webgpu.h:6210`) and read `framesInFlight` frames later, so reading never
  stalls. Without the feature, the CPU frame time from the start of `update`
  to the present, which over-counts when the CPU is the bottleneck and so
  only ever errs toward a lower scale.
- **Target.** The display's refresh interval `T`: natively
  `1 / refresh_rate` from `SDL_GetCurrentDisplayMode` (`SDL_video.h:906`,
  `refresh_rate` at 146; 60 Hz when it reads 0), in the browser the
  measured `requestAnimationFrame` interval the page already keeps
  (`game.refreshHz`). The controller aims at a budget `B = 0.85 T`.
- **Output.** `s` between `minScale` and `maxScale` (0.5 and 1 by
  default), in steps of 1/16. The frame time `t` is smoothed
  (`m ← m + 0.1 (t − m)`). When `m > B` for 8 frames running, `s` drops to
  `s · sqrt(B / m)` (pixel cost goes as the square of the scale), rounded
  down to a step. When `m < 0.6 T` for 60 frames running, `s` rises by one
  step. Between `0.6 T` and `B` nothing changes, and after any change the
  controller holds for 30 frames: the band and the hold are the hysteresis
  that keeps it from oscillating.

Those constants are this note's choices, not measurements. S9's test feeds
the controller synthetic frame times (a load step up, then down) and asserts
that `s` converges inside its bounds and changes at most once per hold.

## 7. The budgets S9 pins

`bench/gfx-sprites` (S9) draws 10,000 sprites through `SpriteBatch`:
fill the instance array, one `queue_write` of it, one draw per texture run.
It pins two numbers, each a failing check:

- **CPU time per frame: at most 1 ms** at 10,000 sprites, the median over
  1,000 offscreen frames on the CI runner, GPU time excluded. That is a
  quarter of a 240 Hz frame (4.17 ms) and 100 ns a sprite. The transport is
  not where it goes: §5 measured 54 ns for a frame of 8 commands. S9 records
  the measured figure beside the bound in its PR.
- **Allocations per frame: zero.** After the first frame, the bench's count
  of arena and heap allocations across 1,000 frames is unchanged. Everything
  a frame needs (the instance array, the encoder state, the error message
  buffer, the scale target) is made before the first frame.

## 8. Capabilities and the security scope

`std/gpu/sys.ts` calls C through `declare function`, so a program that
imports `std/gpu` or `std/gfx` reaches
[`ffi`](LANGUAGE.md#capabilities) and `--deny ffi` refuses it natively. In
the browser a host import is an `ffi` call too
([interop.md](guide/using-nish/interop.md)). The shim reads input devices
(keyboard, mouse, gamepads, through SDL3) and talks to another process (the
Wayland compositor or the X server), so it is attacker-facing under
[CLAUDE.md](../CLAUDE.md)'s rule: S3 lands `docs/security/gfx.md` with its
scope (`runtime/gfx/**`), its findings and its index row, and
`scripts/security-scope.mjs` refuses the shim until it does. The error queue
(§2.3) is a bound that record lists, with the check that overflows it.

## 9. Licensing

SDL3 is zlib-licensed (`LICENSE.txt`, "Copyright (C) 1997-2026 Sam
Lantinga"), wgpu-native is MIT or Apache-2.0 (`LICENSE.MIT`,
`LICENSE.APACHE`), and webgpu.h is BSD 3-Clause (webgpu-headers'
`LICENSE`). Nothing is vendored: `fetch-gfx.sh` downloads each at build time
into `build/gfx/`, which is not committed. A static link puts SDL3's and
wgpu-native's code in a built program, so S3's README for the shim tells a
user shipping one which notices to carry; if a header is ever vendored, it
goes into [THIRD_PARTY_NOTICES.md](../THIRD_PARTY_NOTICES.md) per
[.claude/licensing.md](../.claude/licensing.md).

## Stages

| Stage | What |
| --- | --- |
| S1 | This note: the pins, the ABI, the frame model, the transport, the controller, the budgets. |
| S2 | Numeric typed arrays (`f32[]`, `u16[]`, `u32[]`, `i32[]`) as buffers a declared C function borrows. |
| S3 | `runtime/gfx/`, `scripts/fetch-gfx.sh`, the `build.sh` link rule, the CI `gfx` job on lavapipe, `docs/security/gfx.md`. |
| S4 | `std/gpu/sys.ts` through c-import, and `examples/gfx/clear.ts`. |
| S5 | `std/gpu`'s modules (context, buffer, pipeline, texture, frame) and the triangle. |
| S6 | `<name>.wasm32.ts` variants through the `nish-wasm32` export condition. |
| S7 | `runtime/page-gpu.mjs`, `nish/page/gpu`: WebGPU objects in `HostTable`s, one import per call (§5). |
| S8 | `std/gfx`: `runApp`, input, `SpriteBatch`, the framebuffer. |
| S9 | `std/gfx/scale.ts`, the present modes, `bench/gfx-sprites` and its budgets. |
| S10 | Windows, on WP79. |
