# WP73: Brotli, measured first, then an encoder and `br` responses

**State:** Proposed · **Done:** 0 of 4 · **Design note:** [`docs/wp73-brotli.md`](https://github.com/amritk/nish/blob/main/docs/wp73-brotli.md)

## Stages

- [ ] S1: gzip's levels against Brotli's qualities on HttpArena's `json-comp` bodies, scored by its own formula: a go or no-go
- [ ] S2: `nish/compress/brotli`, an encoder at the qualities S1 picked, if S1 says go
- [ ] S3: `br` as a response coding in `nish/net/http-compress`, which is [WP43](wp43-http-app-layer.md) stage 4's `br` box
- [ ] S4: a decoder, for request bodies under a decompression-bomb limit *(deferred)*

## Next

S1, the measurement. Spec: [§1](https://github.com/amritk/nish/blob/main/docs/wp73-brotli.md#1-measured-first-s1).

## Not planned

The slow qualities, for files compressed once rather than per request, and `zstd` as a coding.

[All work packages](index.md)
