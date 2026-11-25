# Security record: the graphics shim over wgpu-native and SDL3

The record of `runtime/gfx/`, the C shim `scripts/build.sh` links into a
program whose IR declares an `@nishgfx_` function
([runtime/gfx/README.md](https://github.com/amritk/nish/blob/main/runtime/gfx/README.md)).
It says which of the shim's inputs are the program's and which reach it from
outside the process, the bounds the shim keeps on each, and what it leaves
to wgpu-native and SDL. It is written when the C lands, not after an audit,
so that an audit starts from evidence.

`file:line` anchors are at `abb27ff4`.

**Result.** No byte of SDL 3.4.20 or wgpu-native v29.0.1.1 is in the tree:
`scripts/fetch-gfx.sh` downloads them and refuses any download whose sha256
is not the one it pins. The review of the shim found five Low findings. One
is fixed, and four are open ([Findings](#findings)).

## Scope

| File | What |
| --- | --- |
| `runtime/gfx/nish-gfx.c` | The `nishgfx_*` functions: handles over wgpu-native's objects, the device's error ring, a window's event ring, the pipeline and bind group builders, the offscreen target and its readback |
| `runtime/gfx/nish-gfx.h` | Their declarations, which `nish c-import` binds |

Out of scope: SDL3 and wgpu-native themselves, the program's WGSL, and the
GPU driver.

## What reaches the shim from outside

The process takes in two things it did not write:

- **SDL events**, from the window system. `nishgfx_events_poll`
  (`nish-gfx.c:285`) copies only quit, close, key, mouse motion, mouse
  button, wheel and pixel-size events into the window's ring. It drops
  every other kind (`continue`, `:330`). A pixel size below zero reaches the
  program as 0 (`:326-327`).
- **wgpu-native's error messages**, through the uncaptured-error and
  device-lost callbacks (`:628-632`). They are driver text of any length.
  `ring_push` (`:62`) keeps at most `NISHGFX_ERROR_MESSAGE_MAX` (255) bytes
  of each message and always ends it with a NUL. `ring_pop` (`:79`) writes at
  most the caller's `cap - 1` bytes and a NUL.

Everything else the shim takes is a value the program passed: a size, a
handle, a buffer and its length.

## Bounds

Each bound is pinned by a check in `tests/gfx.js`: the first seven by a line
`tests/gfx/triangle.c` prints, the last by a link of a module. Removing the
bound fails the check whose string is in the third column.

| Bound | Where | Check that fails without it |
| --- | --- | --- |
| The error ring holds 16 reports. A report past them is counted in `nishgfx_errors_dropped` and stores nothing | `ring_push` (`nish-gfx.c:67-68`) | "gfx: the device's error ring keeps 16 reports and counts the 4 past it as dropped" |
| A message keeps 255 bytes and ends with a NUL. A drain into `cap` bytes writes `cap - 1` and a NUL, and nothing past them | `ring_push` (`:65`), `ring_pop` (`:86-89`) | "gfx: an error message is kept to 255 bytes and drained to the caller's cap less its NUL" |
| A window's event ring holds 64 events, in order. An event past them is counted in `nishgfx_events_dropped` and stores nothing | `event_push` (`:276-281`) | "gfx: a window's event ring keeps the first 64 events in order and counts the 6 past it as dropped" |
| A pixel size SDL reports below zero reaches the program as 0, not as a `uint32_t` near 4 billion | `nishgfx_events_poll` (`:326-327`) | "gfx: a resize SDL reports below zero reaches the program as 0" |
| A pipeline builder takes 16 vertex attributes and a bind group builder 16 entries; the 17th answers -1 | `nishgfx_pipeline_desc_attribute` (`:757`), `nishgfx_bind_group_desc_buffer` (`:830`) | "gfx: the pipeline and bind group builders take 16 entries each and refuse the 17th" |
| An offscreen target of 0, or more than 16384, on a side is refused before wgpu-native sees it. That keeps `width * 4 * height` within 2^30 | `nishgfx_offscreen_create` (`:960`) | "gfx: offscreen_create refuses 0 and 16385 a side and hands 16384 to the device" |
| `offscreen_read` into fewer than `width * 4 * height` bytes answers -1 and writes nothing | `nishgfx_offscreen_read` (`:1015`) | "gfx: offscreen_read refuses a buffer one byte short and leaves it untouched" |
| A program that declares no `@nishgfx_` function links none of `runtime/gfx/`, SDL or wgpu-native. A string that names one is not a declaration | `callsGfx` (`src/run-cache.ts:181`), the `nishgfx_` read in `scripts/build.sh` | "gfx: a module that does not declare an @nishgfx_ function (plain\|string\|defined\|after) links without runtime/gfx/ or its libraries" |

The readback's row copy reads at most `mapped` bytes and writes at most
`need`. The reason is in the comment above the loop (`:1056-1058`), and it
holds because `:966` makes `padded_row` at least `width * 4`. No check fails
without it apart from the short-buffer refusal, and none fails without the
saturation of the two dropped counters (`:68`, `:278`), which takes 2^32
overruns to reach. Both are bounds read only from the code.

## Findings

| ID | Severity | Where | Finding | Status |
| --- | --- | --- | --- | --- |
| GFX-1 | Low | `nishgfx_bind_group_desc_buffer` (`nish-gfx.c:839`) | A bind group entry of size 0 reached wgpu-native as 0. wgpu-native panicked ("invalid size", `src/conv.rs`), and because its panic cannot unwind across the C ABI the process aborted. A program could stop itself with one ordinary argument. | **Fixed.** Size 0 now means the rest of the buffer (`WGPU_WHOLE_SIZE`), as it already did in `nishgfx_pass_set_vertex_buffer`. "gfx: a bind group entry of size 0 binds the rest of the buffer instead of aborting the process" aborted before the fix and passes after it. |
| GFX-2 | Low | `nishgfx_adapter_request` (`:548-554`), `nishgfx_device_request` (`:640-643`), `nishgfx_offscreen_read` (`:1040-1043`) | A request wgpu-native has not answered after 1000 rounds of `wgpuInstanceProcessEvents` aborts the process. The pending callback still points at a stack frame, so returning would let a late answer write into freed stack. The abort is the safe exit, but it is a stop no caller can catch. | **Open.** Untested: no driver here leaves a request unanswered, and no test provokes one. |
| GFX-3 | Low | every call into wgpu-native | wgpu-native validates through its error callback, but some malformed input panics instead (`nm` shows `handle_error_fatal` in `libwgpu_native.a`), and a panic aborts the process. The shim screens the inputs it knows reach a panic (GFX-1, the offscreen sizes, the builder caps, and a null bind group or vertex buffer, which `nishgfx_pass_set_bind_group` and `nishgfx_pass_set_vertex_buffer` (`:930-941`) ignore instead of passing on); it cannot list the ones it does not know. | **Open.** Each one found is screened in the shim and gets a triangle line, as GFX-1 did. |
| GFX-4 | Low | `gfxFingerprint` (`src/run-cache.ts:575`) | The run cache keys a graphics build by the shim's sources, the prefix path and its `.fetched` stamp, not by the archives' bytes. A prefix whose `libSDL3.a` or `libwgpu_native.a` is replaced without a new stamp keeps the cached binary linked against the old ones. | **Open.** Hashing the archives costs tens of megabytes a run. `scripts/fetch-gfx.sh` always writes a new install and stamp, so this needs a prefix edited by hand. |
| GFX-5 | Low | `nishgfx_device_release` (`:658-665`), the callbacks' userdata (`:628-632`) | The device-lost and uncaptured-error callbacks hold the device struct, and `nishgfx_device_release` frees it after one round of events. wgpu-native keeps the device alive while any object made from it lives, so a buffer, pipeline or pass used after its device is released can fire a callback into freed memory. `nish-gfx.h` tells the program to release a device's objects first, a surface before its window and the instance last (`nish-gfx.h:92-93`, `:102`); nothing enforces any of it. | **Open.** Untested: no check uses an object after its device. Counting a device's live objects, or giving the callbacks a block that release only disconnects, would close it. |

## Trust model

- **The libraries.** `scripts/fetch-gfx.sh` downloads wgpu-native's release
  zip and SDL's source tarball over HTTPS. Before it reads either one, it
  checks the download against the sha256 the script pins (`fetch`,
  `scripts/fetch-gfx.sh:91-98`). It builds into a staging directory, writes
  the `.fetched` stamp there last, and only then moves the directory into
  `build/gfx/<platform>/` (`:134-137`), so an interrupted fetch never leaves
  a stamp on a half install. `NISH_GFX_PREFIX` names an
  install made some other way, and `scripts/build.sh` trusts it as given:
  whoever sets it chooses the code that is linked.
- **The program.** A length the program passes is its contract.
  `nishgfx_queue_write` (`nish-gfx.c:705`) checks only for NULL; `data` must
  hold `len` bytes. The binding `nish c-import` writes takes the array and
  `len` as two arguments, so a Nish caller that passes a `len` past its
  array's length hands wgpu-native a read past it.
- **Threads.** The error ring is locked (`:66`, `:81`), because wgpu-native
  may call its callbacks on its own threads. The event ring is not locked:
  SDL delivers events on the thread that polls, and a window is the program's
  to poll from one thread.
- **The window system.** On Linux, SDL `dlopen`s the Wayland or X11 client
  libraries at run time, and `nishgfx_surface_create` (`:354`) reads the
  display and surface pointers SDL hands back. It makes a surface only for
  the `wayland`, `x11` and macOS `cocoa` drivers, and refuses any other
  driver with a reported error (`:384-390`).
  The window is made with an external graphics context (`:258`), so SDL
  loads no GL for it. When the swapchain is outdated or lost,
  `nishgfx_surface_acquire` reconfigures it at the window's pixel size and
  skips the frame while that size is 0 (`:484`), and
  `nishgfx_surface_configure` refuses a 0 side with a reported error
  (`:434`). Both are untested: CI has no window system to make a surface on.
- **Wasm.** A module that declares an `@nishgfx_` function is refused under
  `--profile wasm`, `wasm-host` and `wasi` ("gfx: a module that declares an
  @nishgfx_ function is refused under --profile wasm|wasm-host|wasi").

## Tests

In `tests/run.js`, section `gfx` (`tests/gfx.js`). The triangle checks run on
any Vulkan, lavapipe included, and are skipped with a reason when no adapter
answers.

- "gfx: a module that does not declare an @nishgfx_ function (plain|string|defined|after) links without runtime/gfx/ or its libraries"
- "gfx: a module that declares an @nishgfx_ function, with no SDL3 or wgpu-native installed, is refused naming scripts/fetch-gfx.sh"
- "gfx: a module that declares an @nishgfx_ function is refused under --profile wasm|wasm-host|wasi"
- "gfx: scripts/build.sh and src/run-cache.ts callsGfx select the shim by the same declare prefix"
- "gfx: every C symbol runtime/gfx/nish-gfx.c calls, less SDL's and wgpu-native's, is one src/c-symbols.ts reserves"
- "gfx: tests/gfx/triangle.c draws a red triangle on a blue clear offscreen and reads it back"
- "gfx: offscreen_read refuses a buffer one byte short and leaves it untouched"
- "gfx: the device's error ring keeps 16 reports and counts the 4 past it as dropped"
- "gfx: a window's event ring keeps the first 64 events in order and counts the 6 past it as dropped"
- "gfx: an error message is kept to 255 bytes and drained to the caller's cap less its NUL"
- "gfx: the pipeline and bind group builders take 16 entries each and refuse the 17th"
- "gfx: a bind group entry of size 0 binds the rest of the buffer instead of aborting the process"
- "gfx: offscreen_create refuses 0 and 16385 a side and hands 16384 to the device"
- "gfx: a resize SDL reports below zero reaches the program as 0"
- "gfx: nish c-import binds every function runtime/gfx/nish-gfx.h declares"
- "gfx: a Nish program that calls nishgfx_instance_create links runtime/gfx/ with --link and gets an instance"

In section `security-scope`, "security-scope: refuses a file in no record's
scope (std/net, runtime/gfx) and a listed file a record now covers" checks
that a new `runtime/gfx/*.c` with no record row is refused.
