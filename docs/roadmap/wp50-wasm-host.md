# WP50: A WebAssembly module a TypeScript page drives

**State:** In progress · **Done:** 5 of 6 · **Design note:** [`docs/wp50-wasm-host.md`](https://github.com/amritk/nish/blob/main/docs/wp50-wasm-host.md)

## Stages

- [x] Stage 1: `--profile wasm-host`, `--memory`, `--inline`, the loader and `nish/vite`
- [x] Stage 2: host imports and `HostHandle<K>`
- [x] Stage 3: module storage, buffer windows and panics the page reports
- [x] Stage 4: strings across the boundary ([#1309](https://github.com/amritk/nish/pull/1309))
- [x] Stage 5: `--deterministic`, the same float bits on every target ([#1363](https://github.com/amritk/nish/pull/1363))
- [ ] Stage 6: `examples/wasm-arena/`, its Chromium job, a ten-minute soak and the guide's browser section

## Next

Stage 6, the acceptance example. Spec: [§10](https://github.com/amritk/nish/blob/main/docs/wp50-wasm-host.md#the-acceptance-example-exampleswasm-arena) and [§14 Stages](https://github.com/amritk/nish/blob/main/docs/wp50-wasm-host.md#14-stages).

## Not planned

Generated DOM bindings, threads and `SharedArrayBuffer`, closures, `async` on wasm.

[All work packages](index.md)
