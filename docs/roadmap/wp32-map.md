# WP32: `Map` and `Set`

**State:** Landed · **Done:** 2 of 2 · **Design note:** [`docs/wp32-map.md`](https://github.com/amritk/nish/blob/main/docs/wp32-map.md)

## Stages

- [x] S1 to S7: global `Map` and `Set`, `get` typed `V | undefined`, iteration, fusion and `nish/map`, `StringMap`, measured against Node ([#227](https://github.com/amritk/nish/pull/227) to [#244](https://github.com/amritk/nish/pull/244))
- [x] `Map` reads (`get`, `has`, `size`) inside a parallel body, a table reaching `dst` only through its keys and values

## Next

Nothing: WP32 has landed.

## Not planned

An unordered map type, until a measured lookup gap reopens it.

[All work packages](index.md)
