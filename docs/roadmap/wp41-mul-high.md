# WP41: A 64×64→128 high product

**State:** In progress · **Done:** 1 of 3 · **Design note:** [`docs/wp41-mul-high.md`](https://github.com/amritk/nish/blob/main/docs/wp41-mul-high.md)

## Stages

- [x] S1: the `mulHigh` and `mulHighIsNative` builtins, lowered to one multiply on 64-bit targets and to the four-product sequence on wasm32; P-256 and the JSON tokenizer call `mulHigh` where they built it by hand
- [ ] S2: X25519 on five 51-bit limbs, chosen by `mulHighIsNative`, with the ten-limb field kept for wasm32 and Node
- [ ] S3: Poly1305 on 64-bit limbs, chosen by `mulHighIsNative`, with the 26-bit limbs kept for wasm32 and Node

## Next

S2: [the bars](https://github.com/amritk/nish/blob/main/docs/wp41-mul-high.md#the-bars). S3 starts after S2.

## Not planned

A 128-bit integer type, a signed high product, and a `mulx`-only lowering behind a CPU flag.

[All work packages](index.md)
