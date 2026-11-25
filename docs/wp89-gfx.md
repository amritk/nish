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
`runtime/gfx/nish-gfx.h`, so the header uses only what
[c-import binds](guide/using-nish/c-import.md#what-is-not-bound): scalars,
opaque handles, and structs through a pointer. It has no union, no struct by
value, no callback (a function pointer, which c-import does not bind, and
which Nish could not pass anyway: a reference to a declared C function is
refused, NL2728, `reject_fnref_ffi`, [LANGUAGE.md](LANGUAGE.md#function-references)),
and nothing variadic. Every exported name starts `nishgfx_`, which is how
`scripts/build.sh` decides to link the shim, the rule it already has for
SQLite's adapter (a declared `nishsqlite_*` or `sqlite3_*` name in the IR;
`callsSqlite` in `src/run-cache.ts`).

`nish-gfx.h` does not include webgpu.h. c-import skips a function from an
included header unless `allow` names it, and binds a struct from one as a
`CPtr` rather than a class
([c-import](guide/using-nish/c-import.md#what-is-not-bound)), so the shim
declares its own opaque types, `typedef struct NishGfxDevice NishGfxDevice;`
and one per WebGPU object, and each binds as its own handle class. The header
ships with `nish-gfx.overrides.json`: `"allow": ["nishgfx_*"]`, and
`"buffer"` on each data and message pointer, naming the `size_t` length
straight after it so the binding keeps the plain `(data: u8[], len: u64)`
form ([c-import, the overrides file](guide/using-nish/c-import.md#overrides-what-the-header-cannot-say)).
c-import takes a `"buffer"` override only on a `void *` or `char *`
(`src/c-import.ts:2705`), so every byte buffer in the header is declared
`void *`, or `const void *` for one C only reads (which binds as a
`readonly u8[]`), never `uint8_t *`.

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

NishGfxBuffer *nishgfx_buffer_create(NishGfxDevice *device,
                                     const NishGfxBufferDesc *desc,
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
(`src/unimplemented.rs:227`), so calling it aborts the process, and asking
`wgpuCreateInstance` for timed waits panics ("Unsupported timed WaitAny
features specified", `src/lib.rs:653`–`680`); the shim asks for neither.

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
at any time and on wgpu's own thread, like `AllowSpontaneous`
(`webgpu.h:478`), so each callback only copies the kind and up to 255 bytes
of the message into a fixed 16-entry ring held in the shim's per-device
struct (allocated with the device, so two devices never share one), under
that struct's mutex, and counts what did not fit. Nish drains it:

```c
/* Answers 0 when the queue is empty, else the kind
 * (1 validation, 2 out of memory, 3 internal, 4 device lost),
 * and copies the message, NUL-terminated, into msg. */
int32_t nishgfx_error_next(NishGfxDevice *device, void *msg, size_t cap);
uint32_t nishgfx_errors_dropped(NishGfxDevice *device);
```

`std/gpu` calls it once per frame inside `endFrame` and answers a
`Result` for a device loss, so a lost device is a value the game handles.
That covers what wgpu-native reports through these two callbacks; it does not
cover wgpu-native's own fatal paths, which stay fatal: a poll error inside
`wgpuInstanceProcessEvents` goes to `handle_error_fatal` (`src/lib.rs`, near
line 2836), and an entry point given a handle it cannot use `expect`s.
`docs/security/gfx.md` (S3) records them as open findings.

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
(`webgpu.h:6654`) picks the present mode from the `vsync` option: with
`vsync` on (the default) `Fifo`, which every surface offers; with it off, `Mailbox` when the
surface's capabilities list it, else `Immediate` when they list that, else
`Fifo`. A frame takes `wgpuSurfaceGetCurrentTexture`
(`webgpu.h:6680`): on `SuccessOptimal` or `SuccessSuboptimal` it draws and
presents (`wgpuSurfacePresent`, `webgpu.h:6688`); on `Timeout` or `Outdated`
it reconfigures at the window's new size and skips the frame; on `Lost` it
makes the surface again; on `Error` it queues an error (§2.3).

**Offscreen.** An app whose `offscreen` field is set
(`app.offscreen = offscreen(width, height, frames)`), and every test,
make no window and initialise no SDL video at all: the shim renders
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
import { App, runApp } from "nish/gfx";

export const step = (): void => { /* one fixed step: physics, input */ };
export const update = (dt: f64): void => { /* once a frame, dt in seconds */ };
export const draw = (alpha: f64): void => { /* once a frame */ };

export const main = (): void => {
  const app = new App(draw);
  app.step = step;
  app.update = update;
  app.stepsPerSecond = 60;
  runApp(app);
};
```

**Natively** the hooks are function references
([LANGUAGE.md](LANGUAGE.md#function-references), WP51 S1/S2), held in the
fields of the `App` class and called from a loop written in Nish in
`std/gfx/app.ts`. Their limits are the language's: each hook names a
top-level function that is not generic (NL2725), not `async` (NL2727), not
declared in C (NL2728), takes no rest parameter (NL2729), and whose arrow
captures nothing (NL2731); an
optional hook is a field typed `Hook | null`, which a class field may be but
module storage may not (NL2686, `reject_fnref_storage_nullable`); a module
constant may not hold a reference at all. An arrow bound to a local is a value, which
WP51's first stage does not lift: even one capturing nothing is refused
today (NL2336, `reject_fnarg_arrow_value`); lifting it waits on WP51 S3.
That, and the browser's need to
call them by export name, is why the hooks above are top-level `const`s.
The settings are an `App` built by its constructor and set field by field,
not an object literal, because a literal must set every field (optional
fields are refused) and a class with methods is not built from one
([LANGUAGE.md](LANGUAGE.md#interfaces-and-object-literals)); every field
but `draw` has a default. This supersedes the plan's S8 signature,
`runApp({ step?, update?, draw, stepsPerSecond, maxStepsPerFrame,
framesInFlight })`: S8 builds `App` and `runApp(app)` as written here.

The loop's clock and limits are the ones the browser page already uses
([browser-games.md](guide/using-nish/browser-games.md#120-and-240-hz-displays)):
`step` at a fixed rate, at most `maxStepsPerFrame` of them a frame (8 by
default, `runtime/page-frame.mjs:646`), a frame longer than a quarter of a
second counted as a quarter second (`LONGEST_FRAME_MS = 250`,
`runtime/page-frame.mjs:617`), then `update(dt)` once and `draw(alpha)`
once. The `update` hook is new work: the page's `runFixedStep`
(`runtime/page-frame.mjs:641`) has only a step and a render, so S8 adds the
per-frame call on both sides, in `std/gfx/app.ts` and
`runtime/page-gfx.mjs`.

**In the browser** the module is compiled for wasm32 and the page drives its
exports; no function reference crosses, because the page calls `step`,
`update` and `draw` by their export names. `nish/gfx` resolves on wasm32 to
its `.wasm32.ts` variant (the resolution rule is S6's; the variant, like all
of `std/gfx`, is S8's), whose `runApp` stores the scalar settings
(`stepsPerSecond`, `maxStepsPerFrame`, `framesInFlight`, the scale bounds)
in module storage, where the page reads them from the module's `layout`,
and returns. That is why the hooks must be exported: S8's
`nish/page/gfx` (`runtime/page-gfx.mjs`) refuses to start a module with no `draw` export.

`nish/page/game` is left as it is. A `nish/page/game` game exports
`init(seed)`, `step(nowMs)` and `draw(alpha, frameMs)`
([browser-games.md](guide/using-nish/browser-games.md#the-three-exports));
`nish/page/gfx` maps the same clock onto the new hooks:

| `nish/page/game` | `nish/page/gfx` |
| --- | --- |
| `init(seed)` once | `main()` once, after the adapter and device are awaited; a seed is the program's own (`nish/random`'s `Rng`) |
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
  `runtime/page.mjs:119`, measured about 3.5 times slower again: 2,650,672 ns
  for 10,000);
- **array**: the best case for any batching transport, four plain stores
  per command into an `Int32Array` in module storage, then one
  `flushArray(k)` import that walks the `k` words.

The bench's Nish side, `cmds.ts`, with the page side's three imports
declared in `web/host.ts` (`draw(op, a, b, c)`, `flush()`, `flushArray(n)`):

```typescript
import { draw, flush, flushArray } from "./web/host.ts";
import { ringPush } from "nish/host/ring";

export const RING = new Int32Array(2 + 4 * 32768);
export const CMDS = new Int32Array(4 * 32768);

export const viaImports = (n: integer<0, 100000>): void => {
  for (let i: i32 = 0; i < n; i++) {
    draw(7, i, i + 1, i + 2);
  }
};

export const viaRing = (n: integer<0, 100000>): void => {
  for (let i: i32 = 0; i < n; i++) {
    ringPush(RING, 7);
    ringPush(RING, i);
    ringPush(RING, i + 1);
    ringPush(RING, i + 2);
  }
  flush();
};

export const viaArray = (n: integer<0, 32768>): void => {
  let k: i32 = 0;
  for (let i: i32 = 0; i < n; i++) {
    CMDS[k] = 7; CMDS[k + 1] = i; CMDS[k + 2] = i + 1; CMDS[k + 3] = i + 2;
    k = k + 4;
  }
  flushArray(k);
};
```

It was built with the 0.46.0 seed, `nish cmds.ts --target wasm32 --host
web/host.ts --allow-panics -o out/` then
`bash scripts/build.sh out/cmds.ll out/ring.ll -o out/cmds.wasm --profile wasm-host`
(2,641 bytes), and driven by a Node script that instantiates it with the
three imports and times each export. That ran under Node v22.23.5 (V8, the
engine Chromium runs a page's wasm on) on an Intel Xeon at 2.10 GHz. Each
figure is the median of 7 samples, each the mean over 500 frames (200,000
for `n = 8`), after one warm-up sample; the range is the 7 samples' minimum
to maximum:

| Commands a frame | imports | array | ring |
| --- | --- | --- | --- |
| 8 (the triangle's pass, with headroom) | 52 ns (49–54) | 98 ns (97–105) | 637 ns (632–676) |
| 10,000 (10,000 sprites, one draw each: the worst case) | 84,914 ns (83,517–98,214) | 89,937 ns (87,896–97,038) | 749,112 ns (718,359–783,280) |
| 20,000 | 174,490 ns (165,527–279,737) | 182,239 ns (176,574–193,719) | 1,545,910 ns (1,490,486–1,611,094) |

An import costs about 8.5 ns a call (84,914 / 10,000); the ring costs about
75 ns a command (749,112 / 10,000 = 74.9), nearly nine times as much,
because each of its four `ringPush` calls is an out-of-line call that
reduces both counts modulo twice the capacity and bounds-checks the slot
(`std/host/ring.ts`). Even the plain array, which no ring can beat, is
slower than imports by 88% at 8 commands, and at 10,000 and 20,000 within
the noise of them (the ranges overlap; the medians are 6% and 4% apart),
since it pays a store in wasm and a load in JavaScript where the import pays
one call. A batched sprite frame (§7) is a handful of commands, where the
table's first row says the transport costs well under a microsecond either
way.

The bench's commands are four `i32`s. The encoder calls that take a `u64`
offset or size (`setVertexBuffer`, `writeBuffer`) cross a wasm import as a
`BigInt`, which V8 boxes; S7 measures that shape with the same driver before
it lands, and the choice is revisited if it costs more than a ring command.

The bench is not in the repository. To run it again, copy `cmds.ts` above
and these two files into an empty directory, build as above, and run
`node drive.mjs <imports|array|ring|shift> [8,10000,20000]` there, with
`<checkout>` replaced by the path of a nish checkout. `web/host.ts`:

```typescript
import type { i32 } from "nish";
let sink = 0;
export function draw(op: i32, a: i32, b: i32, c: i32): void { sink = (sink + op + a + b + c) | 0; }
export function flush(): void { (globalThis as any).__flush(); }
export function flushArray(n: i32): void { (globalThis as any).__flushArray(n); }
```

`drive.mjs` (mode `ring` is the bulk drain, `shift` the word-at-a-time one):

```javascript
import { readFileSync } from "node:fs";
import { ringOver } from "<checkout>/runtime/page.mjs";
const mode = process.argv[2];
let sink = 0;
const dispatch = (op, a, b, c) => { sink = (sink + op + a + b + c) | 0; };
let ring, words, at, cap;
const host = {
  flushArray: (n) => { const w = new Int32Array(inst.exports.memory.buffer, inst.exports["nish_storage_0_CMDS.data"].value, n); for (let k = 0; k < n; k += 4) dispatch(w[k], w[k + 1], w[k + 2], w[k + 3]); },
  draw: dispatch,
  flush: mode === "shift"
    ? () => { while (ring.size() >= 4) dispatch(ring.shift(), ring.shift(), ring.shift(), ring.shift()); }
    : () => { // bulk: read head/tail once, walk the slots, publish the head once
        const w = new Int32Array(inst.exports.memory.buffer, at, 2 + cap);
        let h = w[0], t = w[1];
        while (h !== t) { const i = h % cap; dispatch(w[2 + i], w[2 + (i + 1) % cap], w[2 + (i + 2) % cap], w[2 + (i + 3) % cap]); h = (h + 4) % (2 * cap); }
        w[0] = h;
      },
};
const { instance: inst } = await WebAssembly.instantiate(readFileSync("out/cmds.wasm"), { host, nish: { panic: () => { throw new Error("panic"); } } });
at = inst.exports["nish_storage_0_RING.data"].value; cap = 4 * 32768;
ring = ringOver(inst.exports.memory, { at, length: 2 + cap });
const run = (fn, n, frames) => { const t0 = process.hrtime.bigint(); for (let f = 0; f < frames; f++) fn(n); return Number(process.hrtime.bigint() - t0) / frames; };
for (const n of (process.argv[3] ?? "8,10000,20000").split(",").map(Number)) {
  const frames = n === 8 ? 200000 : 500;
  const fn = mode === "imports" ? inst.exports.viaImports : mode === "array" ? inst.exports.viaArray : inst.exports.viaRing;
  run(fn, n, frames); // warm
  const s = []; for (let k = 0; k < 7; k++) s.push(run(fn, n, frames));
  s.sort((x, y) => x - y);
  console.log(mode, "n=" + n, "median ns/frame", s[3].toFixed(0), "min", s[0].toFixed(0), "max", s[6].toFixed(0), "ns/cmd", (s[3] / n).toFixed(2));
}
```

## 6. The auto-scaling controller

`std/gfx/scale.ts` (S9) renders the scene into an offscreen target at an
internal scale `s` of the surface's size and upscales it to the surface. The
target is allocated at the largest scale of the surface's size and drawn
through a viewport, so changing `s` allocates nothing; only a resize
allocates it again.

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
  not where it goes: §5 measured 52 ns for a frame of 8 commands. S9 records
  the measured figure beside the bound in its PR.
- **Allocations per frame: zero.** After the first frame, a count of arena
  and heap allocations across 1,000 frames is unchanged. No such counter
  exists today; S9 adds it to the bench, and the bound is checked only from
  then. Everything a frame needs (the instance array, the encoder state, the
  error message buffer, the scale target) is made before the first frame;
  the scale target is made again only on a resize, never in a steady-state
  frame.

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

## 10. A module file chosen by target (S6)

S6 shipped the rule §4 leans on. A wasm32 build asks a package's `exports`
for `nish-wasm32` before `nish-<mode>` and `nish`, and resolves a library
module `nish/<name>` to `std/<name>.wasm32.ts` when that file is beside
`std/<name>.ts`. A native build reads neither. The target outranks the mode
because the two files differ in what they can link against (the operating
system against the host page), while the mode only changes how one source
compiles. `nish-wasm32` cannot be a mode's condition, because the modes are
`i32` and `f64`. The pair must export the same names with the same
signatures, and both builds compare it at the import (`NL3063`). The rule,
its wording and its cases are in
[LANGUAGE.md](LANGUAGE.md#export-and-import), in its package bullets.

No library module has a twin yet, and S6 adds none. The library half is
pinned by `tests/link/module_target_std_twin`, which points a `Compilation`
at a library root of its own and checks the path and module name each build
resolves `nish/<name>` to, and the pair comparison `Compilation` runs on it;
`tests/link/module_target_twin` pins the comparison itself. The first end to
end case through the shipped `std/` lands with the first twin, in S7.

What the comparison reads, and what it leaves out:

- A signature is a declaration's text up to its body or initializer. A
  constant with no annotation is compared whole, initializer included, since
  that is its type; every field, function and method already annotates its
  type.
- A class's `private` members are skipped; its public members count
  in the order they are written, which keeps the comparison one string per
  export.
- The pair is compared once per build, at the first import that reaches it,
  and refused there; later importers are not reported again.

Open questions:

- A twin that does not parse is not compared, so the native build passes
  the pair and only the wasm32 build, which compiles it, reports the parse
  error. That fails open for a native-only CI; it is left so because the
  parse error is reported by the first wasm32 build.
- `nish/<name>.wasm32` names the twin file directly and resolves under any
  target. Refusing a `.wasm32` stem would close the native build's route to
  wasm32-only source.
- `nish:` builtin modules have no twin lookup; their source is the
  compiler's.

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
