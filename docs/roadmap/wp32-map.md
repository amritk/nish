# WP32: `Map` and `Set`

**State:** In progress · **Done:** 1 of 2 · **Design note:** [`docs/wp32-map.md`](https://github.com/amritk/nish/blob/main/docs/wp32-map.md)

## Stages

- [x] S1 to S7: global `Map` and `Set`, `get` typed `V | undefined`, iteration, fusion and `nish/map`, `StringMap`, measured against Node ([#227](https://github.com/amritk/nish/pull/227) to [#244](https://github.com/amritk/nish/pull/244))
- [ ] `Map` reads (`get`, `has`, `size`) inside a parallel body, still refused

## Next

The `Map` read in a parallel body: the effect analysis credits a probe with writing nothing, plus a positive case and a `reject_*` case for a `set`. Spec: [§9.3](https://github.com/amritk/nish/blob/main/docs/wp32-map.md#93-a-map-read-inside-a-parallel-body).

## Not planned

An unordered map type, until a measured lookup gap reopens it.

[All work packages](index.md)
