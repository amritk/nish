# WP50: A WebAssembly module a TypeScript page drives

**State:** Landed · **Done:** 6 of 6 · **Design note:** [`docs/wp50-wasm-host.md`](https://github.com/amritk/nish/blob/main/docs/wp50-wasm-host.md)

## Stages

- [x] Stage 1: `--profile wasm-host`, `--memory`, `--inline`, the loader and `nish/vite`
- [x] Stage 2: host imports and `HostHandle<K>`
- [x] Stage 3: module storage, buffer windows and panics the page reports
- [x] Stage 4: strings across the boundary ([#1309](https://github.com/amritk/nish/pull/1309))
- [x] Stage 5: `--deterministic`, the same float bits on every target ([#1363](https://github.com/amritk/nish/pull/1363))
- [x] Stage 6: `examples/wasm-arena/`, its replay check and size row, and the ten-minute Chromium soak ([#1372](https://github.com/amritk/nish/pull/1372))

## Next

Nothing scheduled: every stage is built.

## Not planned

Generated DOM bindings, threads and `SharedArrayBuffer`, closures. `async` on wasm is [WP54](wp54-async-wasm.md)'s, proposed.

[All work packages](index.md)
