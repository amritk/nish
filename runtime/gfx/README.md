# runtime/gfx/

The C shim a Nish program draws through: `nish-gfx.h` and `nish-gfx.c`, a thin
synchronous layer over [wgpu-native](https://github.com/gfx-rs/wgpu-native)
(WebGPU) and [SDL3](https://libsdl.org/) (windows and input). Neither library
is vendored: `scripts/fetch-gfx.sh` downloads and pins them into
`build/gfx/<platform>/`, or `NISH_GFX_PREFIX` names an install made another
way.

| | wgpu-native | SDL |
| --- | --- | --- |
| Version | v29.0.1.1 | 3.4.20 |
| From | `wgpu-<platform>-release.zip` from <https://github.com/gfx-rs/wgpu-native/releases/tag/v29.0.1.1> | `SDL3-3.4.20.tar.gz` from <https://github.com/libsdl-org/SDL/releases/tag/release-3.4.20>, built by `fetch-gfx.sh` as a static library |
| SHA-256 | one per platform, in `scripts/fetch-gfx.sh` | `f3bb06f55bed9557227a700af2ea62e49497ebdf58037732a731a5fb3ef8581f` |
| Licence | MIT or Apache-2.0, at the user's choice; its `webgpu.h` is BSD-3-Clause (Copyright 2019-2023 WebGPU-Native developers) | zlib (Copyright (C) 1997-2026 Sam Lantinga) |

A binary that links the shim carries both libraries, statically, so whoever
ships it ships their notices too: SDL's zlib licence asks that its notice not
be removed from source distributions, and wgpu-native's MIT and Apache-2.0
terms ask that the notice travel with copies. Neither library's code is in
this repository, so neither is listed in `THIRD_PARTY_NOTICES.md`.

## The shim's rules

- `nish-gfx.h` is what `nish c-import` reads, with
  `nish-gfx.overrides.json` naming its buffers and nullable parameters. Every
  parameter is a scalar, an opaque handle or a struct by pointer: no unions,
  structs by value, callbacks or variadics. It does not include `webgpu.h`.
- Every WebGPU request that answers through a callback is made synchronous
  with a bounded `wgpuInstanceProcessEvents` loop, never `wgpuInstanceWaitAny`
  or a timed wait.
- Errors are queued, never called back into Nish: each device and instance
  keeps a ring of 16 reports of at most 255 bytes, and counts the ones that
  found it full.
- Offscreen targets read back through rows padded to 256 bytes and copy only
  the unpadded rows into a buffer whose length is checked first.

The security record is [`docs/security/gfx.md`](../../docs/security/gfx.md).

## How it is linked

`scripts/build.sh` compiles every `*.c` here for a link whose IR declares a
`nishgfx_*` function, and for no other link, and adds `-lSDL3 -lwgpu_native`
with the platform's system libraries. A link that needs the libraries and
finds none fails with a message naming `scripts/fetch-gfx.sh`. `wasm`,
`wasm-host` and `wasi` builds refuse the shim. `tests/gfx.js` ("gfx") draws
`tests/gfx/triangle.c` offscreen and checks its pixels.

## Updating

1. Change the versions and SHA-256 pins in `scripts/fetch-gfx.sh` and the
   table above, then run `scripts/fetch-gfx.sh --force`.
2. Rebuild against the new `webgpu.h`; its structs are filled through its
   `WGPU_*_INIT` macros, so a field added upstream needs no change here.
3. Run `node tests/run.js gfx`.
